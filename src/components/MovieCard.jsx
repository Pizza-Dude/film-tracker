export function StarRating({ value, onChange, readonly = false, size = 'md' }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className={`stars stars--${size}`} role="group" aria-label={`Bewertung: ${value} von 5`}>
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= value ? 'star--filled' : ''}`}
          disabled={readonly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} Stern${star > 1 ? 'e' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function MovieCard({
  movie,
  watchlistIds,
  watchedIds,
  onAddWatchlist,
  onRemoveWatchlist,
  onMarkWatched,
  onRemoveWatched,
  onUpdateRating,
  showRating = false,
  rating,
  context = 'search',
}) {
  const inWatchlist = watchlistIds.has(movie.imdbID);
  const inWatched = watchedIds.has(movie.imdbID);

  return (
    <article className="movie-card">
      <div className="movie-card__poster">
        {movie.Poster ? (
          <img src={movie.Poster} alt={movie.Title} loading="lazy" />
        ) : (
          <div className="movie-card__placeholder">🎬</div>
        )}
      </div>
      <div className="movie-card__body">
        <h3 className="movie-card__title">{movie.Title}</h3>
        <p className="movie-card__meta">
          {movie.Year}
          {movie.imdbRating && <span className="movie-card__imdb">IMDb {movie.imdbRating}</span>}
        </p>
        {movie.Plot && <p className="movie-card__plot">{movie.Plot}</p>}

        {showRating && (
          <StarRating
            value={rating || movie.rating || 0}
            onChange={(r) => onUpdateRating?.(movie.imdbID, r)}
          />
        )}

        <div className="movie-card__actions">
          {context === 'search' && !inWatched && !inWatchlist && (
            <>
              <button className="btn btn--secondary" onClick={() => onAddWatchlist(movie)}>
                + Merken
              </button>
              <button className="btn btn--primary" onClick={() => onMarkWatched(movie)}>
                + Gesehen
              </button>
            </>
          )}
          {context === 'search' && inWatchlist && !inWatched && (
            <>
              <button className="btn btn--primary" onClick={() => onMarkWatched(movie)}>
                + Gesehen
              </button>
              <button className="btn btn--ghost" onClick={() => onRemoveWatchlist(movie.imdbID)}>
                Entfernen
              </button>
            </>
          )}
          {context === 'search' && inWatched && (
            <>
              <span className="movie-card__status">Bereits gesehen</span>
              <button className="btn btn--ghost" onClick={() => onRemoveWatched(movie.imdbID)}>
                Entfernen
              </button>
            </>
          )}
          {context === 'watchlist' && inWatchlist && !inWatched && (
            <>
              <button className="btn btn--primary" onClick={() => onMarkWatched(movie)}>
                Als gesehen
              </button>
              <button className="btn btn--ghost" onClick={() => onRemoveWatchlist(movie.imdbID)}>
                Entfernen
              </button>
            </>
          )}
          {context === 'watched' && inWatched && (
            <button className="btn btn--ghost" onClick={() => onRemoveWatched(movie.imdbID)}>
              Aus Gesehen entfernen
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
