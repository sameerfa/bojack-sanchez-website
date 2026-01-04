class PodcastRSSParser {
  constructor(showConfig = null) {
    // Show configuration
    this.showConfig = showConfig || {
      name: 'News in a Nutshell',
      slug: 'news-in-a-nutshell', 
      rssUrl: '/assets/rss/news-in-a-nutshell.rss'
    };
    
    this.rssUrl = this.showConfig.rssUrl;
    this.episodes = [];
    this.currentPage = 1;
    this.episodesPerPage = 9;
    
    this.init();
  }

  async init() {
    try {
      await this.fetchEpisodes();
      this.renderHomepageEpisodes();
      this.renderAllEpisodesPage();
      this.updateStats();
      this.setupEventListeners();
      this.generateEpisodePages();
    } catch (error) {
      console.error('Failed to initialize podcast RSS parser:', error);
      this.showError();
    }
  }

  async fetchEpisodes() {
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
      
      if (!xmlContent) {
        throw new Error('No content received');
      }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('XML parsing error');
      }
      
      const items = xmlDoc.querySelectorAll('item');
      if (items.length === 0) {
        throw new Error('No episodes found in RSS feed');
      }
      
      this.episodes = Array.from(items).map(item => this.parseEpisode(item));
      
      // Save episodes to localStorage for episode pages
      localStorage.setItem('podcastEpisodes', JSON.stringify(this.episodes));
      
    } catch (error) {
      console.error('🚨 Failed to fetch RSS feed:', error.message);
      console.error(`📍 RSS URL: ${this.rssUrl}`);
      console.error('📍 This might be due to:');
      console.error('  - RSS feed file not found');
      console.error('  - Network connectivity issues');
      console.error('  - Invalid XML format');
      // Use fallback mock data
      this.episodes = this.getMockEpisodes();
      localStorage.setItem('podcastEpisodes', JSON.stringify(this.episodes));
    }
  }

  parseRSS2JSONEpisode(item) {
    // Parse episode from rss2json format
    const title = item.title || '';
    const description = item.description || item.content || '';
    const pubDate = item.pubDate || '';
    const link = item.link || '';
    const guid = item.guid || Math.random().toString(36).substr(2, 9);
    
    // Try to extract audio URL from enclosure
    const audioUrl = item.enclosure?.link || null;
    
    // Try to extract duration from description or other fields
    let duration = '02:00'; // Default fallback
    
    // Look for duration patterns in description (many RSS feeds include this info)
    const durationMatches = description.match(/(?:duration|length|runtime):\s*(\d{1,2}:\d{2}(?::\d{2})?)/i) ||
                           description.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:duration|long|minutes)/i) ||
                           description.match(/\b(\d{1,2}:\d{2})\b/g);
    
    if (durationMatches && durationMatches[1]) {
      duration = durationMatches[1];
    } else if (item.duration) {
      // Some RSS2JSON implementations might include duration
      duration = item.duration;
    }
    
    // Generate episode slug for individual pages
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/-$/, '');
    
    // Extract episode timestamp from audio URL for JSON file lookup
    const episodeTimestamp = this.extractEpisodeTimestamp(audioUrl);

    return {
      title: title,
      description: description,
      pubDate: pubDate,
      formattedDate: this.formatDate(pubDate),
      link: link,
      duration: this.formatDuration(duration),
      guid: guid,
      slug: slug,
      mediaUrl: audioUrl,
      audioUrl: audioUrl,
      episodeTimestamp: episodeTimestamp,
      spotifyUrl: this.extractSpotifyUrl(description, link),
      episodeNumber: this.extractEpisodeNumber(title, guid),
      sources: null // Will be loaded separately
    };
  }

  parseEpisode(item) {
    const getTextContent = (selector) => {
      let element = item.querySelector(selector);
      if (!element && selector.includes('itunes')) {
        // Try without namespace prefix
        const selectorWithoutNS = selector.split(':')[1];
        element = item.querySelector(selectorWithoutNS);
      }
      if (!element && selector.includes('itunes')) {
        // Try with different namespace methods
        const tagName = selector.split(':')[1];
        element = Array.from(item.children).find(child => 
          child.tagName.toLowerCase() === `itunes:${tagName}` || 
          child.localName === tagName
        );
      }
      return element ? element.textContent.trim() : '';
    };

    const getAttributeContent = (selector, attribute) => {
      const element = item.querySelector(selector);
      return element ? element.getAttribute(attribute) : '';
    };

    const pubDate = getTextContent('pubDate');
    // Try multiple ways to get duration from iTunes namespace
    let duration = '00:02:00'; // Default fallback
    
    // Try various methods to get iTunes duration
    try {
      // Method 1: Standard iTunes namespace
      duration = getTextContent('itunes\\:duration');
      
      // Method 2: Direct search through all child elements
      if (!duration || duration === '00:02:00') {
        const durationElement = Array.from(item.children).find(child => 
          child.tagName.toLowerCase() === 'itunes:duration' ||
          child.localName === 'duration' ||
          child.nodeName.toLowerCase() === 'itunes:duration'
        );
        if (durationElement) {
          duration = durationElement.textContent.trim();
        }
      }
      
      // Method 3: Namespace methods
      if (!duration || duration === '00:02:00') {
        duration = item.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'duration')[0]?.textContent ||
                   item.querySelector('[*|duration]')?.textContent ||
                   getTextContent('duration') ||
                   '00:02:00';
      }
    } catch (error) {
      console.warn('Error parsing duration:', error);
      duration = '00:02:00';
    }
    const description = getTextContent('description');
    const title = getTextContent('title');
    const guid = getTextContent('guid') || Math.random().toString(36).substr(2, 9);
    
    // Try to extract audio/media URLs
    const enclosureUrl = getAttributeContent('enclosure', 'url');
    const mediaUrl = getAttributeContent('media\\:content', 'url') || enclosureUrl;
    
    // Debug logging for duration parsing
    if (duration && duration !== '00:02:00') {
      console.log(`✅ Found duration for "${title.substring(0, 50)}...": ${duration} → formatted: ${this.formatDuration(duration)}`);
    } else {
      console.warn(`⚠️ No duration found for "${title.substring(0, 50)}...", using fallback`);
      // Try to find any duration-related elements for debugging
      const allElements = Array.from(item.children).map(el => `${el.tagName || el.nodeName}${el.localName ? `(${el.localName})` : ''}`);
      console.log('Available elements:', allElements);
      
      // Check if iTunes namespace elements exist
      const itunesElements = allElements.filter(el => el.toLowerCase().includes('itunes') || el.toLowerCase().includes('duration'));
      if (itunesElements.length > 0) {
        console.log('iTunes/duration related elements:', itunesElements);
      }
    }
    
    // Generate episode slug for individual pages
    const slug = title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/-$/, '');
    
    // Extract episode timestamp from audio URL for JSON file lookup
    const episodeTimestamp = this.extractEpisodeTimestamp(enclosureUrl || mediaUrl);

    return {
      title: title,
      description: description,
      pubDate: pubDate,
      formattedDate: this.formatDate(pubDate),
      link: getTextContent('link'),
      duration: this.formatDuration(duration),
      guid: guid,
      slug: slug,
      mediaUrl: mediaUrl,
      audioUrl: enclosureUrl,
      episodeTimestamp: episodeTimestamp,
      // We'll add Spotify URL detection
      spotifyUrl: this.extractSpotifyUrl(description, getTextContent('link')),
      episodeNumber: this.extractEpisodeNumber(title, guid),
      sources: null // Will be loaded separately
    };
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
    if (!duration || duration === 'undefined' || duration === 'null') {
      return '02:00';
    }
    
    // If already in time format, return as is
    if (duration.includes(':')) {
      // Ensure it's in MM:SS or HH:MM:SS format
      const parts = duration.split(':');
      if (parts.length === 2) {
        return duration; // MM:SS format
      } else if (parts.length === 3) {
        // HH:MM:SS format - convert to MM:SS if under 1 hour
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseInt(parts[2]);
        if (hours === 0) {
          return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return duration; // Keep HH:MM:SS for longer episodes
      }
      return duration;
    }
    
    // Convert seconds to MM:SS format
    const seconds = parseInt(duration);
    if (isNaN(seconds)) {
      console.warn('Invalid duration format:', duration);
      return '02:00';
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    // For episodes over 60 minutes, use HH:MM:SS format
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  extractSpotifyUrl(description, link) {
    // Check for Spotify URLs in description or link
    const spotifyRegex = /(?:https?:\/\/)?(?:open\.)?spotify\.com\/(?:embed\/)?episode\/([a-zA-Z0-9]+)/;
    
    // Check description first
    const descMatch = description.match(spotifyRegex);
    if (descMatch) {
      return `https://open.spotify.com/episode/${descMatch[1]}`;
    }
    
    // Check link
    const linkMatch = link.match(spotifyRegex);
    if (linkMatch) {
      return `https://open.spotify.com/episode/${linkMatch[1]}`;
    }
    
    // For now, return a placeholder - we'll need to manually map or find the pattern
    return null;
  }

  extractEpisodeNumber(title, guid) {
    // Try to extract episode number from title or guid
    const numberMatch = title.match(/episode\s*(\d+)|#(\d+)|ep\.?\s*(\d+)/i);
    if (numberMatch) {
      return parseInt(numberMatch[1] || numberMatch[2] || numberMatch[3]);
    }
    
    // Try to extract from guid if it contains episode info
    const guidMatch = guid.match(/episode[-_]?(\d+)|ep[-_]?(\d+)/i);
    if (guidMatch) {
      return parseInt(guidMatch[1] || guidMatch[2]);
    }
    
    return null;
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

  renderHomepageEpisodes() {
    const container = document.getElementById('episodes-grid');
    if (!container) return;

    container.classList.remove('loading');
    
    const latestEpisodes = this.episodes.slice(0, 6); // Show 6 episodes on homepage
    container.innerHTML = latestEpisodes.map(episode => this.createEpisodeCard(episode)).join('');

    // Setup load more button
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn && this.episodes.length > 6) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.addEventListener('click', () => this.loadMoreEpisodes());
    }
  }

  renderAllEpisodesPage() {
    const container = document.getElementById('all-episodes-grid');
    if (!container) return;

    container.classList.remove('loading');
    this.renderPage(this.currentPage);
    this.setupPagination();
    this.setupSearch();
    this.setupFilters();
  }

  renderPage(page) {
    const container = document.getElementById('all-episodes-grid');
    if (!container) return;

    // Clear filtered episodes when rendering full page
    this.filteredEpisodes = null;
    this.currentPage = page;
    const startIndex = (page - 1) * this.episodesPerPage;
    const endIndex = startIndex + this.episodesPerPage;
    const pageEpisodes = this.episodes.slice(startIndex, endIndex);

    container.innerHTML = pageEpisodes.map(episode => this.createEpisodeCard(episode)).join('');

    // Update pagination
    this.updatePaginationControls();
  }

  createEpisodeCard(episode) {
    const episodeUrl = `/${this.showConfig.slug}/${episode.slug}`;
    return `
      <article class="episode-card" data-episode-id="${episode.guid}" onclick="window.location.href='${episodeUrl}'">
        <div class="episode-date">${episode.formattedDate}</div>
        <h3 class="episode-title">${episode.title}</h3>
        <p class="episode-description">${episode.description.substring(0, 120)}...</p>
        <div class="episode-meta">
          <div class="episode-links">
            <a href="https://open.spotify.com/show/56qcPE9A13bq7wrEberN23?si=fa5743975e0c41a2" target="_blank" class="platform-btn spotify-btn" onclick="event.stopPropagation();">
              <i class="fab fa-spotify"></i>
            </a>
            <a href="https://podcasts.apple.com/us/podcast/news-in-a-nutshell/id1805652294" target="_blank" class="platform-btn apple-btn" onclick="event.stopPropagation();">
              <i class="fab fa-apple"></i>
            </a>
            <span class="view-episode">
              <i class="fas fa-play"></i> View Episode
            </span>
          </div>
          <span class="episode-duration">${episode.duration}</span>
        </div>
      </article>
    `;
  }

  loadMoreEpisodes() {
    const container = document.getElementById('episodes-grid');
    const loadMoreBtn = document.getElementById('load-more');
    
    if (!container) return;

    const currentCount = container.children.length;
    const nextEpisodes = this.episodes.slice(currentCount, currentCount + 6);
    
    nextEpisodes.forEach(episode => {
      container.insertAdjacentHTML('beforeend', this.createEpisodeCard(episode));
    });

    if (currentCount + nextEpisodes.length >= this.episodes.length) {
      loadMoreBtn.style.display = 'none';
    }
  }

  setupPagination() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          if (this.filteredEpisodes) {
            this.renderFilteredPage(this.currentPage);
          } else {
            this.renderPage(this.currentPage);
          }
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const episodes = this.filteredEpisodes || this.episodes;
        const totalPages = Math.ceil(episodes.length / this.episodesPerPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          if (this.filteredEpisodes) {
            this.renderFilteredPage(this.currentPage);
          } else {
            this.renderPage(this.currentPage);
          }
        }
      });
    }
  }

  updatePaginationControls() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    const totalPages = Math.ceil(this.episodes.length / this.episodesPerPage);
    
    if (prevBtn) {
      prevBtn.disabled = this.currentPage === 1;
    }
    
    if (nextBtn) {
      nextBtn.disabled = this.currentPage === totalPages;
    }
    
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }
  }

  setupSearch() {
    const searchInput = document.getElementById('search-episodes');
    if (!searchInput) return;

    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.performSearch(e.target.value);
      }, 300);
    });
  }

  performSearch(query) {
    if (!query.trim()) {
      this.currentPage = 1;
      this.renderPage(1);
      return;
    }

    this.filteredEpisodes = this.episodes.filter(episode =>
      episode.title.toLowerCase().includes(query.toLowerCase()) ||
      episode.description.toLowerCase().includes(query.toLowerCase())
    );

    // Render first page of search results
    this.currentPage = 1;
    this.renderFilteredPage(1);
  }

  renderFilteredPage(page) {
    const container = document.getElementById('all-episodes-grid');
    if (!container) return;

    const episodes = this.filteredEpisodes || this.episodes;
    this.currentPage = page;
    const startIndex = (page - 1) * this.episodesPerPage;
    const endIndex = startIndex + this.episodesPerPage;
    const pageEpisodes = episodes.slice(startIndex, endIndex);

    container.innerHTML = pageEpisodes.map(episode => this.createEpisodeCard(episode)).join('');

    // Update pagination for filtered results
    this.updateFilteredPaginationControls();
  }

  updateFilteredPaginationControls() {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    const episodes = this.filteredEpisodes || this.episodes;
    const totalPages = Math.ceil(episodes.length / this.episodesPerPage);
    
    if (prevBtn) {
      prevBtn.disabled = this.currentPage === 1;
    }
    
    if (nextBtn) {
      nextBtn.disabled = this.currentPage === totalPages;
    }
    
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}${this.filteredEpisodes ? ` (${episodes.length} results)` : ''}`;
    }
  }

  setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active class from all buttons
        filterBtns.forEach(b => b.classList.remove('active'));
        // Add active class to clicked button
        e.target.classList.add('active');
        
        const filter = e.target.dataset.filter;
        this.applyFilter(filter);
      });
    });
  }

  applyFilter(filter) {
    // Clear search input when applying filter
    const searchInput = document.getElementById('search-episodes');
    if (searchInput) {
      searchInput.value = '';
    }
    
    switch (filter) {
      case 'recent':
        this.filteredEpisodes = this.episodes.slice(0, 30);
        break;
      case 'popular':
        // For now, just show recent episodes
        this.filteredEpisodes = this.episodes.slice(0, 20);
        break;
      default:
        this.filteredEpisodes = null; // Show all episodes
    }

    this.currentPage = 1;
    if (this.filteredEpisodes) {
      this.renderFilteredPage(1);
    } else {
      this.renderPage(1);
    }
  }

  setupEventListeners() {
    // Event listeners for other functionality can be added here
    // Episode card clicks are now handled by direct navigation in the HTML
  }

  generateEpisodePages() {
    // Store episodes in localStorage for individual page generation
    if (this.episodes.length > 0) {
      localStorage.setItem('podcastEpisodes', JSON.stringify(this.episodes));

    }
  }


  updateStats() {
    // Update total episodes count
    const totalEpisodesElements = document.querySelectorAll('#total-episodes, #about-total-episodes');
    totalEpisodesElements.forEach(element => {
      if (element) {
        element.textContent = this.episodes.length;
      }
    });

    // Update launch date if available
    if (this.episodes.length > 0) {
      const oldestEpisode = this.episodes[this.episodes.length - 1];
      const launchYear = new Date(oldestEpisode.pubDate).getFullYear();
      const launchDateElement = document.getElementById('launch-date');
      if (launchDateElement) {
        launchDateElement.textContent = launchYear;
      }
    }
  }

  showError() {
    const containers = ['episodes-grid', 'all-episodes-grid'];
    containers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <div class="error-message" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <h3 style="color: var(--primary-color); margin-bottom: 1rem;">🎙️ Episodes Loading Issue</h3>
            <p>We're having trouble fetching the latest episodes from the RSS feed.</p>
            <p>This might be due to CORS restrictions in your browser.</p>
            <p style="margin-top: 1rem; font-size: 0.9rem;">
              <strong>For now:</strong> The site will work perfectly when deployed to GitHub Pages.<br>
              Check the browser console (F12) for more technical details.
            </p>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--secondary-color); color: var(--bg-color); border: none; border-radius: 4px; cursor: pointer;">
              🔄 Try Again
            </button>
          </div>
        `;
        container.classList.remove('loading');
      }
    });
  }

  getMockEpisodes() {
    // Fallback mock data for development (expanded to test pagination)
    
    const baseEpisodes = [
      {
        title: "Tragedy in London: Missing Woman's Case Takes a Grim Turn",
        description: "This episode covers the tragic discovery in the search for Yajaira Castro Mendez, a fire incident in BC, Australia's speedy housing solution, a salmonella outbreak linked to eggs, and a study on bedroom design impacting workers' well-being.",
        pubDate: "Sun, 08 Jun 2025 01:27:13 GMT",
        formattedDate: "June 8, 2025",
        link: "https://bojacksanchez.com",
        duration: "00:01:41",
        guid: "mock-episode-1",
        audioUrl: "https://op3.dev/e/f003.backblazeb2.com/file/bojack-sanchez-podcasts/news-in-a-nutshell/2025-06-08T01-25-50/podcast.mp3"
      },
      {
        title: "Pakistan's Water Woes and Other Absurdities",
        description: "Explore Pakistan's desperate plea for water from India, British Columbia's gas pipeline approval amidst fires, and the creation of liquid carbon in tech. Plus, dive into River Island's job-cutting rescue plan and the discovery of the tiniest dinosaur.",
        pubDate: "Sat, 07 Jun 2025 12:33:33 GMT",
        formattedDate: "June 7, 2025",
        link: "https://bojacksanchez.com",
        duration: "00:01:53",
        guid: "mock-episode-2",
        audioUrl: "https://op3.dev/e/f003.backblazeb2.com/file/bojack-sanchez-podcasts/news-in-a-nutshell/2025-06-07T12-32-25/podcast.mp3"
      },
      {
        title: "Ex-Police Chief's Failed Prison Escape and Other News",
        description: "A rundown of today's biggest stories, from a failed prison escape by an ex-police chief to the latest Apple gadget reveal, along with Wall Street's rise and a stunning solar photo.",
        pubDate: "Sat, 07 Jun 2025 01:18:40 GMT",
        formattedDate: "June 7, 2025",
        link: "https://bojacksanchez.com",
        duration: "00:01:57",
        guid: "mock-episode-3"
      },
      {
        title: "U.S. Army's Massive Military Parade and Other Wild News",
        description: "From the U.S. Army's colossal military parade to Australia's nitrous oxide crisis and humpback whales having a bubbly good time—get the scoop on the craziest news highlights of the week!",
        pubDate: "Fri, 06 Jun 2025 12:36:36 GMT",
        formattedDate: "June 6, 2025",
        link: "https://bojacksanchez.com",
        duration: "00:02:14",
        guid: "mock-episode-4"
      },
      {
        title: "Volleyball, Smoke, and AI: A Wild News Roundup",
        description: "In this episode, we dive into the bizarre detention of a Massachusetts teen by ICE, the smoky air in Chicago, the rise of AI, a casino's money laundering scandal, and Tom Cruise's latest record-breaking stunt.",
        pubDate: "Fri, 06 Jun 2025 01:19:44 GMT",
        formattedDate: "June 6, 2025",
        link: "https://bojacksanchez.com",
        duration: "00:02:37",
        guid: "mock-episode-5"
      }
    ];

    // Generate 20 episodes for testing
    const episodes = [];
    for (let i = 0; i < 20; i++) {
      const baseEpisode = baseEpisodes[i % baseEpisodes.length];
      
      // Generate dates going back in time (1-2 days apart)
      const daysAgo = i * (1 + Math.random()); // 1-2 days apart
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(daysAgo));
      const pubDate = date.toUTCString();
      
      episodes.push({
        ...baseEpisode,
        title: `${baseEpisode.title} (Episode ${i + 1})`,
        pubDate: pubDate,
        formattedDate: this.formatDate(pubDate),
        guid: `mock-episode-${i + 1}`,
        slug: `episode-${i + 1}-${baseEpisode.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 30)}`,
        episodeNumber: i + 1,
        // Ensure audio URL is included
        audioUrl: baseEpisode.audioUrl
      });
    }
    
    return episodes;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PodcastRSSParser();
}); 