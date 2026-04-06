/**
 * Shows Module - Handles episode listing and player for show pages
 */

class ShowsManager {
  constructor() {
    this.episodes = [];
    this.currentEpisode = null;
    this.isPlaying = false;
    this.showSlug = null;
    this.rssSources = [];
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
      
      // Check for deep link after episodes are loaded
      this.checkDeepLink();
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
    
    // Generate URL slug from title (with fallback)
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/-$/, '') || `episode-${guid}`;

    return {
      id: episodeId,
      title,
      slug,
      description,
      pubDate,
      formattedDate: this.formatDate(pubDate) || 'Date not available',
      duration: this.formatDuration(duration),
      audioUrl,
      episodeTimestamp,
      guid
    };
  }

  extractEpisodeTimestamp(audioUrl) {
    if (!audioUrl) return null;
    const timestampMatch = audioUrl.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return timestampMatch ? timestampMatch[1] : null;
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
          ${isActive ? this.createPlayerMarkup() : ''}
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
      this.updatePlayer();
      this.loadSources();
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
      await this.selectEpisode(episodeId, episodeElement, { autoplay: true });
      return;
    }

    const audioElement = document.getElementById('episode-audio');
    if (!audioElement) {
      await this.selectEpisode(episodeId, episodeElement, { autoplay: true, scroll: false });
      return;
    }

    if (audioElement.paused) {
      await this.playCurrentAudio();
    } else {
      audioElement.pause();
    }
  }

  updatePlayer() {
    if (!this.currentEpisode) {
      return;
    }

    const sourcesContainer = document.getElementById('episode-sources');
    if (sourcesContainer) {
      sourcesContainer.style.display = 'none';
    }

    const audioElement = document.getElementById('episode-audio');
    if (audioElement) {
      const nextSource = this.currentEpisode.audioUrl || '';
      const currentSource = audioElement.getAttribute('src') || '';

      if (currentSource !== nextSource) {
        audioElement.src = nextSource;
        audioElement.load();
      }
    }
  }

  async loadSources() {
    const sourcesContainer = document.getElementById('episode-sources');
    const activeEpisodeId = this.currentEpisode?.id;
    
    if (!this.currentEpisode) {
      if (sourcesContainer) {
        sourcesContainer.style.display = 'none';
      }
      return;
    }
    
    // Hide sources initially, will show if we successfully load them
    if (sourcesContainer) {
      sourcesContainer.style.display = 'none';
    }
    
    if (!this.currentEpisode.episodeTimestamp) {
      return;
    }
    if (!sourcesContainer) return;

    try {
      // Try to load sources from Backblaze B2 (still need proxy for external JSON)
      const jsonUrl = `https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/${this.showSlug}/${this.currentEpisode.episodeTimestamp}/assets/polished_script.json`;
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      
      const response = await fetch(`${proxyUrl}${encodeURIComponent(jsonUrl)}`);
      
      if (response.ok) {
        const proxyData = await response.json();
        
        if (proxyData.contents) {
          if (!this.currentEpisode || this.currentEpisode.id !== activeEpisodeId) {
            return;
          }

          const sourceData = JSON.parse(proxyData.contents);
          const sources = sourceData.sources || [];
          
          if (sources.length > 0) {
            this.renderSources(sources);
            sourcesContainer.removeAttribute('style');
            sourcesContainer.style.display = 'block';
            sourcesContainer.style.visibility = 'visible';
            console.log('Sources displayed, count:', sources.length);
          } else {
            sourcesContainer.style.display = 'none';
            console.log('No sources to display');
          }
        } else {
          sourcesContainer.style.display = 'none';
        }
      } else {
        sourcesContainer.style.display = 'none';
      }
    } catch (error) {
      console.warn('Could not load sources:', error);
      sourcesContainer.style.display = 'none';
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
        <h4>Sources</h4>
      </div>
      <div class="sources-list">
        ${sourcesHtml}
      </div>
    `;
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
    if (audioElement && !audioElement.dataset.bound) {
      audioElement.dataset.bound = 'true';
      audioElement.addEventListener('play', () => {
        this.isPlaying = true;
        this.syncEpisodePlaybackUi();
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
  }
  
  getCopyUi() {
    const main = document.querySelector('main[data-show]');
    return {
      copyLink: main?.dataset?.copyLink || 'Copy Link',
      copied: main?.dataset?.copied || 'Copied!'
    };
  }

  createPlayerMarkup() {
    const ui = this.getCopyUi();
    return `
      <div id="player-bar" class="player-bar" aria-label="Episode player">
      <div class="player-content">
        <div class="player-controls">
          <audio id="episode-audio" controls preload="metadata" aria-label="${this.escapeHtml(this.getAudioLabel())}">
            <p>Your browser doesn't support audio playback.</p>
          </audio>
          <button id="copy-link-btn" class="btn-copy-link" aria-label="${this.escapeHtml(this.getCopyAriaLabel())}">
            <span class="btn-text">${ui.copyLink}</span>
            <i class="fas fa-link btn-icon" aria-hidden="true"></i>  
          </button>
        </div>
      </div>
      <div id="episode-sources" class="episode-sources" style="display: none;"></div>
      </div>
    `;
  }

  async playCurrentAudio() {
    const audioElement = document.getElementById('episode-audio');
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
    const audioElement = document.getElementById('episode-audio');
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
  }

  closePlayer() {
    const audioElement = document.getElementById('episode-audio');

    if (audioElement) {
      audioElement.pause();
    }

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
    // Check for episode slug from sessionStorage (from 404 redirect)
    const storedSlug = sessionStorage.getItem('episodeSlug');
    if (storedSlug) {
      console.log('Found stored episode slug from 404 redirect:', storedSlug);
      sessionStorage.removeItem('episodeSlug');
      sessionStorage.removeItem('showPath');
      
      // Wait for episodes to load, then find and play
      const checkEpisode = () => {
        if (this.episodes.length > 0) {
          this.findAndPlayEpisodeBySlug(storedSlug);
        } else {
          setTimeout(checkEpisode, 100);
        }
      };
      checkEpisode();
      return;
    }
    
    // Check for episode slug in URL path
    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length >= 2) {
      const showSlug = pathParts[0];
      const episodeSlug = pathParts[1];
      
      // Only process if it's the current show
      if (showSlug === this.showSlug) {
        // Wait for episodes to load, then find and play
        const checkEpisode = () => {
          if (this.episodes.length > 0) {
            this.findAndPlayEpisodeBySlug(episodeSlug);
          } else {
            setTimeout(checkEpisode, 100);
          }
        };
        checkEpisode();
      }
    }
    
    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const pathParts = window.location.pathname.split('/').filter(p => p);
      if (pathParts.length >= 2 && pathParts[0] === this.showSlug) {
        const episodeSlug = pathParts[1];
        this.findAndPlayEpisodeBySlug(episodeSlug);
      } else {
        // Show page without episode - close player
        this.closePlayer();
      }
    });
    
    // Handle hash changes (legacy support)
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
    const episode = this.episodes.find(ep => ep.slug === slug);
    if (episode) {
      const episodeElement = document.querySelector(`[data-episode-slug="${slug}"]`);
      this.selectEpisode(episode.id, episodeElement, {
        autoplay: false,
        updateUrl: false
      });
    }
  }

  checkDeepLink() {
    // First check for stored slug from 404 redirect
    const storedSlug = sessionStorage.getItem('episodeSlug');
    if (storedSlug) {
      console.log('checkDeepLink - Found stored episode slug:', storedSlug);
      sessionStorage.removeItem('episodeSlug');
      sessionStorage.removeItem('showPath');
      
      // Wait for episodes to load
      const checkEpisode = () => {
        if (this.episodes.length > 0) {
          this.findAndPlayEpisodeBySlug(storedSlug);
        } else {
          setTimeout(checkEpisode, 100);
        }
      };
      checkEpisode();
      return;
    }
    
    // Check for episode slug in URL path
    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length >= 2) {
      const showSlug = pathParts[0];
      const episodeSlug = pathParts[1];
      
      // Only process if it's the current show
      if (showSlug === this.showSlug) {
        // Wait for episodes to load
        const checkEpisode = () => {
          if (this.episodes.length > 0) {
            this.findAndPlayEpisodeBySlug(episodeSlug);
          } else {
            setTimeout(checkEpisode, 100);
          }
        };
        checkEpisode();
      }
    }
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

