const API = '/api';

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen');
  return data;
}

export function searchMovies(query) {
  return apiFetch(`/search?q=${encodeURIComponent(query)}`);
}

export function getWatchlist() {
  return apiFetch('/watchlist');
}

export function addToWatchlist(movie) {
  return apiFetch('/watchlist', { method: 'POST', body: JSON.stringify(movie) });
}

export function removeFromWatchlist(imdbID) {
  return apiFetch(`/watchlist/${imdbID}`, { method: 'DELETE' });
}

export function getWatched() {
  return apiFetch('/watched');
}

export function markAsWatched(movie, rating) {
  return apiFetch('/watched', {
    method: 'POST',
    body: JSON.stringify({ movie, rating }),
  });
}

export function updateRating(imdbID, rating) {
  return apiFetch(`/watched/${imdbID}/rating`, {
    method: 'PATCH',
    body: JSON.stringify({ rating }),
  });
}

export function removeFromWatched(imdbID) {
  return apiFetch(`/watched/${imdbID}`, { method: 'DELETE' });
}

export function createShare(type) {
  return apiFetch('/share', { method: 'POST', body: JSON.stringify({ type }) });
}

export function getShare(id) {
  return apiFetch(`/share/${id}`);
}

export function checkHealth() {
  return apiFetch('/health');
}
