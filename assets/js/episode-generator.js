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
    
    // Extract episode timestamp from audio URL for source JSON lookup
    const episodeTimestamp = this.extractEpisodeTimestamp(audioUrl);
    
    // Generate slug
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/-$/, '');

    const episode = {
      title,
      description,
      pubDate,
      formattedDate: this.formatDate(pubDate),
      link: getTextContent('link'),
      duration: this.formatDuration(duration),
      audioUrl,
      episodeTimestamp,
      slug,
      guid: getTextContent('guid') || Math.random().toString(36).substr(2, 9),
      sources: null // Will be loaded separately
    };

    // Debug logging
    
    
    return episode;
  }

  extractEpisodeTimestamp(audioUrl) {
    if (!audioUrl) return null;
    
    // Extract timestamp pattern like "2025-06-08T12-32-27" from audio URL
    const timestampMatch = audioUrl.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return timestampMatch ? timestampMatch[1] : null;
  }

  async loadEpisodeSources(episode) {
    if (!episode.episodeTimestamp) return null;
    
    try {
      const jsonUrl = `/assets/data/shows/news-in-a-nutshell/${episode.episodeTimestamp}.json`;
      const response = await fetch(jsonUrl);
      
      if (response.ok) {
        const sourceData = await response.json();
        return sourceData.sources || [];
      }
    } catch (error) {
      console.warn(`Could not load sources for episode ${episode.episodeTimestamp}:`, error);
    }
    
    return null;
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

  async renderEpisodePage(episodeSlug) {
    
    
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

    // Load episode sources
    if (this.currentEpisode.episodeTimestamp) {
      this.currentEpisode.sources = await this.loadEpisodeSources(this.currentEpisode);
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
          <h1>${this.currentEpisode.title}</h1>
        </div>
        <a href="/${showSlug}/" class="back-link">← Back to ${showName}</a>
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
               <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(this.currentEpisode.title)}&url=${encodeURIComponent(window.location.href)}"
                 target="_blank" class="share-btn twitter">
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

        ${this.renderEpisodeSources()}

      </article>

      <div class="related-episodes">
        <h3>More Episodes</h3>
        <div class="related-grid" id="related-episodes-grid">
          <!-- Related episodes will be populated -->
        </div>
      </div>
    `;
  }

  renderEpisodeSources() {
    if (!this.currentEpisode.sources || this.currentEpisode.sources.length === 0) {
      return ''; // No sources section if no sources available
    }

    const sourcesHtml = this.currentEpisode.sources.map(source => `
      <div class="source-item">
        <a href="${source.url}" target="_blank" rel="noopener noreferrer" class="source-link">
          <div class="source-content">
            <div class="source-title">${source.title}</div>
            <div class="source-domain">${source.domain}</div>
          </div>
          <i class="fas fa-external-link-alt"></i>
        </a>
      </div>
    `).join('');

    return `
      <div class="episode-sources">
        <h4><i class="fas fa-newspaper"></i> News Sources</h4>
        <p class="sources-intro">This episode was compiled from the following news sources:</p>
        <div class="sources-grid">
          ${sourcesHtml}
        </div>
        <p class="sources-note">
          <small><i class="fas fa-info-circle"></i> 
          Sources are automatically collected and verified. Click any link to read the full article.</small>
        </p>
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
      <div class="plyr-audio-container">
        <audio id="episode-audio" controls preload="metadata" data-plyr-config='{"hideControls":false}'>
          <source src="${this.currentEpisode.audioUrl}" type="audio/mpeg">
          <source src="${this.currentEpisode.audioUrl}" type="audio/mp3">
          <source src="${this.currentEpisode.audioUrl}" type="audio/wav">
          <p>Your browser doesn't support audio playback. <a href="${this.currentEpisode.audioUrl}">Download the episode</a></p>
        </audio>
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
    
    // Render the episode page (now async)
    await this.renderEpisodePage(episodeSlug);
  }
}

// Initialize Plyr Audio Player
function initializeAudioPlayer() {
  // Clean up any existing Plyr instance
  if (window.plyrInstance) {
    window.plyrInstance.destroy();
    window.plyrInstance = null;
  }
  
  const audioElement = document.getElementById('episode-audio');
  if (!audioElement) {
    console.warn('Audio element not found for Plyr initialization');
    return;
  }

  // Initialize Plyr with custom configuration
  window.plyrInstance = new Plyr(audioElement, {
    controls: [
      'play-large', 
      'play', 
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
    crossorigin: null // Disable CORS requirements
  });

  // Add event listeners for analytics or custom behavior
  window.plyrInstance.on('ready', () => {
    console.log('Plyr audio player ready');
  });

  window.plyrInstance.on('loadeddata', () => {
    console.log('Audio data loaded');
  });

  window.plyrInstance.on('play', () => {
    console.log('Audio started playing');
  });

  window.plyrInstance.on('pause', () => {
    console.log('Audio paused');
  });

  window.plyrInstance.on('ended', () => {
    console.log('Audio finished playing');
  });

  return window.plyrInstance;
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  new EpisodePageGenerator();
  
  // Initialize audio player after a short delay to ensure DOM is ready
  setTimeout(initializeAudioPlayer, 500);
}); 