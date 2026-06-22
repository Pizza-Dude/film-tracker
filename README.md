# Film Tracker

Lokale Web-App zum Suchen, Merken und Bewerten von Filmen — mit [TMDB](https://www.themoviedb.org/) (Pflicht) und optional [OMDB](https://www.omdbapi.com/) (IMDb-Ratings).

**Repository:** [github.com/Pizza-Dude/film-tracker](https://github.com/Pizza-Dude/film-tracker)

---

## Features

- **Suche & Entdecken** — Filme per Titel suchen, Trends und Neuerscheinungen (TMDB)
- **Merkliste & Gesehen** — nach Genre gruppiert, mit Textsuche und Sterne-Filter (Gesehen)
- **Filmdetails** — Beschreibung, Besetzung, Crew, Bewertungen (Film anklicken)
- **Mehrere Benutzer** — ohne Login; jedes Gerät merkt sich den zuletzt gewählten Benutzer
- **Default-Profil** — nur zum Durchsuchen (keine Merkliste/Gesehen); eigene Benutzer unter Einstellungen anlegen
- **Streaming-Link** — z. B. Jellyfin-URL in den Einstellungen; Button auf der Startseite
- **Backup** — JSON-Backup auf dem Server + Download auf den Computer; alle Backups bleiben erhalten
- **Sprache** — Deutsch / Englisch (Einstellungen)
- **Hilfe** — integrierte Anleitung in der App (Fragezeichen-Button)

Daten liegen lokal in `server/data.json` (Docker: Volume `film-data`). Keine Cloud.

---

## Schnellstart (Docker, empfohlen)

```bash
git clone https://github.com/Pizza-Dude/film-tracker.git
cd film-tracker

# API-Keys (siehe unten)
cp .env.example .env
# .env bearbeiten: TMDB_API_TOKEN=...

./docker-start.sh
```

App öffnen:

- **http://localhost:4519**
- **http://\<deine-IP\>:4519** (z. B. im Heimnetz)

IP auf dem Mac: `ipconfig getifaddr en0`

---

## API-Schlüssel

| Key | Pflicht | Woher |
|-----|---------|--------|
| **TMDB API Token** | Ja | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) — nur den Token eintragen, nicht die ganze URL |
| **OMDB API Key** | Nein | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) — nur den Key, nicht die Test-URL aus der E-Mail |

In `.env` oder direkt in der App unter **Einstellungen (⚙)**:

```env
TMDB_API_TOKEN=dein_tmdb_token
OMDB_API_KEY=dein_omdb_key   # optional
PORT=4519
```

---

## Alternative: Python (ohne Docker)

```bash
cd film-tracker
python3 server.py
```

Öffne [http://localhost:4519](http://localhost:4519) (Port aus `.env` oder Standard 4519).

---

## Erste Schritte in der App

1. **TMDB-Token** in den Einstellungen speichern (falls nicht in `.env`).
2. **Eigenen Benutzer** anlegen (Default ist nur zum Suchen).
3. Optional: **Streaming-Link** (Jellyfin o. Ä.) und **Sprache** einstellen.
4. Filme suchen → **+ Merken** oder **+ Gesehen** (mit Sterne-Bewertung).
5. **Backup erstellen** lädt zusätzlich eine JSON-Datei auf deinen Rechner (z. B. Downloads).

Ausführliche Hilfe: **?** in der App.

---

## Daten & Backups

| Was | Wo |
|-----|-----|
| Listen, Benutzer, Einstellungen | `server/data.json` |
| Backups (alle Versionen) | `server/backups/` |
| Docker | Volume `film-data` → `/app/server` im Container |

Volume-Pfad auf dem Host anzeigen:

```bash
docker volume inspect film-tracker_film-data
```

---

## Entwicklung mit Cursor

Dieses Projekt wurde mit Unterstützung von **[Cursor](https://cursor.com)** entwickelt — einem Editor mit KI-Agent für Code, Refactoring und Dokumentation.

**So geht’s:**

1. Repository klonen oder in Cursor öffnen: **File → Open Folder** → `film-tracker`
2. Optional: [Cursor](https://cursor.com) installieren und Projekt öffnen
3. Im Chat z. B. fragen: *„Wie starte ich Docker?“*, *„Füge Feature X hinzu“*, *„README aktualisieren“*
4. Der Agent kennt `server.py`, `static/` und `docker-compose.yml` — Änderungen lokal testen mit `./docker-start.sh`

Stack: Python (`server.py`), statisches Frontend (`static/`), optional React in `src/` (Vite).

---

## Docker-Befehle

```bash
./docker-start.sh              # Neu bauen & starten
docker compose logs -f         # Logs
docker compose down            # Stoppen (Daten bleiben im Volume)
docker compose down -v         # Stoppen + Volume löschen (alle Daten weg!)
```

---

## API (Auszug)

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/health` | Status & API-Keys |
| GET | `/api/search?q=...` | Filmsuche |
| GET | `/api/tmdb/trending` | Trends |
| GET/POST/DELETE | `/api/watchlist` | Merkliste |
| GET/POST/PATCH/DELETE | `/api/watched` | Gesehen + Sterne |
| GET/PATCH | `/api/settings` | Einstellungen |
| GET/POST | `/api/backup` | Backup erstellen / herunterladen |

---

## Lizenz

Privates Projekt — [Pizza-Dude](https://github.com/Pizza-Dude).
