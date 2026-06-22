#!/usr/bin/env python3
"""Film Tracker – lokaler Server mit JSON-Speicher, OMDB/TMDB, Benutzer & Backup."""

import json
import os
import re
import shutil
import uuid
from datetime import datetime, timezone, timedelta
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).parent
STATIC = ROOT / "static"
DB_PATH = ROOT / "server" / "data.json"
BACKUP_DIR = ROOT / "server" / "backups"
PORT = 4519
OMDB_KEY = ""
TMDB_TOKEN = ""
TMDB_IMAGE = "https://image.tmdb.org/t/p/w500"

DEFAULT_SETTINGS = {
    "language": "de",
    "omdbApiKey": "",
    "tmdbApiToken": "",
    "autoBackup": True,
    "lastBackupAt": None,
    "streamUrl": "",
    "streamLabel": "Stream",
}

DEFAULT_DATA = {
    "settings": DEFAULT_SETTINGS.copy(),
    "users": [],
    "userData": {},
    "shares": {},
}


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_env():
    global PORT
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            key, _, val = line.partition("=")
            val = val.strip().strip('"').strip("'")
            if key == "PORT" and not os.environ.get("PORT"):
                PORT = int(val)
    if os.environ.get("PORT"):
        PORT = int(os.environ["PORT"])


def extract_api_key(raw):
    if "apikey=" in raw:
        return raw.split("apikey=", 1)[1].split("&")[0].strip()
    if raw.startswith("http"):
        qs = parse_qs(urlparse(raw).query)
        if "apikey" in qs:
            return qs["apikey"][0]
    return raw


def apply_api_keys(settings):
    global OMDB_KEY, TMDB_TOKEN
    OMDB_KEY = extract_api_key(settings.get("omdbApiKey") or "") or os.environ.get("OMDB_API_KEY", "")
    if OMDB_KEY:
        OMDB_KEY = extract_api_key(OMDB_KEY)
    TMDB_TOKEN = settings.get("tmdbApiToken") or os.environ.get("TMDB_API_TOKEN", "")
    if not settings.get("tmdbApiToken") and os.environ.get("TMDB_API_KEY"):
        pass
    if not TMDB_TOKEN:
        TMDB_TOKEN = os.environ.get("TMDB_API_TOKEN", "")


def normalize_settings(settings):
    s = {**DEFAULT_SETTINGS, **(settings or {})}
    if s.get("mediaLinkTemplate") and not s.get("streamUrl"):
        s["streamUrl"] = s["mediaLinkTemplate"]
    if s.get("mediaLinkLabel") and not s.get("streamLabel"):
        s["streamLabel"] = s["mediaLinkLabel"]
    for key in ("mediaPaths", "mediaLinkTemplate", "mediaLinkLabel"):
        s.pop(key, None)
    if not s.get("streamLabel"):
        s["streamLabel"] = "Stream"
    return s


def migrate_db(raw):
    if "userData" in raw and "settings" in raw:
        data = {**DEFAULT_DATA, **raw}
        data["settings"] = normalize_settings(data.get("settings", {}))
        for user in data.get("users", []):
            if user.get("name") == "Standard":
                user["name"] = "Default"
            if user.get("name") == "Default":
                user["readOnly"] = True
                uid = user.get("id")
                if uid and uid in data.get("userData", {}):
                    data["userData"][uid]["watchlist"] = []
                    data["userData"][uid]["watched"] = []
        return data

    user_id = str(uuid.uuid4())[:8]
    settings = normalize_settings(DEFAULT_SETTINGS.copy())
    if os.environ.get("OMDB_API_KEY"):
        settings["omdbApiKey"] = extract_api_key(os.environ["OMDB_API_KEY"])
    if os.environ.get("TMDB_API_TOKEN"):
        settings["tmdbApiToken"] = os.environ["TMDB_API_TOKEN"]

    return {
        "settings": settings,
        "users": [{"id": user_id, "name": "Default", "createdAt": now_iso(), "readOnly": True}],
        "userData": {
            user_id: {
                "watchlist": raw.get("watchlist", []),
                "watched": raw.get("watched", []),
            }
        },
        "shares": raw.get("shares", {}),
    }


def read_db():
    if not DB_PATH.exists():
        data = migrate_db({})
        write_db(data, skip_backup=True)
        apply_api_keys(data["settings"])
        return data
    try:
        raw = json.loads(DB_PATH.read_text())
        data = migrate_db(raw)
        if data != raw:
            write_db(data, skip_backup=True)
        apply_api_keys(data["settings"])
        return data
    except (json.JSONDecodeError, OSError):
        data = migrate_db({})
        apply_api_keys(data["settings"])
        return data


def write_db(data, skip_backup=False):
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DB_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    if not skip_backup:
        maybe_auto_backup(data)


def maybe_auto_backup(data):
    settings = data.get("settings", {})
    if not settings.get("autoBackup"):
        return
    last = settings.get("lastBackupAt")
    if last:
        try:
            last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) - last_dt < timedelta(days=7):
                return
        except ValueError:
            pass
    create_backup(data)


def create_backup(data=None):
    data = data or read_db()
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    path = BACKUP_DIR / f"backup-{ts}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    data["settings"]["lastBackupAt"] = now_iso()
    DB_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"filename": path.name, "createdAt": data["settings"]["lastBackupAt"]}


def user_by_id(db, user_id):
    for user in db.get("users", []):
        if user["id"] == user_id:
            return user
    return None


def user_is_read_only(db, user_id):
    user = user_by_id(db, user_id)
    return bool(user and user.get("readOnly"))


def list_write_forbidden(handler, db, user_id):
    if user_is_read_only(db, user_id):
        lang = db.get("settings", {}).get("language", "de")
        msg = (
            "Lists cannot be edited in the Default profile."
            if lang == "en"
            else "Im Profil Default können keine Listen bearbeitet werden."
        )
        return json_response(handler, 403, {"error": msg})
    return None


def get_user_id(handler, db):
    uid = handler.headers.get("X-User-Id", "").strip()
    if uid and uid in db.get("userData", {}):
        return uid
    users = db.get("users", [])
    return users[0]["id"] if users else None


def user_lists(db, user_id):
    if not user_id:
        return {"watchlist": [], "watched": []}
    if user_id not in db["userData"]:
        db["userData"][user_id] = {"watchlist": [], "watched": []}
    return db["userData"][user_id]


def tmdb_lang_from_settings(db):
    return "en-US" if db.get("settings", {}).get("language") == "en" else "de-DE"


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_body(handler):
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    return json.loads(handler.rfile.read(length))


def normalize_movie(movie):
    genre = movie.get("Genre")
    if genre == "N/A":
        genre = None
    return {
        "imdbID": movie.get("imdbID"),
        "tmdbID": movie.get("tmdbID"),
        "Title": movie.get("Title") or movie.get("title"),
        "Year": movie.get("Year") or (movie.get("release_date") or "")[:4] or None,
        "Poster": (
            movie.get("Poster")
            if movie.get("Poster") not in (None, "N/A")
            else (f"{TMDB_IMAGE}{movie['poster_path']}" if movie.get("poster_path") else None)
        ),
        "Type": movie.get("Type") or "movie",
        "Plot": movie.get("Plot") if movie.get("Plot") not in (None, "N/A") else movie.get("overview"),
        "imdbRating": movie.get("imdbRating") if movie.get("imdbRating") not in (None, "N/A") else None,
        "Genre": genre,
        "Runtime": movie.get("Runtime") if movie.get("Runtime") != "N/A" else None,
        "Released": movie.get("Released") if movie.get("Released") != "N/A" else None,
    }


def parse_genres(movie):
    if movie.get("Genre"):
        return [g.strip() for g in movie["Genre"].split(",") if g.strip()]
    if movie.get("genres"):
        return [g.get("name") for g in movie["genres"] if g.get("name")]
    return ["Unbekannt"]


def omdb_fetch(params):
    if not OMDB_KEY:
        raise ValueError("OMDB nicht konfiguriert")
    url = f"https://www.omdbapi.com/?{urlencode({**params, 'apikey': OMDB_KEY})}"
    with urlopen(url) as resp:
        data = json.loads(resp.read())
    if data.get("Response") == "False":
        raise ValueError(data.get("Error", "OMDB Fehler"))
    return data


def tmdb_fetch(path, params=None, lang="de-DE"):
    if not TMDB_TOKEN:
        raise ValueError("TMDB nicht konfiguriert")
    params = {**(params or {}), "language": lang}
    url = f"https://api.themoviedb.org/3{path}?{urlencode(params)}"
    req = Request(url, headers={"Authorization": f"Bearer {TMDB_TOKEN}", "Accept": "application/json"})
    with urlopen(req) as resp:
        return json.loads(resp.read())


def normalize_search_text(text):
    if not text:
        return ""
    text = text.lower().replace("–", "-").replace("—", "-")
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def search_query_variants(q):
    variants = [q.strip()]
    norm = q.replace("–", "-").replace("—", "-")
    for sep in (" - ", "-"):
        if sep in norm:
            head = norm.split(sep)[0].strip()
            if head and head not in variants:
                variants.append(head)
    return variants


def search_match_score(movie, q):
    q_norm = normalize_search_text(q)
    if not q_norm:
        return 3
    titles = [
        normalize_search_text(movie.get("Title")),
        normalize_search_text(movie.get("originalTitle")),
    ]
    best = 3
    for title in titles:
        if not title:
            continue
        if title == q_norm:
            return 0
        if title.startswith(q_norm) or q_norm.startswith(title):
            best = min(best, 1)
        elif q_norm in title or title in q_norm:
            best = min(best, 2)
    return best


def rank_search_results(results, q):
    return sorted(
        results,
        key=lambda m: (search_match_score(m, q), (m.get("Title") or "").lower()),
    )


def merge_search_results(primary, secondary):
    by_imdb = {m["imdbID"]: m for m in primary if m.get("imdbID")}
    by_tmdb = {str(m.get("tmdbID")): m for m in primary if m.get("tmdbID")}
    merged = list(primary)
    for movie in secondary:
        imdb_id = movie.get("imdbID")
        tmdb_id = str(movie.get("tmdbID") or "")
        if imdb_id and imdb_id in by_imdb:
            if movie.get("imdbRating") and not by_imdb[imdb_id].get("imdbRating"):
                by_imdb[imdb_id]["imdbRating"] = movie["imdbRating"]
            continue
        if tmdb_id and tmdb_id in by_tmdb:
            continue
        merged.append(movie)
        if imdb_id:
            by_imdb[imdb_id] = movie
        if tmdb_id:
            by_tmdb[tmdb_id] = movie
    return merged


def normalize_tmdb_item(item):
    movie = normalize_movie(item)
    movie["tmdbID"] = item.get("id")
    movie["originalTitle"] = item.get("original_title")
    if item.get("imdb_id"):
        movie["imdbID"] = item["imdb_id"]
    elif not movie.get("imdbID"):
        movie["imdbID"] = f"tmdb-{item.get('id')}"
    if item.get("genres"):
        movie["Genre"] = ", ".join(g["name"] for g in item["genres"])
    movie["tmdbRating"] = round(item.get("vote_average", 0), 1) if item.get("vote_average") else None
    return movie


def tmdb_search(q, lang="de-DE"):
    seen_tmdb = set()
    results = []
    for term in search_query_variants(q):
        data = tmdb_fetch(
            "/search/movie",
            {"query": term, "include_adult": "true", "page": 1},
            lang=lang,
        )
        for item in data.get("results", []):
            if not item.get("title"):
                continue
            tmdb_id = item.get("id")
            if tmdb_id in seen_tmdb:
                continue
            seen_tmdb.add(tmdb_id)
            results.append(normalize_tmdb_item(item))
    return results


def omdb_search(q):
    data = omdb_fetch({"s": q, "type": "movie"})
    return [normalize_movie(m) for m in data.get("Search", [])]


def movie_search(q, lang="de-DE"):
    results = []
    if TMDB_TOKEN:
        results = tmdb_search(q, lang=lang)
    if OMDB_KEY:
        omdb_results = []
        for term in search_query_variants(q):
            try:
                omdb_results = omdb_search(term)
                if omdb_results:
                    break
            except ValueError:
                continue
        if omdb_results:
            results = merge_search_results(results, omdb_results) if results else omdb_results
    if not results:
        if not TMDB_TOKEN and not OMDB_KEY:
            raise ValueError("Kein API-Schlüssel konfiguriert")
        return []
    return rank_search_results(results, q)


def tmdb_list(endpoint, lang="de-DE"):
    data = tmdb_fetch(endpoint, lang=lang)
    results = []
    for item in data.get("results", []):
        if item.get("title"):
            results.append(normalize_tmdb_item(item))
    return results


def enrich_movie(movie, lang="de-DE"):
    if movie.get("Genre") and movie["Genre"] not in ("N/A", "Unbekannt"):
        return movie
    tmdb_id = movie.get("tmdbID") or (
        movie.get("imdbID", "").replace("tmdb-", "") if str(movie.get("imdbID", "")).startswith("tmdb-") else None
    )
    if tmdb_id and TMDB_TOKEN:
        try:
            data = tmdb_fetch(f"/movie/{tmdb_id}", lang=lang)
            merged = {**movie, **normalize_tmdb_item(data)}
            if data.get("genres"):
                merged["Genre"] = ", ".join(g["name"] for g in data["genres"])
            return merged
        except ValueError:
            pass
    if movie.get("imdbID") and not str(movie["imdbID"]).startswith("tmdb-") and OMDB_KEY:
        try:
            data = omdb_fetch({"i": movie["imdbID"], "plot": "short"})
            merged = {**movie, **normalize_movie(data)}
            merged["Genre"] = data.get("Genre") if data.get("Genre") != "N/A" else "Unbekannt"
            return merged
        except ValueError:
            pass
    return {**movie, "Genre": movie.get("Genre") or "Unbekannt"}


def get_tmdb_by_imdb(imdb_id, lang="de-DE"):
    data = tmdb_fetch(f"/find/{imdb_id}", {"external_source": "imdb_id"}, lang=lang)
    movies = data.get("movie_results") or []
    if not movies:
        return None
    return tmdb_fetch(f"/movie/{movies[0]['id']}", {"append_to_response": "credits"}, lang=lang)


def get_movie_details(imdb_id, user_id=None, lang="de-DE"):
    details = {
        "imdbID": imdb_id, "Title": None, "Plot": None, "Released": None, "Runtime": None,
        "Genre": None, "imdbRating": None, "tmdbRating": None, "Poster": None,
        "cast": [], "crew": [], "userRating": None,
    }
    if not imdb_id.startswith("tmdb-") and OMDB_KEY:
        try:
            omdb = omdb_fetch({"i": imdb_id, "plot": "full"})
            details.update(normalize_movie(omdb))
            details["Genre"] = omdb.get("Genre") if omdb.get("Genre") != "N/A" else None
            details["Director"] = omdb.get("Director") if omdb.get("Director") != "N/A" else None
            details["Actors"] = omdb.get("Actors") if omdb.get("Actors") != "N/A" else None
        except ValueError:
            pass

    tmdb_data = None
    try:
        if imdb_id.startswith("tmdb-"):
            tmdb_data = tmdb_fetch(f"/movie/{imdb_id.replace('tmdb-', '')}", {"append_to_response": "credits"}, lang=lang)
        elif TMDB_TOKEN:
            tmdb_data = get_tmdb_by_imdb(imdb_id, lang=lang)
    except ValueError:
        pass

    if tmdb_data:
        details["tmdbID"] = tmdb_data.get("id")
        details["Title"] = details.get("Title") or tmdb_data.get("title")
        details["Plot"] = details.get("Plot") or tmdb_data.get("overview")
        details["Released"] = details.get("Released") or tmdb_data.get("release_date")
        if tmdb_data.get("runtime"):
            details["Runtime"] = f"{tmdb_data['runtime']} Min"
        if tmdb_data.get("genres"):
            details["Genre"] = ", ".join(g["name"] for g in tmdb_data["genres"])
        details["tmdbRating"] = round(tmdb_data.get("vote_average", 0), 1)
        if tmdb_data.get("poster_path") and not details.get("Poster"):
            details["Poster"] = f"{TMDB_IMAGE}{tmdb_data['poster_path']}"
        credits = tmdb_data.get("credits") or {}
        details["cast"] = [
            {"name": c.get("name"), "character": c.get("character")}
            for c in (credits.get("cast") or [])[:12]
        ]
        crew_map = (
            {"Director": "Director", "Screenplay": "Screenplay", "Writer": "Writer", "Producer": "Producer"}
            if lang.startswith("en")
            else {"Director": "Regie", "Screenplay": "Drehbuch", "Writer": "Drehbuch", "Producer": "Produktion"}
        )
        seen = set()
        details["crew"] = []
        for c in credits.get("crew") or []:
            if c.get("job") in crew_map and c.get("name") not in seen:
                seen.add(c["name"])
                details["crew"].append({"name": c["name"], "job": crew_map.get(c["job"], c["job"])})

    if user_id:
        db = read_db()
        for m in db["userData"].get(user_id, {}).get("watched", []):
            if m.get("imdbID") == imdb_id:
                details["userRating"] = m.get("rating")
                break

    if not details.get("Title"):
        raise ValueError("Filmdetails nicht gefunden")
    return details


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-User-Id")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        parts = [p for p in path.split("/") if p]
        db = read_db()
        lang = tmdb_lang_from_settings(db)
        user_id = get_user_id(self, db)
        lists = user_lists(db, user_id)

        if path == "/api/health":
            return json_response(self, 200, {
                "ok": True,
                "omdbConfigured": bool(OMDB_KEY),
                "tmdbConfigured": bool(TMDB_TOKEN),
                "searchReady": bool(OMDB_KEY or TMDB_TOKEN),
            })

        if path == "/api/settings":
            s = normalize_settings(db["settings"].copy())
            s["omdbApiKeySet"] = bool(s.get("omdbApiKey") or OMDB_KEY)
            s["tmdbApiTokenSet"] = bool(s.get("tmdbApiToken") or TMDB_TOKEN)
            s["omdbApiKey"] = "***" if s.get("omdbApiKey") else ""
            s["tmdbApiToken"] = "***" if s.get("tmdbApiToken") else ""
            s["streamUrl"] = s.get("streamUrl") or ""
            s["streamLabel"] = s.get("streamLabel") or "Stream"
            return json_response(self, 200, s)

        if path == "/api/users":
            return json_response(self, 200, db["users"])

        if path == "/api/search":
            q = qs.get("q", [""])[0].strip()
            if not q:
                return json_response(self, 400, {"error": "Suchbegriff fehlt"})
            try:
                results = movie_search(q, lang=lang)
                return json_response(self, 200, {"results": results, "total": len(results)})
            except ValueError as e:
                return json_response(self, 503, {"error": str(e)})
            except Exception as e:
                return json_response(self, 500, {"error": f"Suche fehlgeschlagen: {e}"})

        if len(parts) >= 4 and parts[0] == "api" and parts[1] == "movie" and parts[3] == "details":
            try:
                return json_response(self, 200, get_movie_details(parts[2], user_id, lang=lang))
            except ValueError as e:
                return json_response(self, 404, {"error": str(e)})

        if path == "/api/tmdb/trending":
            try:
                return json_response(self, 200, {"results": tmdb_list("/trending/movie/week", lang=lang)})
            except ValueError as e:
                return json_response(self, 503, {"error": str(e)})

        if path == "/api/tmdb/upcoming":
            try:
                return json_response(self, 200, {"results": tmdb_list("/movie/upcoming", lang=lang)})
            except ValueError as e:
                return json_response(self, 503, {"error": str(e)})

        if path == "/api/watchlist":
            return json_response(self, 200, lists["watchlist"])

        if path == "/api/watched":
            return json_response(self, 200, lists["watched"])

        if path.startswith("/api/backup/download/"):
            filename = path.rsplit("/", 1)[-1]
            if not filename.startswith("backup-") or not filename.endswith(".json") or ".." in filename:
                return json_response(self, 400, {"error": "Ungültige Datei"})
            file_path = BACKUP_DIR / filename
            if not file_path.is_file():
                return json_response(self, 404, {"error": "Backup nicht gefunden"})
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if path == "/api/backup":
            try:
                info = create_backup(db)
                return json_response(self, 200, info)
            except OSError as e:
                return json_response(self, 500, {"error": str(e)})

        if path == "/api/backups":
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            files = [{"filename": f.name, "size": f.stat().st_size} for f in sorted(BACKUP_DIR.glob("backup-*.json"), reverse=True)]
            return json_response(self, 200, {"backups": files, "lastBackupAt": db["settings"].get("lastBackupAt")})

        if path.startswith("/api/share/"):
            share = db["shares"].get(path.split("/")[-1])
            if not share:
                return json_response(self, 404, {"error": "Share nicht gefunden"})
            return json_response(self, 200, share)

        if path in ("/", ""):
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        body = read_body(self)
        db = read_db()
        lang = tmdb_lang_from_settings(db)
        user_id = get_user_id(self, db)
        if not user_id and path not in ("/api/restore",):
            return json_response(self, 400, {"error": "Benutzer fehlt"})
        lists = user_lists(db, user_id)

        if path == "/api/users":
            name = (body.get("name") or "").strip()
            if not name:
                return json_response(self, 400, {"error": "Name fehlt"})
            uid = str(uuid.uuid4())[:8]
            db["users"].append({"id": uid, "name": name, "createdAt": now_iso()})
            db["userData"][uid] = {"watchlist": [], "watched": []}
            write_db(db)
            return json_response(self, 200, db["users"])

        if path == "/api/watchlist":
            blocked = list_write_forbidden(self, db, user_id)
            if blocked:
                return blocked
            movie = enrich_movie(body, lang=lang)
            if not movie.get("imdbID"):
                return json_response(self, 400, {"error": "Film-Daten fehlen"})
            if not any(m["imdbID"] == movie["imdbID"] for m in lists["watchlist"]):
                lists["watchlist"].insert(0, {**movie, "addedAt": now_iso()})
                write_db(db)
            return json_response(self, 200, lists["watchlist"])

        if path == "/api/watched":
            blocked = list_write_forbidden(self, db, user_id)
            if blocked:
                return blocked
            movie = enrich_movie(body.get("movie", body), lang=lang)
            rating = max(1, min(5, int(body.get("rating", 1))))
            if not movie.get("imdbID"):
                return json_response(self, 400, {"error": "Film-Daten fehlen"})
            lists["watchlist"] = [m for m in lists["watchlist"] if m["imdbID"] != movie["imdbID"]]
            entry = {**movie, "rating": rating, "watchedAt": now_iso()}
            for i, m in enumerate(lists["watched"]):
                if m["imdbID"] == movie["imdbID"]:
                    lists["watched"][i] = {**m, **entry}
                    write_db(db)
                    return json_response(self, 200, lists["watched"])
            lists["watched"].insert(0, entry)
            write_db(db)
            return json_response(self, 200, lists["watched"])

        if path == "/api/share":
            blocked = list_write_forbidden(self, db, user_id)
            if blocked:
                return blocked
            share_type = "watched" if body.get("type") == "watched" else "watchlist"
            share_id = str(uuid.uuid4())[:8]
            items = lists[share_type]
            db["shares"][share_id] = {"type": share_type, "items": items, "createdAt": now_iso()}
            write_db(db)
            return json_response(self, 200, {"id": share_id, "type": share_type, "items": items})

        if path == "/api/restore":
            restored = migrate_db(body)
            write_db(restored, skip_backup=True)
            apply_api_keys(restored["settings"])
            create_backup(restored)
            return json_response(self, 200, {"ok": True})

        return json_response(self, 404, {"error": "Nicht gefunden"})

    def do_PATCH(self):
        path = urlparse(self.path).path
        body = read_body(self)
        db = read_db()
        user_id = get_user_id(self, db)
        lists = user_lists(db, user_id)

        if path == "/api/settings":
            s = db["settings"]
            if "language" in body:
                s["language"] = body["language"] if body["language"] in ("de", "en") else "de"
            if "autoBackup" in body:
                s["autoBackup"] = bool(body["autoBackup"])
            if body.get("omdbApiKey") and body["omdbApiKey"] != "***":
                s["omdbApiKey"] = extract_api_key(body["omdbApiKey"])
            if body.get("tmdbApiToken") and body["tmdbApiToken"] != "***":
                s["tmdbApiToken"] = body["tmdbApiToken"].strip()
            if "streamUrl" in body:
                s["streamUrl"] = (body["streamUrl"] or "").strip()
            if "streamLabel" in body:
                s["streamLabel"] = (body["streamLabel"] or "Stream").strip()
            db["settings"] = normalize_settings(s)
            write_db(db)
            apply_api_keys(db["settings"])
            return json_response(self, 200, {"ok": True})

        if "/rating" in path:
            blocked = list_write_forbidden(self, db, user_id)
            if blocked:
                return blocked
            imdb_id = path.split("/")[3]
            rating = max(1, min(5, int(body.get("rating", 1))))
            for m in lists["watched"]:
                if m["imdbID"] == imdb_id:
                    m["rating"] = rating
                    write_db(db)
                    return json_response(self, 200, m)
            return json_response(self, 404, {"error": "Film nicht gefunden"})

        return json_response(self, 404, {"error": "Nicht gefunden"})

    def do_DELETE(self):
        path = urlparse(self.path).path
        db = read_db()
        user_id = get_user_id(self, db)
        lists = user_lists(db, user_id)

        if path.startswith("/api/users/"):
            uid = path.split("/")[-1]
            if user_is_read_only(db, uid):
                return json_response(self, 400, {"error": "Default-Profil kann nicht gelöscht werden"})
            if len(db["users"]) <= 1:
                return json_response(self, 400, {"error": "Letzter Benutzer kann nicht gelöscht werden"})
            db["users"] = [u for u in db["users"] if u["id"] != uid]
            db["userData"].pop(uid, None)
            write_db(db)
            return json_response(self, 200, db["users"])

        if path.startswith("/api/watchlist/"):
            blocked = list_write_forbidden(self, db, user_id)
            if blocked:
                return blocked
            imdb_id = path.split("/")[-1]
            lists["watchlist"] = [m for m in lists["watchlist"] if m["imdbID"] != imdb_id]
            write_db(db)
            return json_response(self, 200, lists["watchlist"])

        if path.startswith("/api/watched/"):
            blocked = list_write_forbidden(self, db, user_id)
            if blocked:
                return blocked
            imdb_id = path.split("/")[-1]
            lists["watched"] = [m for m in lists["watched"] if m["imdbID"] != imdb_id]
            write_db(db)
            return json_response(self, 200, lists["watched"])

        return json_response(self, 404, {"error": "Nicht gefunden"})


def main():
    load_env()
    db = read_db()
    apply_api_keys(db["settings"])
    STATIC.mkdir(exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    maybe_auto_backup(db)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Filme-App läuft auf http://0.0.0.0:{PORT}")
    if not TMDB_TOKEN and not OMDB_KEY:
        print("⚠️  Kein API-Key – bitte in Einstellungen oder .env hinterlegen.")
    elif not OMDB_KEY:
        print("ℹ️  Nur TMDB aktiv (ausreichend für alle Funktionen).")
    server.serve_forever()


if __name__ == "__main__":
    main()
