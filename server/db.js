import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  watchlist: [],
  watched: [],
  shares: {},
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(DEFAULT_DATA);
      return structuredClone(DEFAULT_DATA);
    }
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function getWatchlist() {
  return readDb().watchlist;
}

export function getWatched() {
  return readDb().watched;
}

export function addToWatchlist(movie) {
  const db = readDb();
  if (db.watchlist.some((m) => m.imdbID === movie.imdbID)) {
    return db.watchlist;
  }
  db.watchlist = [{ ...movie, addedAt: new Date().toISOString() }, ...db.watchlist];
  writeDb(db);
  return db.watchlist;
}

export function removeFromWatchlist(imdbID) {
  const db = readDb();
  db.watchlist = db.watchlist.filter((m) => m.imdbID !== imdbID);
  writeDb(db);
  return db.watchlist;
}

export function markAsWatched(movie, rating) {
  const db = readDb();
  db.watchlist = db.watchlist.filter((m) => m.imdbID !== movie.imdbID);

  const existing = db.watched.findIndex((m) => m.imdbID === movie.imdbID);
  const entry = {
    ...movie,
    rating: Math.min(5, Math.max(1, Number(rating) || 1)),
    watchedAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    db.watched[existing] = { ...db.watched[existing], ...entry };
  } else {
    db.watched = [entry, ...db.watched];
  }

  writeDb(db);
  return db.watched;
}

export function updateRating(imdbID, rating) {
  const db = readDb();
  const item = db.watched.find((m) => m.imdbID === imdbID);
  if (!item) return null;
  item.rating = Math.min(5, Math.max(1, Number(rating) || 1));
  writeDb(db);
  return item;
}

export function removeFromWatched(imdbID) {
  const db = readDb();
  db.watched = db.watched.filter((m) => m.imdbID !== imdbID);
  writeDb(db);
  return db.watched;
}

export function createShare(type) {
  const db = readDb();
  const id = crypto.randomUUID().slice(0, 8);
  const items = type === 'watched' ? db.watched : db.watchlist;
  db.shares[id] = {
    type,
    items,
    createdAt: new Date().toISOString(),
  };
  writeDb(db);
  return { id, type, items };
}

export function getShare(id) {
  const db = readDb();
  return db.shares[id] || null;
}
