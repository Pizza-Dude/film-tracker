const HELP = {
  de: [
    {
      title: 'Übersicht',
      items: [
        'Filme durchsuchen, in der Merkliste speichern, als gesehen markieren und mit 1–5 Sternen bewerten.',
        'Klicke oben links auf Filme, um von Einstellungen oder Hilfe zurück zur Startseite (Suche) zu gelangen.',
        'Filme in Merkliste und Gesehen werden nach Genre gruppiert und können separat durchsucht werden.',
        'Auf der Startseite (Suche) erscheint ein Stream-Button, wenn in den Einstellungen ein Link hinterlegt ist.',
      ],
    },
    {
      title: 'Suche',
      items: [
        'Filme per Titel suchen – Daten kommen von TMDB (ausreichend) oder optional OMDB (IMDb-Rating).',
        'Bei Treffern: + Merken (Merkliste) oder + Gesehen (mit Sterne-Bewertung).',
        'Film anklicken öffnet Details: Beschreibung, Besetzung, Crew, Bewertungen.',
      ],
    },
    {
      title: 'Entdecken',
      items: [
        'Aktuelle Trends und Neuerscheinungen von TMDB.',
        'Filme können direkt zur Merkliste hinzugefügt oder als gesehen markiert werden.',
      ],
    },
    {
      title: 'Merkliste & Gesehen',
      items: [
        'Merkliste: Filme, die du noch sehen möchtest.',
        'Gesehen: Geschaute Filme mit editierbarer Sterne-Bewertung.',
        'Eigene Suchleiste filtert nur die aktuelle Liste (Titel, Jahr, Genre).',
        'Teilen erzeugt einen Link für Merkliste oder Gesehen-Liste.',
      ],
    },
    {
      title: 'API-Schlüssel (Einstellungen)',
      items: [
        'TMDB API-Token: Pflicht für Suche, Entdecken und Details. Kostenlos auf themoviedb.org/settings/api.',
        'Nur den Token eintragen – nicht die ganze URL. TMDB allein reicht für alle Funktionen.',
        'OMDB API-Key (optional): Nur den Key eintragen (z.B. abc123), nicht die Test-URL aus der E-Mail.',
        'Nach dem Speichern mit Speichern bestätigen.',
      ],
    },
    {
      title: 'Benutzer (Einstellungen)',
      items: [
        'Mehrere Benutzer ohne Anmeldung – jeder hat eigene Merkliste und Gesehen-Liste.',
        'Benutzer oben rechts im Dropdown wählen.',
        'Jedes Endgerät merkt sich den zuletzt gewählten Benutzer automatisch.',
        'Standard-Benutzer heißt „Default" und ist nur zum Durchsuchen – keine Merkliste oder Gesehen-Liste.',
        'Eigene Benutzer über Name eingeben und hinzufügen; dort können Filme gespeichert werden.',
      ],
    },
    {
      title: 'Sprache (Einstellungen)',
      items: [
        'Deutsch (Standard) oder Englisch für die gesamte Oberfläche.',
        'Einstellung wird serverseitig gespeichert.',
      ],
    },
    {
      title: 'Streaming (Einstellungen)',
      items: [
        'Unter Einstellungen → Streaming-Dienst einen Link eintragen (z.B. Jellyfin-Startseite).',
        'Button-Text anpassbar – Standard: „Stream".',
        'Der Button erscheint auf der Startseite (Reiter Suche) und öffnet den Link in einem neuen Tab.',
        'Es werden keine lokalen Festplatten oder Medienordner mehr gescannt.',
      ],
    },
    {
      title: 'Backup (Einstellungen)',
      items: [
        'Backup erstellen: Sichert alle Daten auf dem Server und lädt die JSON-Datei auf deinen Computer (z. B. Downloads).',
        'Alle Backups bleiben auf dem Server unter server/backups/ erhalten – auch ältere.',
        'Unter Einstellungen kannst du ältere Backups einzeln herunterladen.',
        'Automatisches Backup: Standardmäßig 1× pro Woche (abschaltbar).',
        'Wiederherstellen: JSON-Backup hochladen – überschreibt alle Daten.',
      ],
    },
    {
      title: 'Docker & Netzwerk',
      items: [
        'App läuft standardmäßig auf Port 4519 (netzwerkweit erreichbar).',
        'Start: ./docker-start.sh im Projektordner.',
        'Erreichbar unter http://<deine-IP>:4519',
        'API-Keys können in .env oder direkt in den Einstellungen hinterlegt werden.',
      ],
    },
  ],
  en: [
    {
      title: 'Overview',
      items: [
        'Search movies, save to watchlist, mark as watched and rate with 1–5 stars.',
        'Click Movies (top left) to return to the home screen (Search) from Settings or Help.',
        'Watchlist and Watched lists are grouped by genre and have their own search filter.',
        'On the home screen (Search) a Stream button appears when a link is configured in Settings.',
      ],
    },
    {
      title: 'Search',
      items: [
        'Search by title – data from TMDB (sufficient) or optional OMDB (IMDb rating).',
        'On results: + Save (watchlist) or + Watched (with star rating).',
        'Click a movie for details: description, cast, crew, ratings.',
      ],
    },
    {
      title: 'Discover',
      items: [
        'Trending and upcoming releases from TMDB.',
        'Movies can be added to watchlist or marked watched directly.',
      ],
    },
    {
      title: 'Watchlist & Watched',
      items: [
        'Watchlist: movies you plan to watch.',
        'Watched: seen movies with editable star ratings.',
        'Dedicated search bar filters the current list only (title, year, genre).',
        'Share creates a link for watchlist or watched list.',
      ],
    },
    {
      title: 'API keys (Settings)',
      items: [
        'TMDB API token: required for search, discover and details. Free at themoviedb.org/settings/api.',
        'Enter the token only – not the full URL. TMDB alone is sufficient.',
        'OMDB API key (optional): enter the key only (e.g. abc123), not the test URL from email.',
        'Click Save to apply changes.',
      ],
    },
    {
      title: 'Users (Settings)',
      items: [
        'Multiple users without login – each has their own watchlist and watched list.',
        'Select user from the dropdown (top right).',
        'Each device remembers the last selected user automatically.',
        'Default user is named "Default" – browse only, no watchlist or watched list.',
        'Add your own user by name to save movies to lists.',
      ],
    },
    {
      title: 'Language (Settings)',
      items: [
        'German (default) or English for the entire interface.',
        'Setting is stored on the server.',
      ],
    },
    {
      title: 'Streaming (Settings)',
      items: [
        'Under Settings → Streaming service, enter a link (e.g. your Jellyfin home page).',
        'Button label is customizable – default: "Stream".',
        'The button appears on the home screen (Search tab) and opens the link in a new tab.',
        'Local disks and media folders are no longer scanned.',
      ],
    },
    {
      title: 'Backup (Settings)',
      items: [
        'Create backup: saves on the server and downloads the JSON file to your computer (e.g. Downloads).',
        'All backups are kept on the server under server/backups/ – including older ones.',
        'In Settings you can download any older backup individually.',
        'Automatic backup: once per week by default (can be disabled).',
        'Restore: upload JSON backup – overwrites all data.',
      ],
    },
    {
      title: 'Docker & network',
      items: [
        'App runs on port 4519 by default (accessible on the network).',
        'Start: ./docker-start.sh in the project folder.',
        'Access at http://<your-ip>:4519',
        'API keys can be set in .env or directly in Settings.',
      ],
    },
  ],
};

function helpHtml() {
  const sections = HELP[currentLang] || HELP.de;
  return `<div class="help">
    <h2 class="help__title">${t('helpTitle')}</h2>
    <p class="help__intro">${t('helpIntro')}</p>
    <button class="btn btn--secondary btn--sm help__settings-link" data-tab="settings">${t('openSettings')}</button>
    ${sections.map((sec) => `
      <section class="help__section">
        <h3>${sec.title}</h3>
        <ul>${sec.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>
      </section>`).join('')}
  </div>`;
}
