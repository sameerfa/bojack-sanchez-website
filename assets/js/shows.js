/**
 * Shows Module - Handles episode listing and player for show pages
 */

class ShowsManager {
  constructor() {
    this.episodes = [];
    this.currentEpisode = null;
    this.isPlaying = false;
    this.player = null;
    this.showSlug = null;
    this.rssSources = [];
    this.activeSourceRequestId = 0;
    this.pendingEpisodeSlug = null;
    this.init();
  }

  init() {
    const main = document.querySelector('main[data-show]');
    if (!main) return;

    this.showSlug = main.getAttribute('data-show');
    this.rssSources = this.getRssSources(this.showSlug);

    if (this.rssSources.length === 0) {
      console.error('No RSS sources found for show:', this.showSlug);
      return;
    }

    this.loadEpisodes();
    this.setupPlayer();
    this.handleDeepLink();
    
    // Ensure player is hidden on initial load (no episode selected)
    setTimeout(() => {
      this.ensurePlayerHidden();
    }, 100);
  }
  
  ensurePlayerHidden() {
    if (!this.currentEpisode) {
      this.isPlaying = false;
      this.syncEpisodePlaybackUi();
    }
  }

  getRssSources(showSlug) {
    const feeds = {
      'news-in-a-nutshell': {
        remoteUrl: 'https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/news-in-a-nutshell.rss',
        localUrl: '/assets/rss/news-in-a-nutshell.rss'
      },
      'kurz-und-klar': {
        remoteUrl: 'https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/kurz-und-klar.rss',
        localUrl: '/assets/rss/kurz-und-klar.rss'
      }
    };

    const feed = feeds[showSlug];
    if (!feed) return [];

    return [
      {
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.remoteUrl)}`,
        label: 'live proxy feed',
        cacheBust: true
      },
      {
        url: feed.localUrl,
        label: 'local fallback feed',
        cacheBust: true
      }
    ];
  }

  async loadEpisodes() {
    const container = document.getElementById('episodes-list');
    if (!container) return;

    try {
      const xmlContent = await this.fetchRssContent();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('XML parsing error');
      }
      
      const items = xmlDoc.querySelectorAll('item');

      this.episodes = Array.from(items).map(item => this.parseEpisode(item));
      this.episodes.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)); // Newest first

      // Load and display show image
      this.loadShowImage(xmlDoc);

      this.renderEpisodes();
      this.applyPendingEpisodeSelection();
    } catch (error) {
      console.error('Failed to load episodes:', error);
      container.innerHTML = '<div class="error">Failed to load episodes. Please try again later.</div>';
    }
  }

  async fetchRssContent() {
    const errors = [];

    for (const source of this.rssSources) {
      try {
        const requestUrl = source.cacheBust
          ? `${source.url}${source.url.includes('?') ? '&' : '?'}t=${Date.now()}`
          : source.url;

        const response = await fetch(requestUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Accept': 'application/xml, text/xml, */*'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const xmlContent = await response.text();
        if (!xmlContent.trim()) {
          throw new Error('Empty RSS response');
        }

        console.log(`Loaded RSS from ${source.label}`);
        return xmlContent;
      } catch (error) {
        console.warn(`Failed to load RSS from ${source.label}:`, error);
        errors.push(`${source.label}: ${error.message}`);
      }
    }

    throw new Error(errors.join(' | '));
  }

  parseEpisode(item) {
    const getTextContent = (selector) => {
      const element = item.querySelector(selector);
      return element ? element.textContent.trim() : '';
    };

    const getAttributeContent = (selector, attribute) => {
      const element = item.querySelector(selector);
      return element ? element.getAttribute(attribute) : '';
    };

    const title = getTextContent('title') || 'Untitled Episode';
    const description = getTextContent('description') || '';
    const pubDate = getTextContent('pubDate') || '';
    const duration = getTextContent('itunes\\:duration') || getTextContent('duration') || '00:02:00';
    const audioUrl = getAttributeContent('enclosure', 'url') || '';
    const episodeTimestamp = this.extractEpisodeTimestamp(audioUrl);
    const guid = getTextContent('guid') || Math.random().toString(36).substr(2, 9);
    const episodeId = `episode-${guid}`;
    const canonicalUrl = this.extractCanonicalEpisodeUrl(item, description);
    const canonicalSlug = this.extractSlugFromUrl(canonicalUrl);
    const slug = canonicalSlug || this.slugify(title) || `episode-${guid}`;

    return {
      id: episodeId,
      title,
      slug,
      canonicalSlug,
      canonicalUrl,
      description,
      pubDate,
      formattedDate: this.formatDate(pubDate) || 'Date not available',
      duration: this.formatDuration(duration),
      audioUrl,
      episodeTimestamp,
      guid,
      sources: null
    };
  }

  extractEpisodeTimestamp(audioUrl) {
    if (!audioUrl) return null;
    const timestampMatch = audioUrl.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return timestampMatch ? timestampMatch[1] : null;
  }

  slugify(value) {
    if (!value) return '';

    return value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/æ/g, 'ae')
      .replace(/œ/g, 'oe')
      .replace(/ø/g, 'o')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-');
  }

  extractCanonicalEpisodeUrl(item, description = '') {
    const candidateFields = [
      description,
      item.querySelector('itunes\\:summary')?.textContent || '',
      item.querySelector('content\\:encoded')?.textContent || '',
      item.querySelector('guid')?.textContent || '',
      item.querySelector('link')?.textContent || ''
    ];
    const showPath = `/${this.showSlug}/`;

    for (const field of candidateFields) {
      const urls = field.match(/https?:\/\/[^\s<>"']+/g) || [];

      for (const rawUrl of urls) {
        const url = rawUrl.replace(/[)\],.;!?]+$/, '');

        try {
          const parsedUrl = new URL(url);
          if (parsedUrl.pathname.includes(showPath)) {
            return url;
          }
        } catch {
          // Ignore malformed URLs embedded in feed content.
        }
      }
    }

    return '';
  }

  extractSlugFromUrl(value) {
    if (!value) return '';

    let path = value;

    try {
      path = new URL(value).pathname;
    } catch {
      path = value;
    }

    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) {
      return '';
    }

    if (parts[0] === this.showSlug && parts[1]) {
      return decodeURIComponent(parts[1]);
    }

    return decodeURIComponent(parts[parts.length - 1]);
  }

  normalizeSlugCandidate(value, options = {}) {
    const { fromTitle = false } = options;
    if (!value) return '';

    const candidate = fromTitle ? value : (this.extractSlugFromUrl(value) || value);
    return this.slugify(candidate);
  }

  findEpisodeBySlug(slug) {
    const normalizedSlug = this.normalizeSlugCandidate(slug);
    if (!normalizedSlug) return null;

    return this.episodes.find((episode) => {
      const candidates = [
        episode.slug,
        episode.canonicalSlug,
        episode.canonicalUrl,
        episode.title
      ];

      return candidates.some((candidate, index) => (
        this.normalizeSlugCandidate(candidate, { fromTitle: index === candidates.length - 1 }) === normalizedSlug
      ));
    }) || null;
  }

  getEpisodeSlugFromPath() {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && pathParts[0] === this.showSlug) {
      return pathParts[1];
    }

    return null;
  }

  setPendingEpisodeSlug(slug) {
    const normalizedSlug = this.normalizeSlugCandidate(slug);
    this.pendingEpisodeSlug = normalizedSlug || null;
  }

  applyPendingEpisodeSelection() {
    if (!this.pendingEpisodeSlug || this.episodes.length === 0) return;

    if (this.findAndPlayEpisodeBySlug(this.pendingEpisodeSlug)) {
      this.pendingEpisodeSlug = null;
    }
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  formatDuration(duration) {
    if (duration.includes(':')) {
      return duration;
    }
    const seconds = parseInt(duration);
    if (isNaN(seconds)) return '02:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  updateArchiveCount(count) {
    const archiveCount = document.getElementById('archive-entry-count');
    if (!archiveCount) return;
    archiveCount.textContent = String(count).padStart(2, '0');
  }

  getArchiveStatusLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'BEREIT' : 'READY';
  }

  getRuntimeLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'LAUFZEIT' : 'RUNTIME';
  }

  getPlayLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'SPIELEN' : 'PLAY';
  }

  getPauseLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'PAUSE' : 'PAUSE';
  }

  getAudioLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'Audio-Player' : 'Episode audio player';
  }

  getCopyAriaLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'Link kopieren' : 'Copy episode link';
  }

  getSourcesHeading() {
    return this.showSlug === 'kurz-und-klar' ? 'Quellen' : 'Sources';
  }

  getSourcesLoadingText() {
    return this.showSlug === 'kurz-und-klar' ? 'Quellen werden geladen…' : 'Loading sources...';
  }

  getNowPlayingLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'Jetzt laeuft' : 'Now playing';
  }

  getSourcesUnavailableText() {
    return this.showSlug === 'kurz-und-klar'
      ? 'Quellen sind im Moment nicht erreichbar.'
      : 'Sources are temporarily unavailable.';
  }

  getPlayerReadyLabel() {
    return this.showSlug === 'kurz-und-klar' ? 'Bereit zum Hoeren' : 'Player ready';
  }

  getPlyrI18n() {
    if (this.showSlug === 'kurz-und-klar') {
      return {
        restart: 'Neu starten',
        rewind: '{seektime}s zurück',
        play: 'Wiedergeben',
        pause: 'Pausieren',
        fastForward: '{seektime}s vor',
        seek: 'Position',
        seekLabel: '{currentTime} von {duration}',
        played: 'Gespielt',
        buffered: 'Geladen',
        currentTime: 'Aktuelle Zeit',
        duration: 'Dauer',
        volume: 'Lautstärke',
        mute: 'Stumm',
        unmute: 'Ton an'
      };
    }

    return {
      restart: 'Restart',
      rewind: 'Rewind {seektime}s',
      play: 'Play',
      pause: 'Pause',
      fastForward: 'Forward {seektime}s',
      seek: 'Seek',
      seekLabel: '{currentTime} of {duration}',
      played: 'Played',
      buffered: 'Buffered',
      currentTime: 'Current time',
      duration: 'Duration',
      volume: 'Volume',
      mute: 'Mute',
      unmute: 'Unmute'
    };
  }

  renderEpisodes() {
    const container = document.getElementById('episodes-list');
    if (!container) return;

    this.updateArchiveCount(this.episodes.length);

    if (this.episodes.length === 0) {
      container.innerHTML = '<div class="no-episodes">No episodes found.</div>';
      return;
    }

    const statusLabel = this.getArchiveStatusLabel();
    const runtimeLabel = this.getRuntimeLabel();
    const playLabel = this.getPlayLabel();
    const pauseLabel = this.getPauseLabel();

    const episodesHTML = this.episodes.map((episode) => {
      const isActive = this.currentEpisode?.id === episode.id;
      const isPlaying = isActive && this.isPlaying;
      const buttonLabel = isPlaying ? pauseLabel : playLabel;
      const buttonIcon = isPlaying ? 'fa-pause' : 'fa-play';

      return `
        <article class="episode-item${isActive ? ' is-active' : ''}${isPlaying ? ' is-playing' : ''}" id="${episode.id}" data-episode-id="${episode.id}" data-episode-slug="${episode.slug}" role="listitem">
          <div class="episode-content">
            <div class="episode-meta-row">
              <span class="episode-state label-sm">
                <span class="episode-state-pulse" aria-hidden="true"></span>
                <span class="episode-state-text">${statusLabel}</span>
              </span>
              <span class="episode-date">${episode.formattedDate}</span>
            </div>
            <h3 class="episode-title">${this.escapeHtml(episode.title)}</h3>
            <div class="episode-meta">
              <span class="episode-runtime-label label-sm">${runtimeLabel}</span>
              ${episode.duration ? `<span class="episode-duration">${episode.duration}</span>` : ''}
            </div>
          </div>
          ${isActive ? this.createPlayerMarkup(episode) : ''}
          <button class="btn-play" data-episode-id="${episode.id}" aria-label="${buttonLabel} ${this.escapeHtml(episode.title)}">
            <span class="play-text">${buttonLabel}</span>
            <i class="fas ${buttonIcon} play-icon" aria-hidden="true"></i>
          </button>
        </article>
      `;
    }).join('');

    container.innerHTML = episodesHTML;

    this.setupEpisodeInteractions();

    if (this.currentEpisode) {
      this.setupPlayer();
      this.syncEpisodePlaybackUi();
    }
  }

  setupEpisodeInteractions() {
    const container = document.getElementById('episodes-list');
    if (!container) return;

    container.querySelectorAll('.episode-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-play, .btn-copy-link, .source-link, audio, .player-bar')) {
          return;
        }

        const episodeId = item.getAttribute('data-episode-id');
        this.selectEpisode(episodeId, item, { autoplay: false });
      });
    });

    container.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const episodeId = btn.getAttribute('data-episode-id');
        const item = btn.closest('.episode-item');
        this.toggleEpisodePlayback(episodeId, item);
      });
    });
  }

  async selectEpisode(episodeId, episodeElement = null, options = {}) {
    const { autoplay = false, updateUrl = true, scroll = true } = options;
    const episode = this.episodes.find(ep => ep.id === episodeId);
    if (!episode) {
      console.warn('Episode not found:', episodeId);
      return;
    }

    const isSameEpisode = this.currentEpisode?.id === episodeId;

    if (!isSameEpisode) {
      this.destroyPlayer();
      this.currentEpisode = episode;
      this.isPlaying = false;
      this.renderEpisodes();
    } else if (!document.getElementById('episode-audio')) {
      this.renderEpisodes();
    }

    if (updateUrl) {
      this.updateUrl(episode.slug);
    }

    if (!episodeElement || !document.body.contains(episodeElement)) {
      episodeElement = document.querySelector(`[data-episode-id="${episodeId}"]`);
    }

    if (scroll && episodeElement) {
      setTimeout(() => {
        episodeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }

    if (autoplay) {
      await this.playCurrentAudio();
    } else {
      this.syncEpisodePlaybackUi();
    }
  }

  async playEpisode(episodeId, episodeElement = null) {
    await this.toggleEpisodePlayback(episodeId, episodeElement);
  }

  async toggleEpisodePlayback(episodeId, episodeElement = null) {
    if (this.currentEpisode?.id !== episodeId) {
      await this.selectEpisode(episodeId, episodeElement, { autoplay: false });
      await this.loadSources();
      await this.playCurrentAudio();
      return;
    }

    const audioElement = this.getAudioElement();
    if (!audioElement) {
      await this.selectEpisode(episodeId, episodeElement, { autoplay: false, scroll: false });
      await this.loadSources();
      await this.playCurrentAudio();
      return;
    }

    if (audioElement.paused) {
      await this.loadSources();
      await this.playCurrentAudio();
    } else {
      audioElement.pause();
    }
  }

  updatePlayer() {
    if (!this.currentEpisode) return;

    const audioElement = this.getAudioElement();
    if (!audioElement) return;

    const nextSource = this.currentEpisode.audioUrl || '';
    const currentSource = audioElement.getAttribute('src') || audioElement.currentSrc || '';

    if (nextSource && currentSource !== nextSource) {
      audioElement.src = nextSource;
      audioElement.load();
    }
  }

  async loadSources() {
    const sourcesContainer = document.getElementById('episode-sources');
    const activeEpisodeId = this.currentEpisode?.id;

    if (!this.currentEpisode || !sourcesContainer) {
      this.hideSources();
      return;
    }

    if (Array.isArray(this.currentEpisode.sources)) {
      if (this.currentEpisode.sources.length > 0) {
        this.renderSources(this.currentEpisode.sources);
        this.showSources();
      } else {
        this.hideSources();
      }
      return;
    }

    if (!this.currentEpisode.episodeTimestamp) {
      this.hideSources();
      return;
    }

    const requestId = ++this.activeSourceRequestId;
    sourcesContainer.innerHTML = this.getSourcesLoadingMarkup();
    this.showSources();

    try {
      const jsonUrl = `https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/${this.showSlug}/${this.currentEpisode.episodeTimestamp}/assets/polished_script.json`;
      const sourceData = await this.fetchEpisodeSourceData(jsonUrl);

      if (!this.currentEpisode || this.currentEpisode.id !== activeEpisodeId || requestId !== this.activeSourceRequestId) {
        return;
      }

      const sources = this.normalizeSources(sourceData.sources || []);
      this.currentEpisode.sources = sources;

      if (sources.length > 0) {
        this.renderSources(sources);
        this.showSources();
      } else {
        this.hideSources();
      }
    } catch (error) {
      console.warn('Could not load sources:', error);
      this.renderSourcesUnavailable();
      this.showSources();
    }
  }

  async fetchEpisodeSourceData(jsonUrl) {
    const attempts = [
      { label: 'allorigins-primary', url: this.buildAllOriginsGetUrl(jsonUrl), parser: 'allorigins', timeoutMs: 4000 },
      { label: 'allorigins-retry', url: this.buildAllOriginsGetUrl(jsonUrl), parser: 'allorigins', timeoutMs: 6500 },
      { label: 'direct-json', url: jsonUrl, parser: 'json', timeoutMs: 2500 }
    ];
    const errors = [];

    for (const attempt of attempts) {
      try {
        return await this.fetchSourceAttempt(attempt);
      } catch (error) {
        console.warn(`Source fetch attempt failed (${attempt.label}):`, error);
        errors.push(`${attempt.label}: ${error.message}`);
      }
    }

    throw new Error(errors.join(' | ') || 'Unable to load sources');
  }

  buildAllOriginsGetUrl(targetUrl) {
    const requestUrl = new URL('https://api.allorigins.win/get');
    requestUrl.searchParams.set('url', targetUrl);
    requestUrl.searchParams.set('_', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return requestUrl.toString();
  }

  async fetchSourceAttempt(attempt) {
    const response = await this.fetchWithTimeout(attempt.url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json, text/plain, */*'
      }
    }, attempt.timeoutMs);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (attempt.parser === 'json') {
      return response.json();
    }

    const proxyData = await response.json();
    if (!proxyData || typeof proxyData.contents !== 'string' || !proxyData.contents.trim()) {
      throw new Error('Empty proxy payload');
    }

    return JSON.parse(proxyData.contents);
  }

  async fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  renderSources(sources) {
    const container = document.getElementById('episode-sources');
    if (!container) return;

    const sourcesHtml = sources.map(source => {
      const url = source.url || '';
      const title = source.title || 'Untitled';
      const category = source.category || '';
      const country = source.country || '';
      
      return `
        <div class="source-item">
          <a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="source-link">
            <div class="source-content">
              <div class="source-title">${this.escapeHtml(title)}</div>
              <div class="source-meta">
                ${source.domain ? `<span class="source-domain">${this.escapeHtml(source.domain)}</span>` : ''}
                ${category ? `<span class="source-category">${this.escapeHtml(category)}</span>` : ''}
                ${country ? `<span class="source-country">${this.escapeHtml(country)}</span>` : ''}
              </div>
            </div>
            <i class="fas fa-external-link-alt source-icon" aria-hidden="true"></i>
          </a>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="sources-header">
        <h4>${this.escapeHtml(this.getSourcesHeading())}</h4>
      </div>
      <div class="sources-list">
        ${sourcesHtml}
      </div>
    `;
  }

  renderSourcesUnavailable() {
    const container = document.getElementById('episode-sources');
    if (!container) return;

    container.innerHTML = `
      <div class="sources-loading">
        <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
        <span>${this.escapeHtml(this.getSourcesUnavailableText())}</span>
      </div>
    `;
  }

  getSourcesLoadingMarkup() {
    return `
      <div class="sources-loading">
        <i class="fas fa-spinner" aria-hidden="true"></i>
        <span>${this.escapeHtml(this.getSourcesLoadingText())}</span>
      </div>
    `;
  }

  normalizeSources(sources) {
    return sources
      .map((source) => {
        const url = source.url || '';
        let domain = '';

        if (url) {
          try {
            domain = new URL(url).hostname.replace(/^www\./, '');
          } catch {
            domain = '';
          }
        }

        return {
          ...source,
          url,
          domain
        };
      })
      .filter((source) => source.url);
  }

  showSources() {
    const container = document.getElementById('episode-sources');
    if (!container) return;

    container.hidden = false;
    container.removeAttribute('aria-hidden');
  }

  hideSources() {
    const container = document.getElementById('episode-sources');
    if (!container) return;

    container.hidden = true;
    container.setAttribute('aria-hidden', 'true');
  }

  destroyPlayer() {
    if (this.player && typeof this.player.destroy === 'function') {
      try {
        this.player.destroy();
      } catch (error) {
        console.warn('Could not clean up inline player:', error);
      }
    }

    this.player = null;
  }

  getAudioElement() {
    return this.player?.media || document.getElementById('episode-audio');
  }

  setupPlayer() {
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn && !copyBtn.dataset.bound) {
      copyBtn.dataset.bound = 'true';
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.copyEpisodeLink();
      });
    }

    const audioElement = document.getElementById('episode-audio');
    if (!audioElement) return;

    if (this.player) {
      this.destroyPlayer();
    }

    if (typeof Plyr !== 'undefined') {
      this.player = new Plyr(audioElement, {
        controls: [
          'play',
          'rewind',
          'fast-forward',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume'
        ],
        settings: [],
        seekTime: 10,
        volume: 0.7,
        muted: false,
        clickToPlay: true,
        hideControls: false,
        resetOnEnd: true,
        keyboard: {
          focused: true,
          global: false
        },
        tooltips: {
          controls: true,
          seek: true
        },
        displayDuration: true,
        invertTime: false,
        toggleInvert: false,
        i18n: this.getPlyrI18n()
      });
    } else {
      audioElement.controls = true;
      audioElement.volume = 0.7;
    }

    if (!audioElement.dataset.bound) {
      audioElement.dataset.bound = 'true';
      audioElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.syncEpisodePlaybackUi();
        this.loadSources();
      });
      audioElement.addEventListener('pause', () => {
        this.isPlaying = false;
        this.syncEpisodePlaybackUi();
      });
      audioElement.addEventListener('ended', () => {
        this.isPlaying = false;
        this.syncEpisodePlaybackUi();
      });
    }

    this.updatePlayer();
  }
  
  getCopyUi() {
    const main = document.querySelector('main[data-show]');
    return {
      copyLink: main?.dataset?.copyLink || 'Copy Link',
      copied: main?.dataset?.copied || 'Copied!'
    };
  }

  createPlayerMarkup(episode) {
    const ui = this.getCopyUi();
    const playerStatus = this.isPlaying ? this.getNowPlayingLabel() : this.getPlayerReadyLabel();

    return `
      <div id="player-bar" class="player-bar" aria-label="Episode player">
        <div class="player-content">
          <div class="player-toolbar">
            <span class="player-status label-sm">
              <span class="episode-state-pulse" aria-hidden="true"></span>
              <span class="player-status-text">${this.escapeHtml(playerStatus)}</span>
            </span>
            <button id="copy-link-btn" class="btn-copy-link" aria-label="${this.escapeHtml(this.getCopyAriaLabel())}">
              <span class="btn-text">${ui.copyLink}</span>
              <i class="fas fa-link btn-icon" aria-hidden="true"></i>
            </button>
          </div>
          <div class="player-controls">
            <audio id="episode-audio" preload="metadata" playsinline aria-label="${this.escapeHtml(this.getAudioLabel())}">
              <source src="${this.escapeHtml(episode.audioUrl || '')}" type="audio/mpeg">
              <p>Your browser doesn't support audio playback.</p>
            </audio>
          </div>
        </div>
        <div id="episode-sources" class="episode-sources" hidden aria-hidden="true"></div>
      </div>
    `;
  }

  async playCurrentAudio() {
    const audioElement = this.getAudioElement();
    if (!audioElement) return;

    try {
      await audioElement.play();
      this.isPlaying = true;
      this.syncEpisodePlaybackUi();
    } catch (error) {
      console.warn('Unable to autoplay episode audio:', error);
      this.isPlaying = false;
      this.syncEpisodePlaybackUi();
    }
  }

  syncEpisodePlaybackUi() {
    const audioElement = this.getAudioElement();
    const isCurrentAudioPlaying = Boolean(
      this.currentEpisode &&
      audioElement &&
      !audioElement.paused &&
      !audioElement.ended
    );

    if (this.currentEpisode) {
      this.isPlaying = isCurrentAudioPlaying;
    } else {
      this.isPlaying = false;
    }

    const playLabel = this.getPlayLabel();
    const pauseLabel = this.getPauseLabel();

    document.querySelectorAll('.episode-item').forEach(item => {
      const isActive = this.currentEpisode && item.getAttribute('data-episode-id') === this.currentEpisode.id;
      const isPlaying = isActive && this.isPlaying;
      const btn = item.querySelector('.btn-play');
      const text = btn?.querySelector('.play-text');
      const icon = btn?.querySelector('.play-icon');

      item.classList.toggle('is-active', Boolean(isActive));
      item.classList.toggle('is-playing', Boolean(isPlaying));

      if (btn && text && icon) {
        const buttonLabel = isPlaying ? pauseLabel : playLabel;
        text.textContent = buttonLabel;
        btn.setAttribute('aria-label', `${buttonLabel} ${item.querySelector('.episode-title')?.textContent || 'episode'}`);
        icon.className = `fas ${isPlaying ? 'fa-pause' : 'fa-play'} play-icon`;
      }
    });

    const playerStatusText = document.querySelector('.player-status-text');
    if (playerStatusText) {
      playerStatusText.textContent = this.isPlaying ? this.getNowPlayingLabel() : this.getPlayerReadyLabel();
    }

    const main = document.querySelector('main[data-show]');
    if (main) {
      main.classList.toggle('is-playing', Boolean(this.isPlaying));
      main.classList.toggle('has-active-episode', Boolean(this.currentEpisode));
    }

    document.body.classList.toggle('show-playback-active', Boolean(this.isPlaying));
  }

  closePlayer() {
    const audioElement = this.getAudioElement();

    if (audioElement) {
      audioElement.pause();
    }

    this.destroyPlayer();
    this.currentEpisode = null;
    this.isPlaying = false;
    this.renderEpisodes();

    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length > 1 && pathParts[0] === this.showSlug) {
      const showPath = '/' + pathParts[0];
      window.history.pushState(null, '', showPath);
    }
  }

  copyEpisodeLink() {
    if (!this.currentEpisode) return;

    // Get base path without trailing slash
    let basePath = window.location.pathname.split('/').filter(p => p)[0];
    if (!basePath) basePath = '';
    basePath = '/' + basePath;
    
    const url = `${window.location.origin}${basePath}/${this.currentEpisode.slug}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.showCopyFeedback();
      }).catch(() => {
        this.fallbackCopy(url);
      });
    } else {
      this.fallbackCopy(url);
    }
  }

  fallbackCopy(url) {
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      this.showCopyFeedback();
    } catch (err) {
      prompt('Copy this link:', url);
    }
    
    document.body.removeChild(textarea);
  }

  showCopyFeedback() {
    const btn = document.getElementById('copy-link-btn');
    if (!btn) return;

    const originalText = btn.querySelector('.btn-text');
    if (!originalText) return;

    const ui = this.getCopyUi();
    const original = originalText.textContent;
    originalText.textContent = ui.copied;
    
    setTimeout(() => {
      originalText.textContent = original;
    }, 2000);
  }

  updateUrl(episodeSlug) {
    // Always use the base show path, not the current pathname (which might have a slug)
    const basePath = `/${this.showSlug}`;
    const newUrl = `${basePath}/${episodeSlug}`;
    window.history.pushState(null, '', newUrl);
  }

  handleDeepLink() {
    const storedSlug = sessionStorage.getItem('episodeSlug');
    if (storedSlug) {
      sessionStorage.removeItem('episodeSlug');
      sessionStorage.removeItem('showPath');
      this.setPendingEpisodeSlug(storedSlug);
    } else {
      this.setPendingEpisodeSlug(this.getEpisodeSlugFromPath());
    }

    window.addEventListener('popstate', () => {
      const episodeSlug = this.getEpisodeSlugFromPath();
      if (episodeSlug) {
        this.setPendingEpisodeSlug(episodeSlug);
        this.applyPendingEpisodeSelection();
      } else {
        this.closePlayer();
      }
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash;
      if (hash) {
        const episodeId = hash.substring(1);
        const episode = this.episodes.find(ep => ep.id === episodeId);
        if (episode) {
          this.playEpisode(episodeId);
        }
      }
    });
  }

  findAndPlayEpisodeBySlug(slug) {
    const episode = this.findEpisodeBySlug(slug);
    if (episode) {
      const episodeElement = document.querySelector(`[data-episode-slug="${episode.slug}"]`);
      this.selectEpisode(episode.id, episodeElement, {
        autoplay: false,
        updateUrl: false
      });
      return true;
    }

    console.warn('Episode not found for slug:', slug);
    return false;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  loadShowImage(xmlDoc) {
    let imageUrl = '';
    
    // Try to get image from itunes:image
    const itunesImage = xmlDoc.querySelector('itunes\\:image, [name="itunes:image"]');
    if (itunesImage) {
      imageUrl = itunesImage.getAttribute('href') || itunesImage.textContent;
    }
    
    // If not found, try channel > image > url
    if (!imageUrl) {
      const channelImage = xmlDoc.querySelector('channel image url');
      if (channelImage) {
        imageUrl = channelImage.textContent;
      }
    }
    
    // If still not found, try image tag directly
    if (!imageUrl) {
      const imageTag = xmlDoc.querySelector('image');
      if (imageTag) {
        const urlTag = imageTag.querySelector('url');
        if (urlTag) {
          imageUrl = urlTag.textContent;
        }
      }
    }
    
    // Get the header image element
    const headerImage = document.getElementById('show-header-image');
    if (!headerImage) return;
    
    // Create fallback image (simple SVG placeholder with microphone icon)
    const fallbackImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y5ZmFmYiIgcng9IjgiLz48cGF0aCBkPSJNNTAgMzBjLTMuMzEzIDAtNiAyLjY4Ny02IDZ2OGMwIDMuMzEzIDIuNjg3IDYgNiA2czYtMi42ODcgNi02di04YzAtMy4zMTMtMi42ODctNi02LTZ6bTAgMjBjLTIuMjA3IDAtNC0xLjc5My00LTB2LThjMC0yLjIwNyAxLjc5My00IDQtNHM0IDEuNzkzIDQgNHY4YzAgMi4yMDctMS43OTMgNC00IDR6bTAtMTJjLTEuMTA0IDAtMiAuODk2LTIgMnY4YzAgMS4xMDQuODk2IDIgMiAyczItLjg5NiAyLTJ2LThjMC0xLjEwNC0uODk2LTItMi0yek00MCA1MGg0djhoLTR2LTh6bTE2IDBoNHY4aC00di04eiIgZmlsbD0iIzI1NjNlYiIvPjwvc3ZnPg==';
    
    // Display the image if found, otherwise use fallback
    if (imageUrl) {
      headerImage.src = imageUrl;
      headerImage.style.display = 'block';
      headerImage.onerror = () => {
        // If RSS image fails, use fallback
        headerImage.src = fallbackImage;
      };
    } else {
      // No image found in RSS, use fallback immediately
      headerImage.src = fallbackImage;
      headerImage.style.display = 'block';
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ShowsManager();
  });
} else {
  new ShowsManager();
}
