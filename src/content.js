/**
 * InstaClick v2.0 - Content Script
 * Converts plain text URLs in Instagram to clickable links
 * 
 * Features:
 * - Secure URL sanitization (XSS prevention)
 * - Improved URL regex with fewer false positives
 * - Performance-optimized processing queue
 * - Dark mode detection
 * - Link preview on hover
 * - Keyboard navigation support
 * - Click tracking (optional)
 */

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION & CONSTANTS
  // ============================================
  
  // URL regex - matches prefixed URLs and bare domains with known TLDs
  const URL_REGEX = /(?:https?:\/\/(?:www\.)?|www\.)[a-zA-Z0-9][-a-zA-Z0-9@:%._+~#=]{0,255}\.[a-z]{2,63}\b(?:[-a-zA-Z0-9@:%_+.~#?&/=()]*)|(?<![a-zA-Z0-9@.])(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+(?:com|org|net|edu|gov|co|io|ai|app|dev|me|info|biz|xyz|online|site|tech|store|blog|shop|club|live|news|social|link|page|web|cloud|space|world|pro|gg|tv|be)\b(?:[/?#][-a-zA-Z0-9@:%_+.~#?&/=()]*)?/gi;
  
  // Common file extensions to exclude (not URLs)
  const FILE_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|eot|map)$/i;
  
  // Valid TLDs (top 50 most common to reduce false positives)
  const VALID_TLDS = new Set([
    'com', 'org', 'net', 'edu', 'gov', 'co', 'io', 'ai', 'app', 'dev',
    'me', 'info', 'biz', 'us', 'uk', 'ca', 'au', 'de', 'fr', 'it',
    'es', 'nl', 'ru', 'jp', 'cn', 'in', 'br', 'mx', 'kr', 'tv',
    'xyz', 'online', 'site', 'tech', 'store', 'blog', 'shop', 'club', 'live', 'news',
    'social', 'link', 'page', 'web', 'cloud', 'space', 'world', 'pro', 'gg', 'be'
  ]);

  // Instagram-specific selectors for content areas
  const CONTENT_SELECTORS = [
    'article',
    'section',
    'div[role="main"]',
    'div[role="dialog"]',
    'div[role="presentation"]',
    // Instagram's common class patterns
    'span[dir="auto"]',
    'h1', 'h2', 'h3',
    // Bio sections
    'header section',
    // Comments
    'ul[class*="x78zum5"]',
    // Caption areas
    'div[class*="x9f619"] span'
  ];

  // Modal/popup specific selectors
  const MODAL_SELECTORS = [
    'div[role="dialog"]',
    'div[role="presentation"]',
    'div[style*="transform: translateX"]'
  ];

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  let settings = {
    enabled: true,
    openInNewTab: true,
    showPreview: true,
    highlightLinks: true,
    linkStyle: 'default',
    trackHistory: false
  };
  
  let linkCount = 0;
  let isInitialized = false;

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Sanitize and validate URL to prevent XSS attacks
   */
  function sanitizeUrl(urlString) {
    try {
      // Add protocol if missing
      let url = urlString;
      if (!url.match(/^https?:\/\//i)) {
        url = 'https://' + url;
      }
      
      const parsed = new URL(url);
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
      }
      
      // Validate TLD
      const hostname = parsed.hostname.toLowerCase();
      const tld = hostname.split('.').pop();
      if (!VALID_TLDS.has(tld)) {
        // Allow if it has a valid structure (country TLDs like .co.uk)
        const parts = hostname.split('.');
        if (parts.length < 2) return null;
      }
      
      return parsed.href;
    } catch {
      return null;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if text looks like a truncated URL (ends with ...)
   */
  function isTruncatedUrl(text) {
    return /\.{2,}$/.test(text.trim()) || /…$/.test(text.trim());
  }

  /**
   * Check if text matches file extension pattern (not a URL)
   */
  function isFileExtension(text) {
    return FILE_EXTENSIONS.test(text);
  }

  /**
   * Detect if Instagram is in dark mode
   */
  function isDarkMode() {
    const html = document.documentElement;
    const body = document.body;
    
    // Check Instagram's dark mode classes
    if (html.classList.contains('__fb-dark-mode') || 
        body.classList.contains('__fb-dark-mode')) {
      return true;
    }
    
    // Check computed background color
    const bgColor = getComputedStyle(body).backgroundColor;
    const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match.map(Number);
      // Dark if average RGB is low
      return (r + g + b) / 3 < 50;
    }
    
    // Check prefers-color-scheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Debounce function for performance
   */
  function debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ============================================
  // LINK PROCESSING
  // ============================================

  /**
   * Processing queue for better performance
   */
  class LinkProcessor {
    constructor() {
      this.queue = new Set();
      this.isProcessing = false;
      this.processDebounced = debounce(this.processQueue.bind(this), 100);
    }

    add(element) {
      if (!element || element.hasAttribute('data-instaclick-processed')) return;
      this.queue.add(element);
      this.processDebounced();
    }

    processQueue() {
      if (this.isProcessing || this.queue.size === 0) return;
      this.isProcessing = true;

      requestAnimationFrame(() => {
        const elements = Array.from(this.queue);
        this.queue.clear();
        
        let newLinks = 0;
        for (const element of elements) {
          newLinks += processElement(element);
        }
        
        if (newLinks > 0) {
          linkCount += newLinks;
          updateBadge();
        }
        
        this.isProcessing = false;
        
        // Process any elements added during processing
        if (this.queue.size > 0) {
          this.processDebounced();
        }
      });
    }
  }

  const processor = new LinkProcessor();

  /**
   * Convert URLs in text to clickable links
   */
  function linkifyText(text) {
    // Reset regex state
    URL_REGEX.lastIndex = 0;
    
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = URL_REGEX.exec(text)) !== null) {
      const matchedUrl = match[0];
      
      // Skip if it looks like a file extension or truncated URL
      if (isFileExtension(matchedUrl) || isTruncatedUrl(matchedUrl)) {
        continue;
      }
      
      // Sanitize the URL
      const sanitizedUrl = sanitizeUrl(matchedUrl);
      if (!sanitizedUrl) continue;
      
      // Add text before the match
      result += escapeHtml(text.slice(lastIndex, match.index));
      
      // Create the link
      const target = settings.openInNewTab ? ' target="_blank"' : '';
      const styleClass = `instaclick-link instaclick-style-${settings.linkStyle}`;
      
      const faviconHtml = `<img class="instaclick-favicon" src="${chrome.runtime.getURL('icons/icon16.png')}" alt="" aria-hidden="true">`;
      result += `<a href="${sanitizedUrl}"${target} rel="noopener noreferrer" class="${styleClass}" data-instaclick-url="${sanitizedUrl}">${faviconHtml}${escapeHtml(matchedUrl)}</a>`;
      
      lastIndex = match.index + matchedUrl.length;
    }
    
    // Add remaining text
    result += escapeHtml(text.slice(lastIndex));
    
    return result;
  }

  /**
   * Process a text node and convert URLs to links
   */
  function processTextNode(node) {
    if (!node || !node.parentNode) return 0;
    
    const text = node.textContent;
    if (!text || !URL_REGEX.test(text)) return 0;
    
    // Reset regex after test
    URL_REGEX.lastIndex = 0;
    
    const linkedHtml = linkifyText(text);
    
    // Check if any links were actually created
    if (!linkedHtml.includes('instaclick-link')) return 0;
    
    // Create a temporary container
    const temp = document.createElement('span');
    temp.innerHTML = linkedHtml;
    
    // Get the links before moving them
    const newLinks = temp.querySelectorAll('.instaclick-link');

    // Hide favicon if it fails to load
    temp.querySelectorAll('.instaclick-favicon').forEach(img => {
      img.addEventListener('error', () => { img.style.display = 'none'; });
    });

    // Replace the text node with the new content
    const fragment = document.createDocumentFragment();
    while (temp.firstChild) {
      fragment.appendChild(temp.firstChild);
    }
    
    node.parentNode.replaceChild(fragment, node);
    
    // Immediately preload all new links (don't wait for visibility)
    const manager = getPreviewManager();
    if (manager && settings.showPreview) {
      newLinks.forEach(link => {
        const url = link.getAttribute('data-instaclick-url');
        if (url) {
          manager.preloadLink(url);
        }
      });
    }
    
    // Also observe for visibility (backup)
    if (window.instaclickPreloadObserver) {
      newLinks.forEach(link => {
        window.instaclickPreloadObserver.observe(link);
      });
    }
    
    // Count links created
    return newLinks.length;
  }

  /**
   * Process an element and its text nodes
   */
  function processElement(element) {
    if (!element || !settings.enabled) return 0;
    
    // Skip if already processed or is a link
    if (element.hasAttribute('data-instaclick-processed')) return 0;
    if (element.tagName === 'A' || element.closest('a')) return 0;
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return 0;
    
    // Mark as processed
    element.setAttribute('data-instaclick-processed', 'true');
    
    // Get all text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // Skip if parent is a link or script
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.tagName === 'A' || parent.closest('a')) return NodeFilter.FILTER_REJECT;
          if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
          if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    let current;
    while (current = walker.nextNode()) {
      textNodes.push(current);
    }

    // Process text nodes
    let linksCreated = 0;
    for (const node of textNodes) {
      linksCreated += processTextNode(node);
    }
    
    return linksCreated;
  }

  /**
   * Process a container and all its text-containing elements
   */
  function processContainer(container) {
    if (!container || !settings.enabled) return;
    
    // Process direct text content
    processor.add(container);
    
    // Find and process text elements
    const textElements = container.querySelectorAll('span, div, p, h1, h2, h3, h4, h5, h6, li');
    textElements.forEach(el => processor.add(el));
  }

  // ============================================
  // LINK PREVIEW (using LinkPreviewManager)
  // ============================================

  let previewManager = null;

  function getPreviewManager() {
    if (!previewManager && window.LinkPreviewManager) {
      previewManager = new window.LinkPreviewManager();
    }
    return previewManager;
  }

  let hoverDelayTimeout = null;

  // ============================================
  // EVENT HANDLERS
  // ============================================

  function handleLinkClick(event) {
    const link = event.target.closest('.instaclick-link');
    if (!link) return;
    
    const url = link.getAttribute('data-instaclick-url');
    if (!url) return;
    
    // Always send tracking message - background script decides whether to record
    if (chrome.runtime?.id) {
      try {
        chrome.runtime.sendMessage({ type: 'TRACK_CLICK', url }).catch(() => {});
      } catch (e) {
        // Extension context invalidated, ignore
      }
    }
  }

  function handleContextMenu(event) {
    const link = event.target.closest('.instaclick-link');
    if (!link) return;
    
    const url = link.getAttribute('data-instaclick-url');
    if (!url) return;
    
    // Track right-click/context menu as well
    if (chrome.runtime?.id) {
      try {
        chrome.runtime.sendMessage({ type: 'TRACK_CLICK', url }).catch(() => {});
      } catch (e) {
        // Extension context invalidated, ignore
      }
    }
  }

  function handleAuxClick(event) {
    const link = event.target.closest('.instaclick-link');
    if (!link) return;
    
    // Track middle-click as well
    if (event.button === 1) {
      const url = link.getAttribute('data-instaclick-url');
      if (!url) return;
      
      if (chrome.runtime?.id) {
        try {
          chrome.runtime.sendMessage({ type: 'TRACK_CLICK', url }).catch(() => {});
        } catch (e) {
          // Extension context invalidated, ignore
        }
      }
    }
  }

  function handleLinkHover(event) {
    const link = event.target.closest('.instaclick-link');
    const manager = getPreviewManager();
    
    if (!manager || !settings.showPreview) return;
    
    clearTimeout(hoverDelayTimeout);
    
    if (event.type === 'mouseover') {
      if (link) {
        const url = link.getAttribute('data-instaclick-url');
        if (url) {
          // Small delay before showing (100ms)
          hoverDelayTimeout = setTimeout(() => {
            manager.show(link, url);
          }, 100);
        }
      }
    } else if (event.type === 'mouseout') {
      // Only handle mouseout from links, not from card
      if (!link) return;
      
      // Check if we're moving to the preview card or QR popup
      const relatedTarget = event.relatedTarget;
      const toPreviewCard = relatedTarget && (
        relatedTarget.closest('.instaclick-preview-card') || 
        relatedTarget.classList?.contains('instaclick-preview-card')
      );
      const toQRPopup = relatedTarget && relatedTarget.closest('.instaclick-qr-popup');
      
      if (toPreviewCard || toQRPopup) {
        // Moving to preview card or QR popup - don't hide
        return;
      }
      
      // Small delay when leaving link to allow moving to card
      hoverDelayTimeout = setTimeout(() => {
        manager.hide();
      }, 150);
    }
  }

  function handleKeydown(event) {
    // Allow Enter to activate focused link
    if (event.key === 'Enter' && event.target.classList.contains('instaclick-link')) {
      event.preventDefault();
      const url = event.target.getAttribute('data-instaclick-url');
      if (url) {
        if (settings.openInNewTab) {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = url;
        }
      }
    }
  }

  // ============================================
  // MUTATION OBSERVER
  // ============================================

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Handle added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          
          // Check if it's a modal or content container
          const isModal = MODAL_SELECTORS.some(sel => 
            node.matches?.(sel) || node.querySelector?.(sel)
          );
          
          if (isModal) {
            // Process modals with slight delay for content to load
            setTimeout(() => processContainer(node), 150);
          } else {
            // Regular content
            processContainer(node);
          }
        }
        
        // Handle attribute changes (for dynamic content updates)
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'style' &&
            mutation.target.getAttribute('role') === 'dialog') {
          processContainer(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return observer;
  }

  // ============================================
  // URL CHANGE DETECTION (SPA Navigation)
  // ============================================

  function setupUrlChangeDetection() {
    let lastUrl = location.href;

    const onUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        // Reset link count for new page
        linkCount = 0;
        updateBadge();
        // Process new page content
        findAndProcessLinks();
      }
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', onUrlChange);

    // Patch pushState and replaceState to detect SPA navigation
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      onUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      onUrlChange();
    };
  }

  // ============================================
  // BADGE UPDATE
  // ============================================

  function updateBadge() {
    try {
      chrome.runtime.sendMessage({ 
        type: 'UPDATE_BADGE', 
        count: linkCount 
      });
    } catch (e) {
      // Extension context might be invalidated
    }
  }

  // ============================================
  // MAIN PROCESSING
  // ============================================

  function findAndProcessLinks() {
    if (!settings.enabled) return;
    
    // Process main content areas
    CONTENT_SELECTORS.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => processContainer(el));
      } catch (e) {
        // Invalid selector, skip
      }
    });
    
    // Process modals/popups
    MODAL_SELECTORS.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => processContainer(el));
      } catch (e) {
        // Invalid selector, skip
      }
    });
  }

  // ============================================
  // SETTINGS SYNC
  // ============================================

  async function loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        settings = { ...settings, ...response.settings };
        updateLinkStyles();
      }
    } catch (e) {
      console.warn('InstaClick: Could not load settings, using defaults');
    }
  }

  function updateLinkStyles() {
    // Update existing links with new style class
    document.querySelectorAll('.instaclick-link').forEach(link => {
      link.className = `instaclick-link instaclick-style-${settings.linkStyle}`;
    });
  }

  // Listen for settings updates from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
      settings = { ...settings, ...message.settings };
      updateLinkStyles();
      
      // Re-process if enabled
      if (settings.enabled) {
        findAndProcessLinks();
      }
    }
    sendResponse({ success: true });
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  async function initialize() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('InstaClick v2.4.7 initializing...');
    
    // Load settings
    await loadSettings();
    
    // Set up event listeners
    document.addEventListener('click', handleLinkClick, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('auxclick', handleAuxClick, true);
    document.addEventListener('mouseover', handleLinkHover, true);
    document.addEventListener('mouseout', handleLinkHover, true);
    document.addEventListener('keydown', handleKeydown, true);
    
    // Initial processing
    findAndProcessLinks();
    
    // Set up observers
    setupMutationObserver();
    setupUrlChangeDetection();
    
    // Set up Intersection Observer for preloading
    setupPreloadObserver();
    
    // Scroll handler for lazy-loaded content
    const handleScroll = debounce(findAndProcessLinks, 250);
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Periodic check for missed content (failsafe, also handles recycled reel elements)
    setInterval(() => {
      if (!settings.enabled || document.hidden) return;

      const containers = document.querySelectorAll(
        'div[role="dialog"], div[role="presentation"]'
      );
      if (containers.length === 0) return;

      containers.forEach(container => {
        const spans = container.querySelectorAll('span');
        spans.forEach(el => {
          // Skip if already has a working link inside
          if (el.querySelector('.instaclick-link')) return;
          if (el.closest('.instaclick-link')) return;

          URL_REGEX.lastIndex = 0;
          if (URL_REGEX.test(el.textContent)) {
            // Clear processed flag (handles recycled DOM in reels)
            el.removeAttribute('data-instaclick-processed');
            processor.add(el);
          }
        });
      });
    }, 3000);
    
    console.log('InstaClick v2.4.7 initialized');
  }

  // ============================================
  // PRELOAD OBSERVER - Load previews when links become visible
  // ============================================

  function setupPreloadObserver() {
    const manager = getPreviewManager();
    if (!manager) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target;
          const url = link.getAttribute('data-instaclick-url');
          if (url && settings.showPreview) {
            manager.preloadLink(url);
          }
          // Unobserve after triggering preload
          observer.unobserve(link);
        }
      });
    }, {
      rootMargin: '200px', // Start loading when 200px away from viewport
      threshold: 0
    });

    // Observe all existing links
    document.querySelectorAll('.instaclick-link').forEach(link => {
      observer.observe(link);
    });

    // Store observer for use when new links are created
    window.instaclickPreloadObserver = observer;
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
