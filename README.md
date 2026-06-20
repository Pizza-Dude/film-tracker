# Film Tracker

Eine lokale Web-App zum Suchen, Sammeln und Bewerten von Filmen — powered by IMDb-Daten über die [OMDB API](https://www.omdbapi.com/).

## Features

- **Filmsuche** — Suche über OMDB (IMDb-Daten: Titel, Jahr, Poster, IMDb-Rating)
- **Merkliste / Gesehen** — nach Genre gruppiert, mit eigener Suchleiste
- **Entdecken** — Aktuelle Trends & Neuerscheinungen (TMDB)
- **Filmdetails** — Beschreibung, Besetzung, Crew, Bewertungen (Klick auf Film)
- **Gesehen** — Filme als gesehen markieren mit **1–5 Sterne** Bewertung
- **Teilen** — Merkliste oder Gesehen-Liste per Link teilen
- **Lokale Speicherung** — JSON-Datei (`server/data.json`), keine Cloud

## Setup

### 1. OMDB API-Key (kostenlos)

1. Registriere dich auf [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx)
2. Erstelle eine `.env` Datei im Projektroot:

```
OMDB_API_KEY=dein_omdb_key
TMDB_API_TOKEN=dein_tmdb_token
```

TMDB-Token: kostenlos auf [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)

### 2. Start (Python – empfohlen)

```bash
cd ~/Projects/film-tracker
python3 server.py
```

Öffne [http://localhost:3001](http://localhost:3001)

### Alternative: Node.js Dev-Server

Falls Node.js installiert ist:

```bash
npm install
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173) (mit Hot Reload)
- Backend: [http://localhost:3001](http://localhost:3001)

### 3. Docker (Port 4519, netzwerkweit)

```bash
cd ~/Projects/film-tracker
# .env mit OMDB_API_KEY anlegen (siehe oben)

# Alten Container entfernen und neu starten:
./docker-start.sh

# oder manuell:
docker compose down --remove-orphans
docker rm -f film-tracker 2>/dev/null || true
docker compose up --build -d
docker compose ps
docker port film-tracker
```

Erreichbar unter:
- **http://localhost:4519**
- **http://\<deine-IP\>:4519** (z.B. `http://192.168.1.10:4519`)

IP ermitteln (Mac): `ipconfig getifaddr en0`

Falls noch `3001` angezeigt wird, läuft der alte Container — unbedingt `docker compose down` und neu bauen.

## Daten

Alle Listen werden lokal in `server/data.json` gespeichert:

```json
{
  "watchlist": [...],
  "watched": [...],
  "shares": { "abc12345": { "type": "watchlist", "items": [...] } }
}
```

## API Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/search?q=...` | Filme suchen |
| GET/POST/DELETE | `/api/watchlist` | Merkliste verwalten |
| GET/POST/PATCH/DELETE | `/api/watched` | Gesehen-Liste + Sterne |
| POST/GET | `/api/share` | Listen teilen |

## Tech Stack

- **Frontend:** HTML/JS (static/) oder optional React + Vite
- **Backend:** Python (server.py)
- **Daten:** JSON-Datei
- **Filmdaten:** OMDB API (IMDb)
