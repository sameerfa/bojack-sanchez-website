class EpisodePageGenerator {
  constructor() {
    this.episodes = [];
    this.currentEpisode = null;
    this.episodeSlug = null; // Can be set externally for hash-based routing
    this.showConfig = null;
    this.init();
  }

  async init() {
    // Set show config if available from window
    if (window.currentShow) {
      this.showConfig = window.currentShow;
    } else {
      this.showConfig = {
        name: 'News in a Nutshell',
        slug: 'news-in-a-nutshell',
        rssUrl: 'https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/news-in-a-nutshell.rss'
      };
    }
    
    // Load episode data first
    await this.loadEpisodeData();
    
    // Determine episode slug from external assignment (router sets this)
    if (this.episodeSlug) {

      this.renderEpisodePage(this.episodeSlug);
    } else {
      
    }
  }

  async loadEpisodeData() {
    // Try to get episodes from localStorage first (from RSS parser)
    const storedEpisodes = localStorage.getItem('podcastEpisodes');
    if (storedEpisodes) {
      this.episodes = JSON.parse(storedEpisodes);

      return;
    }

    // If no cached data, fetch from RSS
    try {
      const rssUrl = 'https://f003.backblazeb2.com/file/bojack-sanchez-podcasts/news-in-a-nutshell.rss';
      const proxyUrl = 'https://api.allorigins.win/get?url=';
      
      const response = await fetch(`${proxyUrl}${encodeURIComponent(rssUrl)}`);
      const data = await response.json();
      
      if (data.contents) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
        const items = xmlDoc.querySelectorAll('item');
        
        this.episodes = Array.from(items).map(item => this.parseEpisode(item));
        localStorage.setItem('podcastEpisodes', JSON.stringify(this.episodes));
      }
    } catch (error) {
      console.error('Failed to load episode data:', error);
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

    const title = getTextContent('title');
    const description = getTextContent('description');
    const pubDate = getTextContent('pubDate');
    const duration = getTextContent('itunes\\:duration') || getTextContent('duration') || '00:02:00';
    
    // Extract audio URL from enclosure
    const audioUrl = getAttributeContent('enclosure', 'url');
    
    // Generate slug
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
      .replace(/-$/, '');

    const episode = {
      title,
      description,
      pubDate,
      formattedDate: this.formatDate(pubDate),
      link: getTextContent('link'),
      duration: this.formatDuration(duration),
      audioUrl,
      slug,
      guid: getTextContent('guid') || Math.random().toString(36).substr(2, 9)
    };

    // Debug logging
    
    
    return episode;
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

  renderEpisodePage(episodeSlug) {
    
    
    // Debug: log first few episodes and their audio URLs
    if (this.episodes.length > 0) {

    }
    
    // Find episode by slug or similar title
    this.currentEpisode = this.episodes.find(ep => 
      ep.slug === episodeSlug || 
      ep.title.toLowerCase().includes(episodeSlug.replace(/-/g, ' '))
    );

    if (!this.currentEpisode && this.episodes.length > 0) {
      // Fallback to first episode
      
      this.currentEpisode = this.episodes[0];
    }

    if (!this.currentEpisode) {
      this.renderNotFound();
      return;
    }

    

    // Update page metadata
    this.updatePageMetadata();
    
    // Render episode content
    this.renderEpisodeContent();
    
    // Load related episodes
    this.renderRelatedEpisodes();
  }

  updatePageMetadata() {
    if (!this.currentEpisode) return;

    const showName = this.showConfig ? this.showConfig.name : 'News in a Nutshell';
    
    // Update page title
    document.title = `${this.currentEpisode.title} | ${showName}`;
    
    
    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = this.currentEpisode.description.substring(0, 160) + '...';

    // Add Open Graph metadata for social sharing
    this.addMetaTag('property', 'og:title', this.currentEpisode.title);
    this.addMetaTag('property', 'og:description', this.currentEpisode.description.substring(0, 200));
    this.addMetaTag('property', 'og:type', 'article');
    this.addMetaTag('property', 'og:url', window.location.href);
    
    // Add Twitter Card metadata
    this.addMetaTag('name', 'twitter:card', 'summary');
    this.addMetaTag('name', 'twitter:title', this.currentEpisode.title);
    this.addMetaTag('name', 'twitter:description', this.currentEpisode.description.substring(0, 200));
  }

  addMetaTag(attrName, attrValue, content) {
    let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attrName, attrValue);
      document.head.appendChild(tag);
    }
    tag.content = content;
  }

  renderEpisodeContent() {
    // Render page header content
    const pageHeaderContainer = document.getElementById('episode-page-header');
    if (pageHeaderContainer && this.currentEpisode) {
      const showName = this.showConfig ? this.showConfig.name : 'News in a Nutshell';
      const showSlug = this.showConfig ? this.showConfig.slug : 'news-in-a-nutshell';
      
      pageHeaderContainer.innerHTML = `
        <div class="episode-header">
          <a href="/${showSlug}/" class="back-link">← Back to ${showName}</a>
          <h1>${this.currentEpisode.title}</h1>
        </div>
      `;
    }

    // Initialize background animation for episode page
    this.initializeEpisodeAnimation();

    // Render main episode content
    const container = document.querySelector('#episode-page-content .episode-detail .container');
    if (!container || !this.currentEpisode) return;

    container.innerHTML = `
      <article class="episode-content">
        
        <div class="episode-player">
          ${this.createAudioPlayer()}
        </div>

        <div class="episode-info">
          <div class="episode-published">
            <strong>Published:</strong> ${this.currentEpisode.formattedDate}
          </div>
          <div class="episode-duration-info">
            <strong>Duration:</strong> ${this.currentEpisode.duration}
          </div>
        </div>

        <div class="episode-description">
          <p>${this.currentEpisode.description}</p>
        </div>

        <div class="episode-actions">
          <div class="listen-buttons">
            <h4>Listen Everywhere</h4>
            <div class="platform-buttons">
                             <a href="https://open.spotify.com/show/56qcPE9A13bq7wrEberN23?si=fa5743975e0c41a2" target="_blank" class="btn btn-spotify">
                 <i class="fab fa-spotify"></i> Listen on Spotify
               </a>
               <a href="https://podcasts.apple.com/us/podcast/news-in-a-nutshell/id1805652294" target="_blank" class="btn btn-apple">
                 <i class="fab fa-apple"></i> Apple Podcasts
               </a>
               <a href="https://music.amazon.com/podcasts/7fdb3b7b-808c-4cbb-a9e0-8e10ea93e7f8/news-in-a-nutshell" target="_blank" class="btn btn-amazon">
                 <i class="fab fa-amazon"></i> Amazon Music
               </a>
            </div>
          </div>

          <div class="share-buttons">
            <h4>Share this Episode</h4>
                         <div class="social-share">
               <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(this.currentEpisode.title)}&url=${encodeURIComponent(window.location.href)}&via=bojacksanchez" target="_blank" class="share-btn twitter">
                 <i class="fab fa-twitter"></i> Twitter
               </a>
               <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}" target="_blank" class="share-btn facebook">
                 <i class="fab fa-facebook"></i> Facebook
               </a>
               <a href="mailto:?subject=${encodeURIComponent(this.currentEpisode.title)}&body=Check out this episode: ${encodeURIComponent(window.location.href)}" class="share-btn email">
                 <i class="fas fa-envelope"></i> Email
               </a>
               <button onclick="navigator.clipboard.writeText('${window.location.href}')" class="share-btn copy">
                 <i class="fas fa-copy"></i> Copy Link
               </button>
             </div>
          </div>
        </div>
      </article>

      <div class="related-episodes">
        <h3>More Episodes</h3>
        <div class="related-grid" id="related-episodes-grid">
          <!-- Related episodes will be populated -->
        </div>
      </div>
    `;
  }

  createAudioPlayer() {
    
    
    if (!this.currentEpisode.audioUrl) {
      
      return `
        <div class="audio-placeholder">
          <div class="placeholder-content">
            <h3>🎧 Audio Player</h3>
            <p>Audio streaming will be available once the direct audio URL is provided in the RSS feed.</p>
            <p><small>Debug: No audioUrl found in episode data</small></p>
                         <div class="placeholder-buttons">
               <a href="https://open.spotify.com/show/56qcPE9A13bq7wrEberN23?si=fa5743975e0c41a2" target="_blank" class="btn btn-spotify">
                 <i class="fab fa-spotify"></i> Listen on Spotify
               </a>
               <a href="https://podcasts.apple.com/us/podcast/news-in-a-nutshell/id1805652294" target="_blank" class="btn btn-apple">
                 <i class="fab fa-apple"></i> Listen on Apple
               </a>
             </div>
          </div>
        </div>
      `;
    }

    

    return `
      <div class="custom-audio-player" id="audio-player-container">
        <audio id="episode-audio" preload="metadata" crossorigin="anonymous">
          <source src="${this.currentEpisode.audioUrl}" type="audio/mpeg">
          <source src="${this.currentEpisode.audioUrl}" type="audio/mp3">
          <source src="${this.currentEpisode.audioUrl}" type="audio/wav">
          <p>Your browser doesn't support audio playback. <a href="${this.currentEpisode.audioUrl}">Download the episode</a></p>
        </audio>
        
        <div class="audio-controls">
          <button id="play-pause-btn" class="play-btn">
            <i class="fas fa-play play-icon"></i>
            <i class="fas fa-pause pause-icon" style="display: none;"></i>
          </button>
          
          <div class="progress-container">
            <div class="time-display">
              <span id="current-time">0:00</span>
            </div>
            <div class="progress-bar">
              <div id="progress-fill"></div>
              <input type="range" id="progress-slider" min="0" max="100" value="0" step="0.1">
            </div>
            <div class="time-display">
              <span id="total-time">${this.currentEpisode.duration}</span>
            </div>
          </div>
          
          <div class="volume-control">
            <i class="fas fa-volume-up"></i>
            <input type="range" id="volume-slider" min="0" max="100" value="70" step="1">
          </div>
        </div>
      </div>
    `;
  }

  renderRelatedEpisodes() {
    const container = document.getElementById('related-episodes-grid');
    if (!container || this.episodes.length <= 1) return;

    // Get 3 other random episodes
    const otherEpisodes = this.episodes
      .filter(ep => ep.guid !== this.currentEpisode.guid)
      .slice(0, 3);

    const showSlug = this.showConfig ? this.showConfig.slug : 'news-in-a-nutshell';
    
    container.innerHTML = otherEpisodes.map(episode => `
      <article class="episode-card" onclick="window.location.href='/${showSlug}/${episode.slug}'">
        <div class="episode-date">${episode.formattedDate}</div>
        <h4 class="episode-title">${episode.title}</h4>
        <p class="episode-description">${episode.description.substring(0, 120)}...</p>
        <div class="episode-meta">
          <span class="episode-duration">${episode.duration}</span>
        </div>
      </article>
    `).join('');
  }

  renderEpisodeList() {
    const container = document.querySelector('#episode-page-content .episode-detail .container');
    if (container) {
      const showSlug = this.showConfig ? this.showConfig.slug : 'news-in-a-nutshell';
      const showName = this.showConfig ? this.showConfig.name : 'News in a Nutshell';
      
      container.innerHTML = `
        <div class="episode-list-redirect">
          <h1>Choose an Episode</h1>
          <p>Please select an episode from our archive.</p>
          <a href="/${showSlug}/" class="btn btn-primary">View All ${showName} Episodes →</a>
        </div>
      `;
    }
  }

  renderNotFound() {
    const container = document.querySelector('#episode-page-content .episode-detail .container');
    if (container) {
      const showSlug = this.showConfig ? this.showConfig.slug : 'news-in-a-nutshell';
      const showName = this.showConfig ? this.showConfig.name : 'News in a Nutshell';
      
      container.innerHTML = `
        <div class="not-found">
          <h1>Episode Not Found</h1>
          <p>Sorry, we couldn't find that episode.</p>
          <a href="/${showSlug}/" class="btn btn-primary">← Back to ${showName}</a>
        </div>
      `;
    }
  }

  initializeEpisodeAnimation() {
    // Initialize background animation for the episode page canvas
    const episodeCanvasContainer = document.getElementById('canvas-container-episode');
    if (episodeCanvasContainer && typeof SoundWaveAnimation !== 'undefined') {
      // Set the container as the target for the animation
      const tempContainer = document.getElementById('canvas-container');
      if (tempContainer) {
        tempContainer.remove();
      }
      
      // Create new canvas container for episode page
      episodeCanvasContainer.id = 'canvas-container';
      
      // Initialize the animation
      setTimeout(() => {
        if (typeof SoundWaveAnimation !== 'undefined') {
          window.episodeAnimation = new SoundWaveAnimation();
        }
      }, 100);
    }
  }

  // Method to load and render a specific episode (called by router)
  async loadAndRenderEpisode(episodeSlug) {

    this.episodeSlug = episodeSlug;
    
    // If episodes aren't loaded yet, load them first
    if (this.episodes.length === 0) {
      await this.loadEpisodeData();
    }
    
    // Render the episode page
    this.renderEpisodePage(episodeSlug);
  }
}

// Enhanced Audio Player with robust state management
class EnhancedAudioPlayer {
  constructor() {
    this.audio = null;
    this.isInitialized = false;
    this.isPlaying = false;
    this.isDragging = false;
    this.currentTime = 0;
    this.duration = 0;
    
    this.elements = {};
    this.init();
  }

  init() {
    // Get DOM elements
    this.audio = document.getElementById('episode-audio');
    this.elements = {
      playPauseBtn: document.getElementById('play-pause-btn'),
      progressSlider: document.getElementById('progress-slider'),
      volumeSlider: document.getElementById('volume-slider'),
      currentTimeDisplay: document.getElementById('current-time'),
      totalTimeDisplay: document.getElementById('total-time'),
      progressFill: document.getElementById('progress-fill'),
      playIcon: document.querySelector('.play-icon'),
      pauseIcon: document.querySelector('.pause-icon'),
      volumeIcon: document.querySelector('.volume-icon')
    };

    if (!this.audio || !this.elements.playPauseBtn) {
      console.warn('Audio player elements not found');
      return;
    }

    this.setupEventListeners();
    this.setInitialState();
    this.isInitialized = true;
  }

  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  updateProgress() {
    if (this.isDragging || !this.audio || !this.audio.duration || isNaN(this.audio.duration)) return;
    
    const progress = (this.audio.currentTime / this.audio.duration) * 100;
    this.elements.progressSlider.value = progress;
    this.elements.progressFill.style.width = `${progress}%`;
    this.elements.currentTimeDisplay.textContent = this.formatTime(this.audio.currentTime);
  }

  updateDuration() {
    if (!this.audio || !this.audio.duration || isNaN(this.audio.duration)) return;
    
    this.duration = this.audio.duration;
    this.elements.totalTimeDisplay.textContent = this.formatTime(this.duration);
  }

  resetProgress() {
    this.elements.progressSlider.value = 0;
    this.elements.progressFill.style.width = '0%';
    this.elements.currentTimeDisplay.textContent = '0:00';
    this.showPlayIcon();
  }

  showPlayIcon() {
    this.elements.playIcon.style.display = 'inline';
    this.elements.pauseIcon.style.display = 'none';
    this.isPlaying = false;
  }

  showPauseIcon() {
    this.elements.playIcon.style.display = 'none';
    this.elements.pauseIcon.style.display = 'inline';
    this.isPlaying = true;
  }

  setupEventListeners() {
    // Play/Pause button
    this.elements.playPauseBtn.addEventListener('click', () => {
      if (this.audio.paused) {
        this.audio.play().then(() => {
          this.showPauseIcon();
        }).catch(err => {
          console.error('Play failed:', err);
          this.showPlayIcon();
        });
      } else {
        this.audio.pause();
        this.showPlayIcon();
      }
    });

    // Audio events
    this.audio.addEventListener('loadedmetadata', () => {
      this.updateDuration();
    });

    this.audio.addEventListener('durationchange', () => {
      this.updateDuration();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.updateProgress();
    });

    this.audio.addEventListener('ended', () => {
      this.resetProgress();
    });

    this.audio.addEventListener('pause', () => {
      this.showPlayIcon();
    });

    this.audio.addEventListener('play', () => {
      this.showPauseIcon();
    });

    this.audio.addEventListener('loadstart', () => {
      this.resetProgress();
      this.elements.totalTimeDisplay.textContent = '--:--';
    });

    this.audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      this.resetProgress();
      this.elements.totalTimeDisplay.textContent = 'Error';
    });

    // Progress slider events
    this.elements.progressSlider.addEventListener('mousedown', () => {
      this.isDragging = true;
    });

    this.elements.progressSlider.addEventListener('mouseup', () => {
      this.isDragging = false;
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        const time = (this.elements.progressSlider.value / 100) * this.audio.duration;
        this.audio.currentTime = time;
      }
    });

    this.elements.progressSlider.addEventListener('input', () => {
      if (this.isDragging && this.audio.duration && !isNaN(this.audio.duration)) {
        const progress = this.elements.progressSlider.value;
        this.elements.progressFill.style.width = `${progress}%`;
        
        // Update time display while dragging
        const time = (progress / 100) * this.audio.duration;
        this.elements.currentTimeDisplay.textContent = this.formatTime(time);
      }
    });

    // Volume slider
    this.elements.volumeSlider.addEventListener('input', () => {
      const volume = this.elements.volumeSlider.value / 100;
      this.audio.volume = volume;
      
      // Update volume icon
      if (volume === 0) {
        this.elements.volumeIcon.className = 'fas fa-volume-mute';
      } else if (volume < 0.5) {
        this.elements.volumeIcon.className = 'fas fa-volume-down';
      } else {
        this.elements.volumeIcon.className = 'fas fa-volume-up';
      }
    });
  }

  setInitialState() {
    // Set initial volume
    this.audio.volume = 0.7;
    this.elements.volumeSlider.value = 70;
    
    // Reset UI state
    this.resetProgress();
    
    // Try to get duration immediately if available
    if (this.audio.duration && !isNaN(this.audio.duration)) {
      this.updateDuration();
    }
  }
}

// Initialize audio player functionality
function initializeAudioPlayer() {
  // Clean up any existing player
  if (window.audioPlayerInstance) {
    window.audioPlayerInstance = null;
  }
  
  // Create new enhanced audio player
  window.audioPlayerInstance = new EnhancedAudioPlayer();
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  new EpisodePageGenerator();
  
  // Initialize audio player after a short delay to ensure DOM is ready
  setTimeout(initializeAudioPlayer, 500);
}); 