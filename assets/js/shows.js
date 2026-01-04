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
    
    // Ensure player is hidden on initial load (no episode selected)
    setTimeout(() => {
      this.ensurePlayerHidden();
    }, 100);
  }
  
  ensurePlayerHidden() {
    const playerBar = document.getElementById('player-bar');
    if (playerBar && !this.currentEpisode) {
      playerBar.style.display = 'none';
      playerBar.setAttribute('style', 'display: none !important;');
      console.log('Ensured player is hidden on initial load');
    }
  }

  getRssUrl(showSlug) {
    const urls = {
      'news-in-a-nutshell': '/assets/rss/news-in-a-nutshell.rss',
      'kurz-und-klar': '/assets/rss/kurz-und-klar.rss'
    };
    return urls[showSlug] || null;
  }

  async loadEpisodes() {
    const container = document.getElementById('episodes-list');
    if (!container) return;

    try {
      // Fetch from local RSS file (no CORS issues)
      const response = await fetch(this.rssUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, */*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const xmlContent = await response.text();
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

    // Preserve the player-bar element if it exists and is currently visible
    const existingPlayerBar = document.getElementById('player-bar');
    let playerBarHTML = '';
    let shouldPreservePlayer = false;
    
    if (existingPlayerBar) {
      // Only preserve if player is currently visible (has an episode playing)
      const isVisible = existingPlayerBar.style.display !== 'none' && 
                       window.getComputedStyle(existingPlayerBar).display !== 'none' &&
                       this.currentEpisode !== null;
      
      if (isVisible) {
        playerBarHTML = existingPlayerBar.outerHTML;
        shouldPreservePlayer = true;
      }
    }

    if (this.episodes.length === 0) {
      container.innerHTML = '<div class="no-episodes">No episodes found.</div>';
      // Re-append player if it was preserved
      if (shouldPreservePlayer && playerBarHTML) {
        container.insertAdjacentHTML('beforeend', playerBarHTML);
      }
      return;
    }

    const episodesHTML = this.episodes.map(episode => `
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

    // Set innerHTML - don't include player-bar, it should be hidden by default
    container.innerHTML = episodesHTML;
    
    // Ensure player-bar exists but is hidden at the end of the list
    let playerBar = document.getElementById('player-bar');
    if (!playerBar) {
      // Create player bar if it doesn't exist
      playerBar = this.createPlayerBar();
      if (playerBar) {
        container.appendChild(playerBar);
      }
    } else {
      // Force hide existing player - only show if there's a current episode
      if (!this.currentEpisode) {
        playerBar.style.display = 'none';
        playerBar.setAttribute('style', 'display: none !important;');
      }
      // Move to end of list if not already there
      if (playerBar.parentElement !== container) {
        playerBar.remove();
        container.appendChild(playerBar);
        // Ensure it stays hidden if no episode
        if (!this.currentEpisode) {
          playerBar.style.display = 'none';
          playerBar.setAttribute('style', 'display: none !important;');
        }
      } else {
        // Even if already in container, ensure it's hidden if no episode
        if (!this.currentEpisode) {
          playerBar.style.display = 'none';
          playerBar.setAttribute('style', 'display: none !important;');
        }
      }
    }
    
    // Only show player if it was visible before (episode was playing)
    if (shouldPreservePlayer && this.currentEpisode && playerBar) {
      // Find the episode that was playing and insert player after it
      const currentEpisodeElement = container.querySelector(`[data-episode-id="${this.currentEpisode.id}"]`);
      if (currentEpisodeElement) {
        playerBar.remove();
        currentEpisodeElement.insertAdjacentElement('afterend', playerBar);
        // Show the player
        playerBar.style.display = 'block';
        // Re-setup player buttons
        this.setupPlayer();
      }
    }

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
    const inserted = this.insertPlayerAfterEpisode(episodeElement);
    if (!inserted) {
      console.error('Failed to insert player');
      return;
    }
    
    // Setup player buttons after insertion
    this.setupPlayer();
    
    // Then update player content
    this.updatePlayer();
    
    // Load sources and update URL
    this.loadSources();
    this.updateUrl(episode.slug);

    // Scroll to episode title (not player) after a short delay to ensure it's rendered
    setTimeout(() => {
      if (episodeElement) {
        episodeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }
  
  insertPlayerAfterEpisode(episodeElement) {
    if (!episodeElement) {
      console.warn('No episode element provided for player insertion');
      return false;
    }
    
    let playerBar = document.getElementById('player-bar');
    
    // Create player bar if it doesn't exist
    if (!playerBar) {
      console.warn('Player bar not found, creating it...');
      playerBar = this.createPlayerBar();
      if (!playerBar) {
        console.error('Failed to create player bar');
        return false;
      }
    }
    
    console.log('Inserting player after episode element');
    
    // Remove player from current location if it exists
    const currentParent = playerBar.parentElement;
    if (currentParent) {
      playerBar.remove();
    }
    
    // Insert player after the episode element
    try {
      episodeElement.insertAdjacentElement('afterend', playerBar);
      console.log('Player inserted successfully');
    } catch (error) {
      console.error('Error inserting player:', error);
      return false;
    }
    
    // Force player to be visible - remove inline style and set display
    playerBar.removeAttribute('style');
    playerBar.style.display = 'block';
    playerBar.style.visibility = 'visible';
    playerBar.style.opacity = '1';
    
    console.log('Player bar display set to block, computed style:', window.getComputedStyle(playerBar).display);
    return true;
  }

  updatePlayer() {
    if (!this.currentEpisode) {
      console.warn('No current episode to update player');
      return;
    }

    const playerBar = document.getElementById('player-bar');
    if (!playerBar) {
      console.error('Player bar element not found in updatePlayer');
      return;
    }

    console.log('Updating player with episode:', this.currentEpisode.title);

    // Force show the player bar - remove any inline styles that might hide it
    playerBar.removeAttribute('style');
    playerBar.style.display = 'block';
    playerBar.style.visibility = 'visible';
    playerBar.style.opacity = '1';
    
    // Also show the sources container parent
    const sourcesContainer = document.getElementById('episode-sources');
    if (sourcesContainer) {
      sourcesContainer.style.display = 'none'; // Will be shown by loadSources if sources exist
    }

    // Update title with fallback
    const playerTitle = document.getElementById('player-title');
    if (playerTitle) {
      playerTitle.textContent = this.currentEpisode.title || 'Untitled Episode';
      console.log('Player title updated:', playerTitle.textContent);
    } else {
      console.warn('Player title element not found');
    }

    // Update date with fallback
    const playerDate = document.getElementById('player-date');
    if (playerDate) {
      playerDate.textContent = this.currentEpisode.formattedDate || 'Date not available';
      console.log('Player date updated:', playerDate.textContent);
    } else {
      console.warn('Player date element not found');
    }

    // Update audio with fallback
    const audioElement = document.getElementById('episode-audio');
    if (audioElement) {
      if (this.currentEpisode.audioUrl) {
        audioElement.src = this.currentEpisode.audioUrl;
        audioElement.load();
        console.log('Audio source set:', this.currentEpisode.audioUrl);
      } else {
        // Clear audio source if not available
        audioElement.src = '';
        console.warn('No audio URL available for episode');
      }
    } else {
      console.warn('Audio element not found');
    }
    
    console.log('Player update complete. Display:', window.getComputedStyle(playerBar).display);
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
      // Try to load sources from Backblaze B2 (still need proxy for external JSON)
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
    // Setup copy link button
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
      // Remove existing listeners to avoid duplicates
      copyBtn.replaceWith(copyBtn.cloneNode(true));
      const newCopyBtn = document.getElementById('copy-link-btn');
      newCopyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.copyEpisodeLink();
      });
    }
    
    // Setup close button
    const closeBtn = document.getElementById('close-player-btn');
    if (closeBtn) {
      // Remove existing listeners to avoid duplicates
      closeBtn.replaceWith(closeBtn.cloneNode(true));
      const newCloseBtn = document.getElementById('close-player-btn');
      newCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Close button clicked');
        this.closePlayer();
      });
      console.log('Close button event listener attached');
    } else {
      console.warn('Close button not found in setupPlayer');
    }
  }
  
  createPlayerBar() {
    const playerBar = document.createElement('div');
    playerBar.id = 'player-bar';
    playerBar.className = 'player-bar';
    playerBar.setAttribute('aria-label', 'Episode player');
    playerBar.style.display = 'none'; // Start hidden
    
    playerBar.innerHTML = `
      <button id="close-player-btn" class="btn-close-player" aria-label="Close player">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
      <div class="player-content">
        <div class="player-info">
          <p id="player-title" class="player-title"></p>
          <p id="player-date" class="player-date"></p>
        </div>
        <div class="player-controls">
          <audio id="episode-audio" controls preload="metadata" aria-label="Episode audio player">
            <p>Your browser doesn't support audio playback.</p>
          </audio>
          <button id="copy-link-btn" class="btn-copy-link" aria-label="Copy episode link">
            <span class="btn-text">Copy Link</span>
            <i class="fas fa-link btn-icon" aria-hidden="true"></i>  
          </button>
        </div>
      </div>
      <div id="episode-sources" class="episode-sources" style="display: none;"></div>
    `;
    
    // Re-attach event listeners
    this.setupPlayer();
    
    return playerBar;
  }

  closePlayer() {
    console.log('closePlayer called');
    
    const playerBar = document.getElementById('player-bar');
    const audioElement = document.getElementById('episode-audio');
    const sourcesContainer = document.getElementById('episode-sources');
    
    // Pause and clear audio first
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      audioElement.load();
    }
    
    // Hide sources
    if (sourcesContainer) {
      sourcesContainer.style.display = 'none';
    }
    
    // Hide player bar
    if (playerBar) {
      // Force hide with multiple methods
      playerBar.style.display = 'none';
      playerBar.style.visibility = 'hidden';
      playerBar.setAttribute('style', 'display: none !important;');
      
      // Move player back to end of episodes list (hidden)
      const episodesList = document.getElementById('episodes-list');
      if (episodesList && playerBar.parentElement !== episodesList) {
        playerBar.remove();
        episodesList.appendChild(playerBar);
        // Ensure it stays hidden
        playerBar.style.display = 'none';
      }
      
      console.log('Player bar hidden');
    }
    
    // Clear current episode
    this.currentEpisode = null;
    
    // Reset URL to show page (remove episode slug) - only if URL has a slug
    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts.length > 1 && pathParts[0] === this.showSlug) {
      // Has episode slug, remove it
      const showPath = '/' + pathParts[0];
      window.history.pushState(null, '', showPath);
      console.log('URL reset to:', showPath);
    }
    
    console.log('Player closed successfully');
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
      this.playEpisode(episode.id, episodeElement);
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

