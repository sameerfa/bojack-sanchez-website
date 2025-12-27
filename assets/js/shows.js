/**
 * Shows Module - Handles episode listing and player for show pages
 */

class ShowsManager {
  constructor() {
    this.episodes = [];
    this.currentEpisode = null;
    this.showSlug = null;
    this.rssUrl = null;
    this.init();
  }

  init() {
    const main = document.querySelector('main[data-show]');
    if (!main) return;

    this.showSlug = main.getAttribute('data-show');
    this.rssUrl = this.getRssUrl(this.showSlug);

    if (!this.rssUrl) {
      console.error('No RSS URL found for show:', this.showSlug);
      return;
    }

    this.loadEpisodes();
    this.setupPlayer();
    this.handleDeepLink();
  }

  getRssUrl(showSlug) {
    const urls = {
      'news-in-a-nutshell': 'https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/news-in-a-nutshell.rss',
      'kurz-und-klar': 'https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/kurz-und-klar.rss'
    };
    return urls[showSlug] || null;
  }

  async loadEpisodes() {
    const container = document.getElementById('episodes-list');
    if (!container) return;

    try {
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      const response = await fetch(`${proxyUrl}${encodeURIComponent(this.rssUrl)}`);
      const data = await response.json();

      if (data.contents) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');

        this.episodes = Array.from(items).map(item => this.parseEpisode(item));
        this.episodes.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate)); // Newest first

        this.renderEpisodes();
        
        // Check for deep link after episodes are loaded
        this.checkDeepLink();
      }
    } catch (error) {
      console.error('Failed to load episodes:', error);
      container.innerHTML = '<div class="error">Failed to load episodes. Please try again later.</div>';
    }
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

  renderEpisodes() {
    const container = document.getElementById('episodes-list');
    if (!container) return;

    if (this.episodes.length === 0) {
      container.innerHTML = '<div class="no-episodes">No episodes found.</div>';
      return;
    }

    container.innerHTML = this.episodes.map(episode => `
      <article class="episode-item" id="${episode.id}" data-episode-id="${episode.id}" data-episode-slug="${episode.slug}" role="listitem">
        <div class="episode-content">
          <h3 class="episode-title">${this.escapeHtml(episode.title)}</h3>
          <div class="episode-meta">
            <span class="episode-date">${episode.formattedDate}</span>
            ${episode.duration ? `<span class="episode-duration">${episode.duration}</span>` : ''}
          </div>
        </div>
        <button class="btn-play" data-episode-id="${episode.id}" aria-label="Play ${this.escapeHtml(episode.title)}">
          <i class="fas fa-play play-icon" aria-hidden="true"></i>
        </button>
      </article>
    `).join('');

    // Attach event listeners - make entire row clickable
    container.querySelectorAll('.episode-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Don't trigger if clicking the button itself (to avoid double trigger)
        if (e.target.closest('.btn-play')) {
          e.stopPropagation();
          return;
        }
        const episodeId = item.getAttribute('data-episode-id');
        this.playEpisode(episodeId, item);
      });
    });
    
    // Also attach to button for explicit clicks
    container.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const episodeId = btn.getAttribute('data-episode-id');
        const item = btn.closest('.episode-item');
        this.playEpisode(episodeId, item);
      });
    });
  }

  async playEpisode(episodeId, episodeElement = null) {
    const episode = this.episodes.find(ep => ep.id === episodeId);
    if (!episode) {
      console.warn('Episode not found:', episodeId);
      return;
    }

    this.currentEpisode = episode;
    
    // Find the episode element if not provided
    if (!episodeElement) {
      episodeElement = document.querySelector(`[data-episode-id="${episodeId}"]`);
    }
    
    if (!episodeElement) {
      console.warn('Episode element not found for:', episodeId);
      return;
    }
    
    // Insert player after the episode item first
    this.insertPlayerAfterEpisode(episodeElement);
    
    // Then update player content
    this.updatePlayer();
    
    // Load sources and update URL
    this.loadSources();
    this.updateUrl(episode.slug);

    // Scroll to player after a short delay to ensure it's rendered
    setTimeout(() => {
      const playerBar = document.getElementById('player-bar');
      if (playerBar && playerBar.style.display !== 'none') {
        playerBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  }
  
  insertPlayerAfterEpisode(episodeElement) {
    if (!episodeElement) {
      console.warn('No episode element provided for player insertion');
      return;
    }
    
    const playerBar = document.getElementById('player-bar');
    if (!playerBar) {
      console.warn('Player bar element not found');
      return;
    }
    
    // Remove player from current location if it exists
    const currentParent = playerBar.parentElement;
    if (currentParent) {
      playerBar.remove();
    }
    
    // Insert player after the episode element
    episodeElement.insertAdjacentElement('afterend', playerBar);
    
    // Ensure player is visible
    playerBar.style.display = 'block';
  }

  updatePlayer() {
    if (!this.currentEpisode) {
      console.warn('No current episode to update player');
      return;
    }

    const playerBar = document.getElementById('player-bar');
    if (!playerBar) {
      console.warn('Player bar element not found');
      return;
    }

    // Always show the player bar
    playerBar.style.display = 'block';

    // Update title with fallback
    const playerTitle = document.getElementById('player-title');
    if (playerTitle) {
      playerTitle.textContent = this.currentEpisode.title || 'Untitled Episode';
    }

    // Update date with fallback
    const playerDate = document.getElementById('player-date');
    if (playerDate) {
      playerDate.textContent = this.currentEpisode.formattedDate || 'Date not available';
    }

    // Update audio with fallback
    const audioElement = document.getElementById('episode-audio');
    if (audioElement) {
      if (this.currentEpisode.audioUrl) {
        audioElement.src = this.currentEpisode.audioUrl;
        audioElement.load();
      } else {
        // Clear audio source if not available
        audioElement.src = '';
        console.warn('No audio URL available for episode');
      }
    }
  }

  async loadSources() {
    const sourcesContainer = document.getElementById('episode-sources');
    
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
      const jsonUrl = `https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/${this.showSlug}/${this.currentEpisode.episodeTimestamp}/assets/polished_script.json`;
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      
      const response = await fetch(`${proxyUrl}${encodeURIComponent(jsonUrl)}`);
      
      if (response.ok) {
        const proxyData = await response.json();
        
        if (proxyData.contents) {
          const sourceData = JSON.parse(proxyData.contents);
          const sources = sourceData.sources || [];
          
          if (sources.length > 0) {
            this.renderSources(sources);
            sourcesContainer.style.display = 'block';
          } else {
            sourcesContainer.style.display = 'none';
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
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyEpisodeLink());
    }
    
    const closeBtn = document.getElementById('close-player-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePlayer());
    }
  }

  closePlayer() {
    const playerBar = document.getElementById('player-bar');
    const audioElement = document.getElementById('episode-audio');
    
    if (playerBar) {
      playerBar.style.display = 'none';
      // Move player back to original location (end of episodes list)
      const episodesList = document.getElementById('episodes-list');
      if (episodesList && playerBar.parentElement !== episodesList) {
        playerBar.remove();
        episodesList.appendChild(playerBar);
      }
    }
    
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    
    this.currentEpisode = null;
    
    // Reset URL to show page (remove episode slug)
    let showPath = window.location.pathname.split('/').filter(p => p)[0];
    if (!showPath) showPath = '';
    showPath = '/' + showPath;
    window.history.pushState(null, '', showPath);
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

    const original = originalText.textContent;
    originalText.textContent = 'Copied!';
    
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
      this.playEpisode(episode.id, episodeElement);
    }
  }

  checkDeepLink() {
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ShowsManager();
  });
} else {
  new ShowsManager();
}

