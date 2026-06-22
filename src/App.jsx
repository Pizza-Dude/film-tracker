import { useCallback, useEffect, useMemo, useState } from 'react';
import { MovieCard } from './components/MovieCard.jsx';
import * as api from './api.js';

const TABS = [
  { id: 'search', label: 'Suche' },
  { id: 'watchlist', label: 'Merkliste' },
  { id: 'watched', label: 'Gesehen' },
];

function RatingModal({ movie, onConfirm, onCancel }) {
  const [rating, setRating] = useState(4);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Als gesehen markieren</h2>
        <p>
          <strong>{movie.Title}</strong> ({movie.Year})
        </p>
        <p className="modal__label">Deine Bewertung:</p>
        <div className="modal__stars">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              className={`star star--lg ${s <= rating ? 'star--filled' : ''}`}
              onClick={() => setRating(s)}
            >
              ★
            </button>
          ))}
        </div>
        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Abbrechen
          </button>
          <button className="btn btn--primary" onClick={() => onConfirm(rating)}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareBanner({ shareId, type, onClose }) {
  const url = `${window.location.origin}${window.location.pathname}?share=${shareId}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
  };

  return (
    <div className="share-banner">
      <div>
        <strong>Link erstellt!</strong> Teile deine{' '}
        {type === 'watched' ? 'Gesehen-Liste' : 'Merkliste'}:
        <code className="share-banner__url">{url}</code>
      </div>
      <div className="share-banner__actions">
        <button className="btn btn--secondary btn--sm" onClick={copyLink}>
          Link kopieren
        </button>
        <button className="btn btn--ghost btn--sm" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [watched, setWatched] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiReady, setApiReady] = useState(true);
  const [ratingModal, setRatingModal] = useState(null);
  const [shareInfo, setShareInfo] = useState(null);
  const [sharedView, setSharedView] = useState(null);

  const watchlistIds = useMemo(() => new Set(watchlist.map((m) => m.imdbID)), [watchlist]);
  const watchedIds = useMemo(() => new Set(watched.map((m) => m.imdbID)), [watched]);
  const watchedRatings = useMemo(
    () => Object.fromEntries(watched.map((m) => [m.imdbID, m.rating])),
    [watched],
  );

  const loadLists = useCallback(async () => {
    try {
      const [wl, wd] = await Promise.all([api.getWatchlist(), api.getWatched()]);
      setWatchlist(wl);
      setWatched(wd);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    api.checkHealth().then((h) => setApiReady(h.omdbConfigured)).catch(() => setApiReady(false));
    loadLists();

    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
      api
        .getShare(shareId)
        .then((share) => setSharedView(share))
        .catch((e) => setError(e.message));
    }
  }, [loadLists]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.searchMovies(query);
      setSearchResults(data.results);
      if (data.results.length === 0) setError('Keine Filme gefunden.');
    } catch (err) {
      setError(err.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWatchlist = async (movie) => {
    try {
      const updated = await api.addToWatchlist(movie);
      setWatchlist(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveWatchlist = async (imdbID) => {
    try {
      const updated = await api.removeFromWatchlist(imdbID);
      setWatchlist(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMarkWatched = (movie) => {
    setRatingModal(movie);
  };

  const confirmWatched = async (rating) => {
    if (!ratingModal) return;
    try {
      const updated = await api.markAsWatched(ratingModal, rating);
      setWatched(updated);
      setWatchlist((prev) => prev.filter((m) => m.imdbID !== ratingModal.imdbID));
      setRatingModal(null);
      setTab('watched');
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUpdateRating = async (imdbID, rating) => {
    try {
      await api.updateRating(imdbID, rating);
      setWatched((prev) => prev.map((m) => (m.imdbID === imdbID ? { ...m, rating } : m)));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveWatched = async (imdbID) => {
    try {
      const updated = await api.removeFromWatched(imdbID);
      setWatched(updated);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleShare = async (type) => {
    try {
      const share = await api.createShare(type);
      setShareInfo({ id: share.id, type: share.type });
    } catch (e) {
      setError(e.message);
    }
  };

  const currentMovies =
    tab === 'search'
      ? searchResults
      : tab === 'watchlist'
        ? watchlist
        : watched;

  const showRating = tab === 'watched';

  if (sharedView) {
    return (
      <div className="app">
        <header className="header">
          <div className="header__brand">
            <span className="header__icon">🎬</span>
            <h1>Filme</h1>
          </div>
          <p className="header__subtitle">
            Geteilte {sharedView.type === 'watched' ? 'Gesehen-Liste' : 'Merkliste'}
          </p>
        </header>
        <main className="main">
          <div className="movie-grid">
            {sharedView.items.map((movie) => (
              <article key={movie.imdbID} className="movie-card movie-card--readonly">
                <div className="movie-card__poster">
                  {movie.Poster ? (
                    <img src={movie.Poster} alt={movie.Title} />
                  ) : (
                    <div className="movie-card__placeholder">🎬</div>
                  )}
                </div>
                <div className="movie-card__body">
                  <h3 className="movie-card__title">{movie.Title}</h3>
                  <p className="movie-card__meta">{movie.Year}</p>
                  {movie.rating && (
                    <p className="movie-card__rating">{'★'.repeat(movie.rating)}{'☆'.repeat(5 - movie.rating)}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
          <button
            className="btn btn--primary"
            style={{ marginTop: '2rem' }}
            onClick={() => {
              window.history.replaceState({}, '', window.location.pathname);
              setSharedView(null);
            }}
          >
            Zur App
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__icon">🎬</span>
          <div>
            <h1>Filme</h1>
            <p className="header__subtitle">Filme suchen, merken und bewerten</p>
          </div>
        </div>
      </header>

      {!apiReady && (
        <div className="alert alert--warning">
          OMDB API-Key fehlt. Erstelle eine <code>.env</code> Datei mit{' '}
          <code>OMDB_API_KEY=dein_key</code> (kostenlos auf{' '}
          <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer">
            omdbapi.com
          </a>
          ).
        </div>
      )}

      {error && (
        <div className="alert alert--error">
          {error}
          <button className="alert__close" onClick={() => setError('')}>×</button>
        </div>
      )}

      {shareInfo && (
        <ShareBanner
          shareId={shareInfo.id}
          type={shareInfo.type}
          onClose={() => setShareInfo(null)}
        />
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tabs__btn ${tab === t.id ? 'tabs__btn--active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setError('');
              if (t.id !== 'search') {
                setSearchResults([]);
                setQuery('');
              }
            }}
          >
            {t.label}
            {t.id === 'watchlist' && watchlist.length > 0 && (
              <span className="tabs__badge">{watchlist.length}</span>
            )}
            {t.id === 'watched' && watched.length > 0 && (
              <span className="tabs__badge">{watched.length}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="main">
        {tab === 'search' && (
          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="search"
              className="search-form__input"
              placeholder="Film suchen… (z.B. Inception)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? 'Suche…' : 'Suchen'}
            </button>
          </form>
        )}

        {(tab === 'watchlist' || tab === 'watched') && currentMovies.length > 0 && (
          <div className="list-toolbar">
            <span>{currentMovies.length} Film{currentMovies.length !== 1 ? 'e' : ''}</span>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => handleShare(tab === 'watched' ? 'watched' : 'watchlist')}
            >
              Teilen
            </button>
          </div>
        )}

        {tab !== 'search' && currentMovies.length === 0 && (
          <div className="empty-state">
            <p>{tab === 'watchlist' ? 'Deine Merkliste ist leer.' : 'Noch keine gesehenen Filme.'}</p>
            <button className="btn btn--secondary" onClick={() => setTab('search')}>
              Filme suchen
            </button>
          </div>
        )}

        <div className="movie-grid">
          {currentMovies.map((movie) => (
            <MovieCard
              key={movie.imdbID}
              movie={movie}
              watchlistIds={watchlistIds}
              watchedIds={watchedIds}
              onAddWatchlist={handleAddWatchlist}
              onRemoveWatchlist={handleRemoveWatchlist}
              onMarkWatched={handleMarkWatched}
              onRemoveWatched={handleRemoveWatched}
              onUpdateRating={handleUpdateRating}
              showRating={showRating}
              rating={watchedRatings[movie.imdbID]}
              context={tab}
            />
          ))}
        </div>
      </main>

      {ratingModal && (
        <RatingModal
          movie={ratingModal}
          onConfirm={confirmWatched}
          onCancel={() => setRatingModal(null)}
        />
      )}
    </div>
  );
}
