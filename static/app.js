const LS_USER = 'film-last-user-id';

const state = {
  tab: 'search',
  query: '',
  listFilter: '',
  watchedRatingFilter: 0,
  discoverSubTab: 'trending',
  discoverMovies: [],
  searchResults: [],
  watchlist: [],
  watched: [],
  users: [],
  currentUserId: null,
  settings: {},
  settingsForm: {},
  loading: false,
  discoverLoading: false,
  error: '',
  success: '',
  searchReady: false,
  tmdbReady: false,
  ratingModal: null,
  detailModal: null,
  shareInfo: null,
  sharedView: null,
  serverBackups: [],
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.currentUserId) headers['X-User-Id'] = state.currentUserId;
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen');
  return data;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function unknownGenre() {
  return t('unknown');
}

function getGenres(movie) {
  if (movie.Genre) return movie.Genre.split(',').map((g) => g.trim()).filter(Boolean);
  return [unknownGenre()];
}

function filterList(movies, query) {
  if (!query.trim()) return movies;
  const q = query.trim().toLowerCase();
  return movies.filter((m) => {
    const genreStr = getGenres(m).join(' ').toLowerCase();
    return (m.Title || '').toLowerCase().includes(q) || String(m.Year || '').includes(q) || genreStr.includes(q);
  });
}

function filterWatchedList(movies, query, ratingFilter) {
  let list = filterList(movies, query);
  const stars = Number(ratingFilter);
  if (stars >= 1 && stars <= 5) {
    list = list.filter((m) => Number(m.rating) === stars);
  }
  return list;
}

function watchedRatingFilterHtml() {
  const options = [
    { value: 0, label: t('allRatings') },
    ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: '★'.repeat(n) })),
  ];
  return `<div class="rating-filter" role="group" aria-label="${t('filterByRating')}">
    ${options.map(({ value, label }) => `
      <button type="button" class="rating-filter__btn ${state.watchedRatingFilter === value ? 'rating-filter__btn--active' : ''}"
        data-rating-filter="${value}">${label}</button>`).join('')}
  </div>`;
}

function groupByGenre(movies) {
  const groups = {};
  for (const movie of movies) {
    const primary = getGenres(movie)[0] || unknownGenre();
    if (!groups[primary]) groups[primary] = [];
    groups[primary].push(movie);
  }
  const loc = currentLang === 'en' ? 'en' : 'de';
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, loc));
}

function starsHtml(value, interactive, imdbID) {
  return [1, 2, 3, 4, 5]
    .map((s) => `<button type="button" class="star ${s <= value ? 'star--filled' : ''}" ${interactive ? `data-rate="${s}" data-imdb="${imdbID}"` : 'disabled'}>★</button>`)
    .join('');
}

function streamUrl() {
  return (state.settings.streamUrl || state.settingsForm.streamUrl || '').trim();
}

function streamLabel() {
  return state.settings.streamLabel || state.settingsForm.streamLabel || t('streamDefaultLabel');
}

function currentUser() {
  return state.users.find((u) => u.id === state.currentUserId) || null;
}

function isReadOnlyUser() {
  return Boolean(currentUser()?.readOnly);
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadBackupFile(filename) {
  const res = await fetch(`/api/backup/download/${encodeURIComponent(filename)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Download fehlgeschlagen');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function streamButtonHtml() {
  const url = streamUrl();
  if (!url) return '';
  return `<div class="stream-bar"><a class="btn btn--stream" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(streamLabel())}</a></div>`;
}

function movieCard(movie, opts = {}) {
  const { watchlistIds, watchedIds, showRating, rating, context = 'search', readOnly = false } = opts;
  const inWatchlist = watchlistIds.has(movie.imdbID);
  const inWatched = watchedIds.has(movie.imdbID);
  const genres = getGenres(movie);

  let actions = '';
  if (!readOnly) {
    if (context === 'search' || context === 'discover') {
      if (!inWatched && !inWatchlist) {
        actions = `<button class="btn btn--secondary" data-action="watchlist" data-imdb="${movie.imdbID}">${t('addRemember')}</button>
          <button class="btn btn--primary" data-action="watched" data-imdb="${movie.imdbID}">${t('addWatched')}</button>`;
      } else if (inWatchlist && !inWatched) {
        actions = `<button class="btn btn--primary" data-action="watched" data-imdb="${movie.imdbID}">${t('addWatched')}</button>
          <button class="btn btn--ghost" data-action="remove-watchlist" data-imdb="${movie.imdbID}">${t('remove')}</button>`;
      } else if (inWatched) {
        actions = `<span class="movie-card__status">${t('alreadyWatched')}</span>
          <button class="btn btn--ghost" data-action="remove-watched" data-imdb="${movie.imdbID}">${t('remove')}</button>`;
      }
    } else if (context === 'watchlist' && inWatchlist && !inWatched) {
      actions = `<button class="btn btn--primary" data-action="watched" data-imdb="${movie.imdbID}">${t('markWatched')}</button>
        <button class="btn btn--ghost" data-action="remove-watchlist" data-imdb="${movie.imdbID}">${t('remove')}</button>`;
    } else if (context === 'watched' && inWatched) {
      actions = `<button class="btn btn--ghost" data-action="remove-watched" data-imdb="${movie.imdbID}">${t('removeWatched')}</button>`;
    }
  }

  const poster = movie.Poster
    ? `<img src="${esc(movie.Poster)}" alt="${esc(movie.Title)}" loading="lazy" />`
    : `<div class="movie-card__placeholder">🎬</div>`;

  return `<article class="movie-card movie-card--clickable" data-imdb="${movie.imdbID}" data-open-details>
    <div class="movie-card__poster">${poster}</div>
    <div class="movie-card__body">
      <h3 class="movie-card__title">${esc(movie.Title)}</h3>
      <p class="movie-card__meta">${esc(movie.Year || '')}
        ${movie.imdbRating ? `<span class="movie-card__imdb">IMDb ${esc(movie.imdbRating)}</span>` : ''}
        ${movie.tmdbRating ? `<span class="movie-card__tmdb">TMDB ${esc(String(movie.tmdbRating))}</span>` : ''}
      </p>
      ${genres[0] !== unknownGenre() ? `<p class="movie-card__genre">${esc(genres.join(', '))}</p>` : ''}
      ${movie.Plot ? `<p class="movie-card__plot">${esc(movie.Plot)}</p>` : ''}
      ${showRating && !readOnly ? `<div class="stars">${starsHtml(rating || movie.rating || 0, true, movie.imdbID)}</div>` : ''}
      <div class="movie-card__actions">${actions}</div>
    </div>
  </article>`;
}

function renderMovieGrid(movies, opts) {
  return movies.length ? `<div class="movie-grid">${movies.map((m) => movieCard(m, opts)).join('')}</div>` : '';
}

function renderGroupedLists(movies, opts) {
  const groups = groupByGenre(movies);
  if (!groups.length) return `<div class="empty-state"><p>${t('noResults')}</p></div>`;
  return groups.map(([genre, items]) => `
    <section class="genre-section">
      <h2 class="genre-section__title">${esc(genre)} <span class="genre-section__count">${items.length}</span></h2>
      ${renderMovieGrid(items, opts)}
    </section>`).join('');
}

function detailModalHtml(d) {
  if (!d) return '';
  const cast = (d.cast || []).map((c) => `<li><strong>${esc(c.name)}</strong>${c.character ? ` – ${esc(c.character)}` : ''}</li>`).join('');
  const crew = (d.crew || []).map((c) => `<li><strong>${esc(c.job)}:</strong> ${esc(c.name)}</li>`).join('');
  const actors = d.Actors ? d.Actors.split(',').map((a) => `<li>${esc(a.trim())}</li>`).join('') : cast;

  return `<div class="modal-overlay modal-overlay--detail" id="detail-overlay">
    <div class="modal modal--detail">
      <button class="modal__close" id="detail-close" aria-label="${t('close')}">×</button>
      <div class="detail">
        <div class="detail__poster">${d.Poster ? `<img src="${esc(d.Poster)}" alt="${esc(d.Title)}" />` : '<div class="movie-card__placeholder">🎬</div>'}</div>
        <div class="detail__content">
          <h2>${esc(d.Title)}</h2>
          <div class="detail__ratings">
            ${d.imdbRating ? `<span class="badge">IMDb ${esc(d.imdbRating)}</span>` : ''}
            ${d.tmdbRating ? `<span class="badge badge--tmdb">TMDB ${esc(String(d.tmdbRating))}</span>` : ''}
            ${d.userRating ? `<span class="badge badge--user">${t('yourStars')} ${'★'.repeat(d.userRating)}</span>` : ''}
          </div>
          <dl class="detail__meta">
            ${d.Released ? `<div><dt>${t('releaseDate')}</dt><dd>${esc(d.Released)}</dd></div>` : ''}
            ${d.Runtime ? `<div><dt>${t('runtime')}</dt><dd>${esc(d.Runtime)}</dd></div>` : ''}
            ${d.Genre ? `<div><dt>${t('genre')}</dt><dd>${esc(d.Genre)}</dd></div>` : ''}
            ${d.Director ? `<div><dt>${t('director')}</dt><dd>${esc(d.Director)}</dd></div>` : ''}
          </dl>
          ${d.Plot ? `<div class="detail__section"><h3>${t('description')}</h3><p>${esc(d.Plot)}</p></div>` : ''}
          ${actors ? `<div class="detail__section"><h3>${t('cast')}</h3><ul class="detail__list">${actors}</ul></div>` : ''}
          ${crew ? `<div class="detail__section"><h3>${t('crew')}</h3><ul class="detail__list">${crew}</ul></div>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function settingsHtml() {
  const sf = state.settingsForm;
  return `<div class="settings">
    <section class="settings__section">
      <h2>${t('settingsTitle')}</h2>
      <p class="settings__hint"><button class="btn btn--ghost btn--sm" data-tab="help">${t('tabHelp')} →</button></p>
      <h3 class="settings__subtitle">${t('settingsApi')}</h3>
      <p class="settings__hint">${t('settingsApiHint')}</p>
      <label class="settings__label">${t('omdbKey')}</label>
      <input class="search-form__input" id="set-omdb" type="password" placeholder="${sf.omdbApiKey === '***' ? '••••••••' : ''}" value="${sf.omdbApiKey === '***' ? '' : esc(sf.omdbApiKey || '')}" />
      <label class="settings__label">${t('tmdbToken')}</label>
      <input class="search-form__input" id="set-tmdb" type="password" placeholder="${sf.tmdbApiToken === '***' ? '••••••••' : ''}" value="${sf.tmdbApiToken === '***' ? '' : esc(sf.tmdbApiToken || '')}" />
      <label class="settings__label">${t('settingsLanguage')}</label>
      <select class="search-form__input" id="set-lang">
        <option value="de" ${sf.language === 'de' ? 'selected' : ''}>${t('langDe')}</option>
        <option value="en" ${sf.language === 'en' ? 'selected' : ''}>${t('langEn')}</option>
      </select>
      <label class="settings__check"><input type="checkbox" id="set-autobackup" ${sf.autoBackup ? 'checked' : ''} /> ${t('autoBackup')}</label>
      <button class="btn btn--primary" id="save-settings">${t('saveSettings')}</button>
    </section>
    <section class="settings__section">
      <h2>${t('settingsUsers')}</h2>
      <p class="settings__hint">${t('settingsUsersHint')}</p>
      <ul class="settings__users">${state.users.map((u) => `
        <li><span>${esc(u.name)}${u.readOnly ? ` <em class="settings__badge">${t('readOnlyProfile')}</em>` : ''}</span>
          ${!u.readOnly && state.users.length > 1 ? `<button class="btn btn--ghost btn--sm" data-delete-user="${u.id}">${t('deleteUser')}</button>` : ''}
        </li>`).join('')}
      </ul>
      <div class="settings__add-user">
        <input class="search-form__input" id="new-user-name" placeholder="${t('userName')}" />
        <button class="btn btn--secondary" id="add-user">${t('addUser')}</button>
      </div>
    </section>
    <section class="settings__section">
      <h2>${t('settingsStream')}</h2>
      <p class="settings__hint">${t('settingsStreamHint')}</p>
      <label class="settings__label">${t('streamUrl')}</label>
      <input class="search-form__input" id="set-stream-url" value="${esc(sf.streamUrl || '')}" placeholder="https://jellyfin.example.com/web/index.html" />
      <label class="settings__label">${t('streamLabel')}</label>
      <input class="search-form__input" id="set-stream-label" value="${esc(sf.streamLabel || t('streamDefaultLabel'))}" placeholder="${t('streamDefaultLabel')}" />
    </section>
    <section class="settings__section">
      <h2>${t('settingsBackup')}</h2>
      <p class="settings__hint">${t('backupHint')}</p>
      <p>${t('lastBackup')}: ${state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).toLocaleString(currentLang === 'en' ? 'en' : 'de') : t('never')}</p>
      <div class="settings__backup-actions">
        <button class="btn btn--secondary" id="backup-now">${t('backupNow')}</button>
        <label class="btn btn--ghost btn--file">${t('restore')}<input type="file" id="restore-file" accept=".json" hidden /></label>
      </div>
      ${state.serverBackups.length ? `<h3 class="settings__subtitle">${t('serverBackups')}</h3>
        <ul class="settings__backups">${state.serverBackups.map((b) => `
          <li><span><code>${esc(b.filename)}</code> · ${formatBytes(b.size)}</span>
            <button class="btn btn--ghost btn--sm" data-download-backup="${esc(b.filename)}">${t('downloadBackup')}</button>
          </li>`).join('')}</ul>` : ''}
    </section>
  </div>`;
}

function goHome() {
  state.tab = 'search';
  state.error = '';
  state.success = '';
  state.listFilter = '';
  state.watchedRatingFilter = 0;
  render();
}

function headerHtml() {
  return `<header class="header">
    <button type="button" class="header__brand" id="go-home" title="${t('appTitle')}">
      <span class="header__icon">🎬</span>
      <div><h1>${t('appTitle')}</h1><p class="header__subtitle">${t('appSubtitle')}</p></div>
    </button>
    <div class="header__actions">
      ${state.users.length ? `<select class="header__user-select" id="user-select" title="${t('selectUser')}">
        ${state.users.map((u) => `<option value="${u.id}" ${u.id === state.currentUserId ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
      </select>` : ''}
      <button class="btn btn--ghost btn--icon ${state.tab === 'help' ? 'btn--active' : ''}" data-tab="help" title="${t('tabHelp')}">?</button>
      <button class="btn btn--ghost btn--icon ${state.tab === 'settings' ? 'btn--active' : ''}" data-tab="settings" title="${t('tabSettings')}">⚙</button>
    </div>
  </header>`;
}

function findMovie(imdbID) {
  return state.searchResults.find((m) => m.imdbID === imdbID)
    || state.discoverMovies.find((m) => m.imdbID === imdbID)
    || state.watchlist.find((m) => m.imdbID === imdbID)
    || state.watched.find((m) => m.imdbID === imdbID)
    || (state.detailModal?.imdbID === imdbID ? state.detailModal : null);
}

async function loadUserLists() {
  [state.watchlist, state.watched] = await Promise.all([api('/watchlist'), api('/watched')]);
}

async function loadServerBackups() {
  try {
    const data = await api('/backups');
    state.serverBackups = data.backups || [];
    if (data.lastBackupAt) state.settings.lastBackupAt = data.lastBackupAt;
  } catch {
    state.serverBackups = [];
  }
}

async function switchUser(userId) {
  state.currentUserId = userId;
  localStorage.setItem(LS_USER, userId);
  await loadUserLists();
  render();
}

async function loadDiscover() {
  state.discoverLoading = true;
  render();
  try {
    const endpoint = state.discoverSubTab === 'upcoming' ? '/tmdb/upcoming' : '/tmdb/trending';
    state.discoverMovies = (await api(endpoint)).results;
  } catch (e) {
    state.error = e.message;
    state.discoverMovies = [];
  } finally {
    state.discoverLoading = false;
    render();
  }
}

async function openDetails(imdbID) {
  state.detailModal = { imdbID, Title: t('loading') };
  render();
  try {
    state.detailModal = await api(`/movie/${imdbID}/details`);
  } catch (e) {
    state.error = e.message;
    state.detailModal = null;
  }
  render();
}

function render() {
  const app = document.getElementById('app');
  const watchlistIds = new Set(state.watchlist.map((m) => m.imdbID));
  const watchedIds = new Set(state.watched.map((m) => m.imdbID));
  const ratings = Object.fromEntries(state.watched.map((m) => [m.imdbID, m.rating]));
  const readOnly = isReadOnlyUser();
  const cardOpts = { watchlistIds, watchedIds, context: state.tab, readOnly };
  const tabs = ['search', 'discover', 'watchlist', 'watched'];
  const tabLabels = { search: t('tabSearch'), discover: t('tabDiscover'), watchlist: t('tabWatchlist'), watched: t('tabWatched') };

  if (state.sharedView) {
    const sv = state.sharedView;
    app.innerHTML = `<div class="app">${headerHtml()}
      <main class="main">${renderGroupedLists(sv.items, { ...cardOpts, showRating: sv.type === 'watched', context: sv.type })}</main>
      <button class="btn btn--primary back-btn" id="back-to-app">${t('backToApp')}</button>
      ${state.detailModal ? detailModalHtml(state.detailModal) : ''}</div>`;
    document.getElementById('back-to-app')?.addEventListener('click', () => { history.replaceState({}, '', location.pathname); state.sharedView = null; render(); });
    bindEvents();
    return;
  }

  let mainContent = '';
  if (state.tab === 'settings') {
    mainContent = settingsHtml();
  } else if (state.tab === 'help') {
    mainContent = helpHtml();
  } else if (state.tab === 'search') {
    mainContent = `${streamButtonHtml()}<form class="search-form" id="search-form">
      <input class="search-form__input" type="search" placeholder="${t('searchPlaceholder')}" value="${esc(state.query)}" id="search-input" />
      <button type="submit" class="btn btn--primary" ${state.loading ? 'disabled' : ''}>${state.loading ? t('searching') : t('searchBtn')}</button>
    </form>${state.searchResults.length ? renderMovieGrid(state.searchResults, { ...cardOpts, context: 'search' }) : ''}`;
  } else if (state.tab === 'watchlist' || state.tab === 'watched') {
    const raw = state.tab === 'watchlist' ? state.watchlist : state.watched;
    const filtered = state.tab === 'watched'
      ? filterWatchedList(raw, state.listFilter, state.watchedRatingFilter)
      : filterList(raw, state.listFilter);
    const emptyFilteredMsg = state.tab === 'watched' && state.watchedRatingFilter >= 1
      ? t('noRatingFilterResults', { n: state.watchedRatingFilter })
      : t('noFilterResults', { q: state.listFilter });
    mainContent = `${state.tab === 'watched' ? watchedRatingFilterHtml() : ''}<div class="list-filter">
      <input class="search-form__input" type="search" id="list-filter-input"
        placeholder="${state.tab === 'watchlist' ? t('filterWatchlist') : t('filterWatched')}" value="${esc(state.listFilter)}" />
    </div>${filtered.length > 0 ? `<div class="list-toolbar">
      <span>${t('filmsCount', { n: filtered.length, total: raw.length })}</span>
      ${readOnly ? '' : `<button class="btn btn--secondary btn--sm" id="share-btn">${t('share')}</button>`}
    </div>${renderGroupedLists(filtered, { ...cardOpts, showRating: state.tab === 'watched' })}`
      : raw.length === 0 ? `<div class="empty-state"><p>${readOnly ? t('defaultProfileReadOnly') : (state.tab === 'watchlist' ? t('emptyWatchlist') : t('emptyWatched'))}</p>
        ${readOnly ? `<button class="btn btn--secondary" data-tab="settings">${t('openSettings')}</button>` : `<button class="btn btn--secondary" data-tab="search">${t('searchMovies')}</button>`}</div>`
      : `<div class="empty-state"><p>${emptyFilteredMsg}</p></div>`}`;
  } else if (state.tab === 'discover') {
    mainContent = `<nav class="subtabs">
      <button class="subtabs__btn ${state.discoverSubTab === 'trending' ? 'subtabs__btn--active' : ''}" data-discover="trending">${t('trending')}</button>
      <button class="subtabs__btn ${state.discoverSubTab === 'upcoming' ? 'subtabs__btn--active' : ''}" data-discover="upcoming">${t('upcoming')}</button>
    </nav>${state.discoverLoading ? `<p class="loading-text">${t('loading')}</p>` : ''}
    ${!state.discoverLoading && state.discoverMovies.length ? renderMovieGrid(state.discoverMovies, { ...cardOpts, context: 'discover' }) : ''}
    ${!state.discoverLoading && !state.discoverMovies.length && state.tmdbReady ? `<div class="empty-state"><p>${t('noResults')}</p></div>` : ''}`;
  }

  app.innerHTML = `<div class="app">
    ${headerHtml()}
    ${!state.searchReady ? `<div class="alert alert--warning">${t('apiMissing')}</div>` : ''}
    ${readOnly && state.tab !== 'settings' && state.tab !== 'help' ? `<div class="alert alert--warning">${t('defaultProfileReadOnly')}</div>` : ''}
    ${state.tab === 'discover' && !state.tmdbReady ? `<div class="alert alert--warning">${t('tmdbMissing')}</div>` : ''}
    ${state.error ? `<div class="alert alert--error">${esc(state.error)}<button class="alert__close" id="clear-error">×</button></div>` : ''}
    ${state.success ? `<div class="alert alert--success">${esc(state.success)}<button class="alert__close" id="clear-success">×</button></div>` : ''}
    ${state.shareInfo ? `<div class="share-banner"><div><strong>${t('shareLink')}</strong>
      <code class="share-banner__url">${esc(`${location.origin}${location.pathname}?share=${state.shareInfo.id}`)}</code></div>
      <div class="share-banner__actions">
        <button class="btn btn--secondary btn--sm" id="copy-share">${t('copyLink')}</button>
        <button class="btn btn--ghost btn--sm" id="close-share">${t('close')}</button>
      </div></div>` : ''}
    ${state.tab !== 'settings' && state.tab !== 'help' ? `<nav class="tabs">${tabs.map((id) => {
      const count = id === 'watchlist' ? state.watchlist.length : id === 'watched' ? state.watched.length : 0;
      return `<button class="tabs__btn ${state.tab === id ? 'tabs__btn--active' : ''}" data-tab="${id}">${tabLabels[id]}${count ? `<span class="tabs__badge">${count}</span>` : ''}</button>`;
    }).join('')}</nav>` : ''}
    <main class="main">${mainContent}</main>
    ${state.ratingModal ? `<div class="modal-overlay" id="modal-overlay"><div class="modal">
      <h2>${t('rateTitle')}</h2>
      <p><strong>${esc(state.ratingModal.Title)}</strong> (${esc(state.ratingModal.Year || '')})</p>
      <p>${t('yourRating')}</p>
      <div class="modal__stars" id="modal-stars">${starsHtml(state.ratingModal._tempRating || 4, true, 'modal')}</div>
      <div class="modal__actions">
        <button class="btn btn--ghost" id="modal-cancel">${t('cancel')}</button>
        <button class="btn btn--primary" id="modal-save">${t('save')}</button>
      </div></div></div>` : ''}
    ${state.detailModal ? detailModalHtml(state.detailModal) : ''}
  </div>`;

  bindEvents();
}

function bindEvents() {
  document.getElementById('detail-close')?.addEventListener('click', () => { state.detailModal = null; render(); });
  document.getElementById('detail-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'detail-overlay') { state.detailModal = null; render(); }
  });

  document.getElementById('go-home')?.addEventListener('click', goHome);

  document.getElementById('user-select')?.addEventListener('change', (e) => switchUser(e.target.value));

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.tab = btn.dataset.tab;
      state.error = '';
      state.listFilter = '';
      if (state.tab !== 'watched') state.watchedRatingFilter = 0;
      if (state.tab === 'settings') {
        const s = await api('/settings');
        state.settings = s;
        state.settingsForm = { ...s };
        await loadServerBackups();
        render();
      } else if (state.tab === 'help') {
        render();
      } else {
        if (state.tab !== 'search') { state.searchResults = []; state.query = ''; }
        if (state.tab === 'discover' && !state.discoverMovies.length) loadDiscover();
        else render();
      }
    });
  });

  document.querySelectorAll('[data-discover]').forEach((btn) => {
    btn.addEventListener('click', () => { state.discoverSubTab = btn.dataset.discover; loadDiscover(); });
  });

  document.querySelectorAll('[data-rating-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.watchedRatingFilter = Number(btn.dataset.ratingFilter);
      render();
    });
  });

  document.getElementById('list-filter-input')?.addEventListener('input', (e) => {
    state.listFilter = e.target.value;
    render();
    const input = document.getElementById('list-filter-input');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  });

  document.getElementById('clear-error')?.addEventListener('click', () => { state.error = ''; render(); });
  document.getElementById('clear-success')?.addEventListener('click', () => { state.success = ''; render(); });

  document.getElementById('search-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    state.query = document.getElementById('search-input').value.trim();
    if (!state.query) return;
    state.loading = true; state.error = ''; render();
    try {
      const data = await api(`/search?q=${encodeURIComponent(state.query)}`);
      state.searchResults = data.results;
      if (!data.results.length) state.error = t('noResults');
    } catch (err) { state.error = err.message; state.searchResults = []; }
    finally { state.loading = false; render(); }
  });

  document.getElementById('share-btn')?.addEventListener('click', async () => {
    try {
      const type = state.tab === 'watched' ? 'watched' : 'watchlist';
      state.shareInfo = await api('/share', { method: 'POST', body: JSON.stringify({ type }) });
      render();
    } catch (e) { state.error = e.message; render(); }
  });

  document.getElementById('copy-share')?.addEventListener('click', () => {
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?share=${state.shareInfo.id}`);
  });
  document.getElementById('close-share')?.addEventListener('click', () => { state.shareInfo = null; render(); });

  document.getElementById('save-settings')?.addEventListener('click', async () => {
    const omdb = document.getElementById('set-omdb').value.trim();
    const tmdb = document.getElementById('set-tmdb').value.trim();
    const lang = document.getElementById('set-lang').value;
    const autoBackup = document.getElementById('set-autobackup').checked;
    const streamUrlVal = document.getElementById('set-stream-url')?.value.trim();
    const streamLabelVal = document.getElementById('set-stream-label')?.value.trim();
    const body = { language: lang, autoBackup, streamUrl: streamUrlVal, streamLabel: streamLabelVal };
    if (omdb) body.omdbApiKey = omdb;
    if (tmdb) body.tmdbApiToken = tmdb;
    try {
      await api('/settings', { method: 'PATCH', body: JSON.stringify(body) });
      setLang(lang);
      state.success = t('saveSettings');
      const health = await api('/health');
      state.searchReady = health.searchReady;
      state.tmdbReady = health.tmdbConfigured;
      const s = await api('/settings');
      state.settings = s;
      state.settingsForm = { ...s };
      render();
    } catch (e) { state.error = e.message; render(); }
  });

  document.getElementById('add-user')?.addEventListener('click', async () => {
    const name = document.getElementById('new-user-name').value.trim();
    if (!name) return;
    try {
      state.users = await api('/users', { method: 'POST', body: JSON.stringify({ name }) });
      document.getElementById('new-user-name').value = '';
      await switchUser(state.users[state.users.length - 1].id);
    } catch (e) { state.error = e.message; render(); }
  });

  document.querySelectorAll('[data-delete-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        state.users = await api(`/users/${btn.dataset.deleteUser}`, { method: 'DELETE' });
        if (state.currentUserId === btn.dataset.deleteUser) {
          state.currentUserId = state.users[0].id;
          localStorage.setItem(LS_USER, state.currentUserId);
        }
        await loadUserLists();
        render();
      } catch (e) { state.error = e.message; render(); }
    });
  });

  document.getElementById('backup-now')?.addEventListener('click', async () => {
    try {
      const info = await api('/backup');
      await downloadBackupFile(info.filename);
      await loadServerBackups();
      state.settings = await api('/settings');
      state.success = t('backupDownloadSuccess');
      render();
    } catch (e) { state.error = e.message; render(); }
  });

  document.querySelectorAll('[data-download-backup]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await downloadBackupFile(btn.dataset.downloadBackup);
        state.success = t('backupDownloaded');
        render();
      } catch (e) { state.error = e.message; render(); }
    });
  });

  document.getElementById('restore-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !confirm(t('restoreConfirm'))) return;
    try {
      const data = JSON.parse(await file.text());
      await api('/restore', { method: 'POST', body: JSON.stringify(data) });
      state.success = t('restoreSuccess');
      await init();
    } catch (err) { state.error = err.message; render(); }
  });

  document.querySelector('.main')?.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-open-details]');
    if (card && !e.target.closest('[data-action]') && !e.target.closest('.star')) {
      openDetails(card.dataset.imdb);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const imdbID = btn.dataset.imdb;
    const movie = findMovie(imdbID);
    if (!movie) return;
    try {
      if (btn.dataset.action === 'watchlist') state.watchlist = await api('/watchlist', { method: 'POST', body: JSON.stringify(movie) });
      else if (btn.dataset.action === 'remove-watchlist') state.watchlist = await api(`/watchlist/${imdbID}`, { method: 'DELETE' });
      else if (btn.dataset.action === 'watched') { state.ratingModal = { ...movie, _tempRating: 4 }; render(); return; }
      else if (btn.dataset.action === 'remove-watched') state.watched = await api(`/watched/${imdbID}`, { method: 'DELETE' });
      render();
    } catch (err) { state.error = err.message; render(); }
  });

  document.querySelector('.main')?.addEventListener('click', async (e) => {
    const star = e.target.closest('[data-rate]');
    if (!star || star.dataset.imdb === 'modal') return;
    const rating = Number(star.dataset.rate);
    try {
      await api(`/watched/${star.dataset.imdb}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) });
      state.watched = state.watched.map((m) => (m.imdbID === star.dataset.imdb ? { ...m, rating } : m));
      render();
    } catch (err) { state.error = err.message; render(); }
  });

  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay' || e.target.id === 'modal-cancel') { state.ratingModal = null; render(); }
  });
  document.getElementById('modal-stars')?.addEventListener('click', (e) => {
    const star = e.target.closest('[data-rate]');
    if (star) { state.ratingModal._tempRating = Number(star.dataset.rate); render(); }
  });
  document.getElementById('modal-save')?.addEventListener('click', async () => {
    const movie = { ...state.ratingModal };
    const rating = movie._tempRating || 4;
    delete movie._tempRating;
    try {
      state.watched = await api('/watched', { method: 'POST', body: JSON.stringify({ movie, rating }) });
      state.watchlist = state.watchlist.filter((m) => m.imdbID !== movie.imdbID);
      state.ratingModal = null;
      render();
    } catch (err) { state.error = err.message; render(); }
  });
}

async function init() {
  try {
    const health = await api('/health');
    state.searchReady = health.searchReady;
    state.tmdbReady = health.tmdbConfigured;
  } catch {
    state.searchReady = false;
    state.tmdbReady = false;
  }

  try {
    state.settings = await api('/settings');
    state.settingsForm = { ...state.settings };
    if (state.settings.language) setLang(state.settings.language);
    else setLang(localStorage.getItem('film-lang') || 'de');

    state.users = await api('/users');
    const savedUser = localStorage.getItem(LS_USER);
    state.currentUserId = state.users.find((u) => u.id === savedUser)?.id || state.users[0]?.id;
    if (state.currentUserId) localStorage.setItem(LS_USER, state.currentUserId);

    if (state.currentUserId) await loadUserLists();
  } catch (e) {
    state.error = e.message;
  }

  const shareId = new URLSearchParams(location.search).get('share');
  if (shareId) {
    try { state.sharedView = await api(`/share/${shareId}`); } catch (e) { state.error = e.message; }
  }

  render();
}

init();
