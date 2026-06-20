import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const OMDB_API_KEY = process.env.OMDB_API_KEY || '';

app.use(cors());
app.use(express.json());

async function omdbFetch(params) {
  if (!OMDB_API_KEY) {
    const err = new Error('OMDB_API_KEY nicht gesetzt. Bitte in .env eintragen.');
    err.status = 503;
    throw err;
  }
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', OMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  const data = await res.json();
  if (data.Response === 'False') {
    const err = new Error(data.Error || 'OMDB Fehler');
    err.status = 404;
    throw err;
  }
  return data;
}

function normalizeMovie(movie) {
  return {
    imdbID: movie.imdbID,
    Title: movie.Title,
    Year: movie.Year,
    Poster: movie.Poster !== 'N/A' ? movie.Poster : null,
    Type: movie.Type,
    Plot: movie.Plot !== 'N/A' ? movie.Plot : null,
    imdbRating: movie.imdbRating !== 'N/A' ? movie.imdbRating : null,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, omdbConfigured: Boolean(OMDB_API_KEY) });
});

app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Suchbegriff fehlt' });

    const data = await omdbFetch({ s: q, type: 'movie' });
    const results = (data.Search || []).map(normalizeMovie);
    res.json({ results, total: results.length });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/movie/:imdbID', async (req, res) => {
  try {
    const data = await omdbFetch({ i: req.params.imdbID, plot: 'short' });
    res.json(normalizeMovie(data));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/api/watchlist', (_req, res) => {
  res.json(db.getWatchlist());
});

app.post('/api/watchlist', (req, res) => {
  const movie = req.body;
  if (!movie?.imdbID) return res.status(400).json({ error: 'Film-Daten fehlen' });
  res.json(db.addToWatchlist(movie));
});

app.delete('/api/watchlist/:imdbID', (req, res) => {
  res.json(db.removeFromWatchlist(req.params.imdbID));
});

app.get('/api/watched', (_req, res) => {
  res.json(db.getWatched());
});

app.post('/api/watched', (req, res) => {
  const { movie, rating } = req.body;
  if (!movie?.imdbID) return res.status(400).json({ error: 'Film-Daten fehlen' });
  res.json(db.markAsWatched(movie, rating));
});

app.patch('/api/watched/:imdbID/rating', (req, res) => {
  const item = db.updateRating(req.params.imdbID, req.body.rating);
  if (!item) return res.status(404).json({ error: 'Film nicht gefunden' });
  res.json(item);
});

app.delete('/api/watched/:imdbID', (req, res) => {
  res.json(db.removeFromWatched(req.params.imdbID));
});

app.post('/api/share', (req, res) => {
  const type = req.body.type === 'watched' ? 'watched' : 'watchlist';
  const share = db.createShare(type);
  res.json(share);
});

app.get('/api/share/:id', (req, res) => {
  const share = db.getShare(req.params.id);
  if (!share) return res.status(404).json({ error: 'Share nicht gefunden' });
  res.json(share);
});

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Film-Tracker Server läuft auf http://localhost:${PORT}`);
  if (!OMDB_API_KEY) {
    console.warn('⚠️  OMDB_API_KEY fehlt – Filmsuche deaktiviert. Siehe README.');
  }
});
