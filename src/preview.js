/**
 * InstaClick v2.4.2 - Link Preview Module
 * WhatsApp-style rich link previews with QR popup and URL expander
 */

class LinkPreviewManager {
  constructor() {
    this.cache = new Map();
    this.cacheDuration = 30 * 60 * 1000; // 30 minutes
    this.previewElement = null;
    this.qrPopup = null;
    this.currentUrl = null;
    this.currentLink = null;
    this.hoverTimeout = null;
    this.hideTimeout = null;
    this.fetchController = null;
    this.preloadQueue = new Set();
    this.isPreloading = false;
  }

  // ============================================
  // PRELOADING
  // ============================================

  preloadLink(url) {
    if (!url || this.cache.has(url) || this.preloadQueue.has(url)) return;
    
    try {
      const domain = new URL(url).hostname;
      if (domain.includes('instagram.com')) return;
    } catch (e) {
      return;
    }
    
    this.preloadQueue.add(url);
    
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  async processPreloadQueue() {
    if (this.isPreloading || this.preloadQueue.size === 0) return;
    
    if (!chrome.runtime?.id) {
      this.preloadQueue.clear();
      return;
    }
    
    this.isPreloading = true;
    
    const urls = Array.from(this.preloadQueue).slice(0, 5);
    
    for (const url of urls) {
      this.preloadQueue.delete(url);
      
      if (!this.cache.has(url)) {
        try {
          const data = await this.fetchPreviewData(url);
          this.setCache(url, data);
          
          if (data && data.is404) {
            this.markDeadLink(url);
          }
        } catch (e) {
          console.warn('Preload failed for:', url);
        }
      }
      
      await new Promise(r => setTimeout(r, 150));
    }
    
    this.isPreloading = false;
    
    if (this.preloadQueue.size > 0 && chrome.runtime?.id) {
      setTimeout(() => this.processPreloadQueue(), 300);
    }
  }

  // ============================================
  // CACHE
  // ============================================

  setCache(url, data) {
    this.cache.set(url, {
      data,
      timestamp: Date.now()
    });
  }

  getFromCache(url) {
    const cached = this.cache.get(url);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheDuration) {
      this.cache.delete(url);
      return null;
    }
    
    return cached.data;
  }

  markDeadLink(url) {
    document.querySelectorAll(`.instaclick-link[data-instaclick-url="${CSS.escape(url)}"]`).forEach(link => {
      link.classList.add('instaclick-dead-link');
    });
  }

  // ============================================
  // PREVIEW ELEMENT
  // ============================================

  createPreviewElement() {
    if (this.previewElement) return this.previewElement;

    this.previewElement = document.createElement('div');
    this.previewElement.className = 'instaclick-preview-card';
    this.previewElement.innerHTML = `
      <a class="preview-link-area" href="#" target="_blank" rel="noopener noreferrer">
        <div class="preview-loading">
          <div class="preview-skeleton-image"></div>
          <div class="preview-skeleton-content">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-domain"></div>
          </div>
        </div>
        <div class="preview-content" style="display: none;">
          <div class="preview-image-container">
            <img class="preview-image" src="" alt="">
            <div class="preview-play-button">▶</div>
            <div class="preview-site-badge"></div>
          </div>
          <div class="preview-info">
            <div class="preview-title"></div>
            <div class="preview-domain-row">
              <img class="preview-favicon" src="" alt="">
              <span class="preview-domain"></span>
            </div>
            <div class="preview-expanded-url" style="display: none;">
              <span class="expanded-label">🔓 Actual destination:</span>
              <span class="expanded-url-text"></span>
            </div>
          </div>
        </div>
        <div class="preview-error" style="display: none;">
          <div class="preview-error-content">
            <div class="preview-error-icon">🚫</div>
            <div class="preview-error-title">Page Not Found</div>
            <div class="preview-error-desc">This link may be broken or the page no longer exists</div>
            <div class="preview-error-url"></div>
          </div>
        </div>
      </a>
      <div class="preview-actions-row">
        <button class="preview-action-btn preview-expand-btn" title="Expand Short URL">🔓 Expand URL</button>
        <button class="preview-action-btn preview-qr-btn" title="Generate QR Code">📱 QR Code</button>
      </div>
      <div class="preview-branding">
        <span class="preview-branding-icon">🔗</span>
        <span class="preview-branding-text">Powered by <strong>InstaClick</strong></span>
      </div>
    `;

    // Get the link area
    this.linkArea = this.previewElement.querySelector('.preview-link-area');

    // Track clicks on the link area
    this.linkArea.addEventListener('click', (e) => {
      this.trackClick();
      // Let the default link behavior happen (opens in new tab)
      setTimeout(() => this.hide(), 100);
    });

    // Middle click - also track
    this.linkArea.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        this.trackClick();
        setTimeout(() => this.hide(), 100);
      }
    });

    // QR button click
    this.previewElement.querySelector('.preview-qr-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleQRPopup();
    });

    // Expand URL button click
    this.previewElement.querySelector('.preview-expand-btn').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.expandCurrentUrl();
    });

    // Mouse leave - hide immediately
    this.previewElement.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget;
      // Only keep open if moving to QR popup
      if (relatedTarget && relatedTarget.closest && relatedTarget.closest('.instaclick-qr-popup')) {
        return;
      }
      
      this.hide();
    });

    // Mouse enter - cancel any pending hide
    this.previewElement.addEventListener('mouseenter', () => {
      clearTimeout(this.hideTimeout);
    });

    document.body.appendChild(this.previewElement);
    return this.previewElement;
  }

  // ============================================
  // QR POPUP (Separate from card)
  // ============================================

  createQRPopup() {
    if (this.qrPopup) return this.qrPopup;

    this.qrPopup = document.createElement('div');
    this.qrPopup.className = 'instaclick-qr-popup';
    this.qrPopup.innerHTML = `<img class="qr-popup-image" src="" alt="QR Code">`;

    this.qrPopup.addEventListener('click', (e) => e.stopPropagation());

    this.qrPopup.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget;
      // Only keep open if moving back to preview card
      if (relatedTarget && relatedTarget.closest && relatedTarget.closest('.instaclick-preview-card')) {
        return;
      }
      this.hide();
    });

    document.body.appendChild(this.qrPopup);
    return this.qrPopup;
  }

  toggleQRPopup() {
    const qrPopup = this.createQRPopup();
    const qrImage = qrPopup.querySelector('.qr-popup-image');
    const qrBtn = this.previewElement.querySelector('.preview-qr-btn');
    
    if (qrPopup.classList.contains('visible')) {
      qrPopup.classList.remove('visible');
      qrBtn.textContent = '📱 QR Code';
      return;
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(this.currentUrl)}`;
    qrImage.src = qrUrl;
    
    this.positionQRPopup();
    
    qrPopup.classList.add('visible');
    qrBtn.textContent = '✕ Close QR';
  }

  positionQRPopup() {
    const qrPopup = this.qrPopup;
    const cardRect = this.previewElement.getBoundingClientRect();
    const qrSize = 160;
    const gap = 10;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let left, top;
    
    // Try right side first
    if (cardRect.right + gap + qrSize < viewportWidth) {
      left = cardRect.right + gap;
      top = cardRect.top + (cardRect.height / 2) - (qrSize / 2);
    }
    // Try left side
    else if (cardRect.left - gap - qrSize > 0) {
      left = cardRect.left - gap - qrSize;
      top = cardRect.top + (cardRect.height / 2) - (qrSize / 2);
    }
    // Fall back to bottom
    else {
      left = cardRect.left + (cardRect.width / 2) - (qrSize / 2);
      top = cardRect.bottom + gap;
    }
    
    // Keep within viewport
    if (top + qrSize > viewportHeight - 10) {
      top = viewportHeight - qrSize - 10;
    }
    if (top < 10) top = 10;
    if (left < 10) left = 10;
    if (left + qrSize > viewportWidth - 10) {
      left = viewportWidth - qrSize - 10;
    }
    
    qrPopup.style.left = `${left}px`;
    qrPopup.style.top = `${top}px`;
  }

  hideQRPopup() {
    if (this.qrPopup) {
      this.qrPopup.classList.remove('visible');
    }
    const qrBtn = this.previewElement?.querySelector('.preview-qr-btn');
    if (qrBtn) {
      qrBtn.textContent = '📱 QR Code';
    }
  }

  // ============================================
  // URL EXPANDER
  // ============================================

  async expandCurrentUrl() {
    const expandBtn = this.previewElement.querySelector('.preview-expand-btn');
    const expandedDiv = this.previewElement.querySelector('.preview-expanded-url');
    const expandedText = this.previewElement.querySelector('.expanded-url-text');

    if (!this.currentUrl || !chrome.runtime?.id) return;

    expandBtn.textContent = '⏳ Expanding...';
    expandBtn.disabled = true;

    try {
      const result = await chrome.runtime.sendMessage({ type: 'EXPAND_URL', url: this.currentUrl });

      if (result.success && result.expandedUrl !== this.currentUrl) {
        expandedText.textContent = result.expandedUrl.length > 55
          ? result.expandedUrl.slice(0, 55) + '...'
          : result.expandedUrl;
        expandedText.title = result.expandedUrl;
        expandedDiv.style.display = 'block';
        expandBtn.textContent = '✓ Expanded';
      } else {
        expandedText.textContent = result.error || 'This is not a shortened URL';
        expandedDiv.style.display = 'block';
        expandBtn.textContent = '🔓 Expand URL';
      }
    } catch (e) {
      expandedText.textContent = 'Could not expand URL';
      expandedDiv.style.display = 'block';
      expandBtn.textContent = '🔓 Expand URL';
    }

    expandBtn.disabled = false;
  }

  trackClick() {
    if (this.currentUrl && chrome.runtime?.id) {
      try {
        chrome.runtime.sendMessage({ type: 'TRACK_CLICK', url: this.currentUrl }).catch(() => {});
      } catch (e) {}
    }
  }

  // ============================================
  // SHOW / HIDE
  // ============================================

  async show(linkElement, url) {
    if (!url) return;

    this.currentUrl = url;
    this.currentLink = linkElement;
    const preview = this.createPreviewElement();

    // Update the link href
    if (this.linkArea) {
      this.linkArea.href = url;
    }

    if (this.fetchController) {
      this.fetchController.abort();
    }

    this.positionPreview(linkElement);

    // Reset states
    this.hideQRPopup();
    const expandedDiv = preview.querySelector('.preview-expanded-url');
    if (expandedDiv) expandedDiv.style.display = 'none';
    const expandBtn = preview.querySelector('.preview-expand-btn');
    if (expandBtn) {
      expandBtn.textContent = '🔓 Expand URL';
      expandBtn.disabled = false;
    }

    const cached = this.getFromCache(url);
    if (cached) {
      this.renderPreview(cached);
      preview.classList.add('visible');
      return;
    }

    this.showLoading();
    preview.classList.add('visible');

    try {
      this.fetchController = new AbortController();
      const data = await this.fetchPreviewData(url);
      
      if (this.currentUrl !== url) return;
      
      this.setCache(url, data);
      this.renderPreview(data);
      
      if (data.is404) {
        this.markDeadLink(url);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        const domain = new URL(url).hostname.replace('www.', '');
        this.renderPreview({
          type: 'website',
          url: url,
          domain: domain,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
          title: domain,
          description: url,
          image: null,
          is404: false,
        });
      }
    }
  }

  hide() {
    clearTimeout(this.hideTimeout);
    clearTimeout(this.hoverTimeout);
    
    if (this.previewElement) {
      this.previewElement.classList.remove('visible');
    }
    
    this.hideQRPopup();
    this.currentUrl = null;
    this.currentLink = null;
  }

  positionPreview(linkElement) {
    const preview = this.previewElement;
    const rect = linkElement.getBoundingClientRect();
    const previewHeight = 350;
    const previewWidth = 320;
    const gap = 10;
    
    let top = rect.bottom + gap;
    let left = rect.left;
    
    if (top + previewHeight > window.innerHeight) {
      top = rect.top - previewHeight - gap;
    }
    
    if (top < 10) {
      top = 10;
    }
    
    if (left + previewWidth > window.innerWidth) {
      left = window.innerWidth - previewWidth - 10;
    }
    
    if (left < 10) {
      left = 10;
    }
    
    preview.style.top = `${top}px`;
    preview.style.left = `${left}px`;
  }

  showLoading() {
    const preview = this.previewElement;
    preview.querySelector('.preview-loading').style.display = 'flex';
    preview.querySelector('.preview-content').style.display = 'none';
    preview.querySelector('.preview-error').style.display = 'none';
  }

  // ============================================
  // RENDER PREVIEW
  // ============================================

  renderPreview(data) {
    const preview = this.previewElement;
    
    if (data.is404) {
      preview.querySelector('.preview-loading').style.display = 'none';
      preview.querySelector('.preview-content').style.display = 'none';
      preview.querySelector('.preview-error').style.display = 'flex';
      preview.querySelector('.preview-error-title').textContent = 'Page Not Found (404)';
      preview.querySelector('.preview-error-desc').textContent = 'This page no longer exists or has been moved';
      preview.querySelector('.preview-error-url').textContent = data.domain || '';
      return;
    }
    
    preview.querySelector('.preview-loading').style.display = 'none';
    preview.querySelector('.preview-error').style.display = 'none';
    preview.querySelector('.preview-content').style.display = 'flex';

    const imageContainer = preview.querySelector('.preview-image-container');
    const image = preview.querySelector('.preview-image');
    const playButton = preview.querySelector('.preview-play-button');
    
    if (data.image) {
      image.src = data.image;
      image.alt = data.title || '';
      imageContainer.style.display = 'block';
      playButton.style.display = (data.type === 'youtube' || data.type === 'video') ? 'flex' : 'none';
    } else {
      imageContainer.style.display = 'none';
    }

    const siteBadge = preview.querySelector('.preview-site-badge');
    if (data.siteBadge) {
      siteBadge.textContent = data.siteBadge;
      siteBadge.className = `preview-site-badge badge-${data.type || 'default'}`;
      siteBadge.style.display = 'block';
    } else {
      siteBadge.style.display = 'none';
    }

    preview.querySelector('.preview-title').textContent = data.title || data.domain || 'Unknown';

    const favicon = preview.querySelector('.preview-favicon');
    if (data.favicon) {
      favicon.src = data.favicon;
      favicon.style.display = 'block';
    } else {
      favicon.style.display = 'none';
    }
    
    preview.querySelector('.preview-domain').textContent = data.domain || '';
  }

  // ============================================
  // FETCH DATA
  // ============================================

  async fetchPreviewData(url) {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace('www.', '');
      
      const siteHandler = this.getSiteHandler(domain);
      if (siteHandler) {
        return await siteHandler(url, parsedUrl);
      }
      
      return await this.fetchGenericPreview(url, domain);
    } catch (error) {
      console.error('Error fetching preview:', error);
      throw error;
    }
  }

  getSiteHandler(domain) {
    const handlers = {
      'youtube.com': this.fetchYouTubePreview.bind(this),
      'youtu.be': this.fetchYouTubePreview.bind(this),
      'twitter.com': this.fetchTwitterPreview.bind(this),
      'x.com': this.fetchTwitterPreview.bind(this),
      'github.com': this.fetchGitHubPreview.bind(this),
      'reddit.com': this.fetchRedditPreview.bind(this),
      'spotify.com': this.fetchSpotifyPreview.bind(this),
      'tiktok.com': this.fetchTikTokPreview.bind(this),
      'linkedin.com': this.fetchLinkedInPreview.bind(this),
    };

    for (const [site, handler] of Object.entries(handlers)) {
      if (domain.includes(site)) return handler;
    }
    return null;
  }

  async fetchGenericPreview(url, domain) {
    if (domain.includes('instagram.com')) {
      return {
        type: 'instagram',
        url: url,
        domain: 'instagram.com',
        favicon: 'https://www.instagram.com/favicon.ico',
        siteBadge: 'Instagram',
        title: 'Instagram Content',
        description: 'View on Instagram',
        image: null,
        is404: false,
      };
    }

    try {
      const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
      const response = await fetch(apiUrl);
      const result = await response.json();
      
      if (result.status === 'fail') {
        const errorMsg = result.message || '';
        const is404 = errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('ENOTFOUND');
        
        if (is404) {
          return {
            type: 'website', url, domain,
            favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
            title: 'Page Not Found',
            description: 'This page no longer exists',
            image: null, is404: true,
          };
        }
        
        return {
          type: 'website', url, domain,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
          title: domain, description: url,
          image: `https://image.thum.io/get/width/400/crop/300/${encodeURIComponent(url)}`,
          is404: false,
        };
      }
      
      const data = result.data || {};
      return {
        type: 'website', url, domain,
        favicon: data.logo?.url || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        title: data.title || domain,
        description: data.description || '',
        image: data.image?.url || `https://image.thum.io/get/width/400/crop/300/${encodeURIComponent(url)}`,
        is404: false,
      };
      
    } catch (e) {
      return {
        type: 'website', url, domain,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        title: domain, description: url,
        image: `https://image.thum.io/get/width/400/crop/300/${encodeURIComponent(url)}`,
        is404: false,
      };
    }
  }

  // Site-specific handlers
  async fetchYouTubePreview(url, parsedUrl) {
    let videoId = parsedUrl.searchParams.get('v');
    if (!videoId && parsedUrl.hostname === 'youtu.be') {
      videoId = parsedUrl.pathname.slice(1);
    }
    
    return {
      type: 'youtube', url,
      domain: 'youtube.com',
      favicon: 'https://www.youtube.com/favicon.ico',
      siteBadge: 'YouTube',
      title: 'YouTube Video',
      description: 'Watch on YouTube',
      image: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      is404: false,
    };
  }

  async fetchTwitterPreview(url, parsedUrl) {
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let title = 'Twitter/X';
    
    if (pathParts.length >= 1) {
      title = `@${pathParts[0]} on X`;
    }
    if (pathParts.includes('status')) {
      title = 'Post on X';
    }

    return {
      type: 'twitter', url,
      domain: parsedUrl.hostname,
      favicon: 'https://abs.twimg.com/favicons/twitter.ico',
      siteBadge: 'X',
      title, description: 'View on X (Twitter)',
      image: null, is404: false,
    };
  }

  async fetchGitHubPreview(url, parsedUrl) {
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let title = 'GitHub';
    
    if (pathParts.length >= 2) {
      title = `${pathParts[0]}/${pathParts[1]}`;
    } else if (pathParts.length === 1) {
      title = pathParts[0];
    }

    return {
      type: 'github', url,
      domain: 'github.com',
      favicon: 'https://github.com/favicon.ico',
      siteBadge: 'GitHub',
      title, description: 'View on GitHub',
      image: pathParts.length >= 1 ? `https://opengraph.githubassets.com/1/${pathParts.join('/')}` : null,
      is404: false,
    };
  }

  async fetchRedditPreview(url, parsedUrl) {
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let title = 'Reddit';
    
    if (pathParts[0] === 'r' && pathParts[1]) {
      title = `r/${pathParts[1]}`;
    } else if (pathParts[0] === 'u' && pathParts[1]) {
      title = `u/${pathParts[1]}`;
    }

    return {
      type: 'reddit', url,
      domain: 'reddit.com',
      favicon: 'https://www.reddit.com/favicon.ico',
      siteBadge: 'Reddit',
      title, description: 'View on Reddit',
      image: null, is404: false,
    };
  }

  async fetchSpotifyPreview(url, parsedUrl) {
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let title = 'Spotify';
    
    if (pathParts[0] === 'track') title = 'Spotify Track';
    else if (pathParts[0] === 'album') title = 'Spotify Album';
    else if (pathParts[0] === 'playlist') title = 'Spotify Playlist';
    else if (pathParts[0] === 'artist') title = 'Spotify Artist';

    return {
      type: 'spotify', url,
      domain: 'spotify.com',
      favicon: 'https://open.spotify.com/favicon.ico',
      siteBadge: 'Spotify',
      title, description: 'Listen on Spotify',
      image: null, is404: false,
    };
  }

  async fetchTikTokPreview(url, parsedUrl) {
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let title = 'TikTok';
    
    if (pathParts[0] && pathParts[0].startsWith('@')) {
      title = `${pathParts[0]} on TikTok`;
    }

    return {
      type: 'tiktok', url,
      domain: 'tiktok.com',
      favicon: 'https://www.tiktok.com/favicon.ico',
      siteBadge: 'TikTok',
      title, description: 'Watch on TikTok',
      image: null, is404: false,
    };
  }

  async fetchLinkedInPreview(url, parsedUrl) {
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let title = 'LinkedIn';
    
    if (pathParts[0] === 'in' && pathParts[1]) {
      title = `${pathParts[1]} on LinkedIn`;
    } else if (pathParts[0] === 'company' && pathParts[1]) {
      title = `${pathParts[1]} on LinkedIn`;
    }

    return {
      type: 'linkedin', url,
      domain: 'linkedin.com',
      favicon: 'https://www.linkedin.com/favicon.ico',
      siteBadge: 'LinkedIn',
      title, description: 'View on LinkedIn',
      image: null, is404: false,
    };
  }
}

// Export for use in content script
window.LinkPreviewManager = LinkPreviewManager;
