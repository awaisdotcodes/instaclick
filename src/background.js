/**
 * InstaClick v2.4.0 - Background Service Worker
 * Handles settings management, badge updates, and cross-tab communication
 */

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  openInNewTab: true,
  showPreview: true,
  highlightLinks: true,
  linkStyle: 'default', // 'default', 'subtle', 'bold'
  trackHistory: true,
  expandShortUrls: true,
  maxHistoryItems: 100
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    console.log('InstaClick installed with default settings');
  } else if (details.reason === 'update') {
    // Merge new default settings with existing ones
    const { settings = {} } = await chrome.storage.sync.get('settings');
    const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
    await chrome.storage.sync.set({ settings: mergedSettings });
    console.log('InstaClick updated to version', chrome.runtime.getManifest().version);
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'GET_SETTINGS':
      return getSettings();
    
    case 'UPDATE_SETTINGS':
      return updateSettings(message.settings);
    
    case 'TRACK_CLICK':
      return trackLinkClick(message.url);
    
    case 'GET_HISTORY':
      return getClickHistory();
    
    case 'CLEAR_HISTORY':
      return clearClickHistory();
    
    case 'GET_STATS':
      return getStats();
    
    case 'UPDATE_BADGE':
      return updateBadge(sender.tab?.id, message.count);
    
    case 'FETCH_LINK_PREVIEW':
      return fetchLinkPreview(message.url);
    
    case 'EXPAND_URL':
      return expandShortUrl(message.url);
    
    default:
      console.warn('Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

async function getSettings() {
  try {
    const { settings = DEFAULT_SETTINGS } = await chrome.storage.sync.get('settings');
    return { success: true, settings: { ...DEFAULT_SETTINGS, ...settings } };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { success: false, error: error.message };
  }
}

async function updateSettings(newSettings) {
  try {
    const { settings = DEFAULT_SETTINGS } = await chrome.storage.sync.get('settings');
    const updatedSettings = { ...settings, ...newSettings };
    await chrome.storage.sync.set({ settings: updatedSettings });
    
    // Notify all Instagram tabs about settings change
    const tabs = await chrome.tabs.query({ url: ['*://www.instagram.com/*', '*://instagram.com/*'] });
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          type: 'SETTINGS_UPDATED', 
          settings: updatedSettings 
        });
      } catch (e) {
        // Tab might not have content script loaded
      }
    }
    
    return { success: true, settings: updatedSettings };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
}

async function trackLinkClick(url) {
  try {
    if (!url) {
      console.log('No URL provided for tracking');
      return { success: false, error: 'No URL provided' };
    }

    // Check if history tracking is enabled
    const { settings = DEFAULT_SETTINGS } = await chrome.storage.sync.get('settings');
    if (!settings.trackHistory) {
      return { success: true, tracked: false };
    }

    console.log('Tracking click for:', url);
    
    const { clickHistory = [] } = await chrome.storage.local.get('clickHistory');
    
    const entry = {
      url,
      hostname: new URL(url).hostname.replace(/^www\./, ''),
      timestamp: Date.now(),
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
    
    clickHistory.unshift(entry);
    
    // Keep only the latest 100 items
    const trimmedHistory = clickHistory.slice(0, 100);
    await chrome.storage.local.set({ clickHistory: trimmedHistory });
    
    // Update stats
    const { stats = { totalClicks: 0, domains: {} } } = await chrome.storage.local.get('stats');
    stats.totalClicks++;
    stats.domains[entry.hostname] = (stats.domains[entry.hostname] || 0) + 1;
    await chrome.storage.local.set({ stats });
    
    console.log('Click tracked! Total clicks:', stats.totalClicks);
    return { success: true, tracked: true };
  } catch (error) {
    console.error('Error tracking click:', error);
    return { success: false, error: error.message };
  }
}

async function getClickHistory() {
  try {
    const { clickHistory = [] } = await chrome.storage.local.get('clickHistory');
    return { success: true, history: clickHistory };
  } catch (error) {
    console.error('Error getting history:', error);
    return { success: false, error: error.message };
  }
}

async function clearClickHistory() {
  try {
    await chrome.storage.local.set({ clickHistory: [], stats: { totalClicks: 0, domains: {} } });
    return { success: true };
  } catch (error) {
    console.error('Error clearing history:', error);
    return { success: false, error: error.message };
  }
}

async function getStats() {
  try {
    const { stats = { totalClicks: 0, domains: {} } } = await chrome.storage.local.get('stats');
    return { success: true, stats };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { success: false, error: error.message };
  }
}

async function updateBadge(tabId, count) {
  try {
    if (!tabId) return { success: false, error: 'No tab ID' };
    
    const text = count > 0 ? String(count) : '';
    await chrome.action.setBadgeText({ text, tabId });
    await chrome.action.setBadgeBackgroundColor({ color: '#0095f6', tabId });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating badge:', error);
    return { success: false, error: error.message };
  }
}

async function fetchLinkPreview(url) {
  // Don't make direct fetch requests - they cause CORS errors in console
  // Instead, just return basic info and let the content script use screenshot services
  
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;
    
    // Return basic info - the preview.js will add screenshot thumbnails
    return { 
      success: true, 
      data: {
        title: domain,
        description: parsedUrl.pathname !== '/' ? parsedUrl.pathname : url,
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        is404: false,
        useScreenshot: true // Flag to tell preview.js to use screenshot service
      }
    };
    
  } catch (error) {
    console.error('Error parsing URL:', error);
    return { 
      success: false, 
      error: error.message,
      data: {
        is404: false,
        title: 'Invalid URL',
        description: url
      }
    };
  }
}

// Known URL shortener domains
const SHORT_URL_DOMAINS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'adf.ly', 'j.mp', 'dlvr.it', 'tiny.cc', 'lnkd.in', 'db.tt', 'qr.ae',
  'cur.lv', 'youtu.be', 'soo.gd', 'su.pr', 'bl.ink', 'short.io', 'rebrand.ly'
];

function isShortUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SHORT_URL_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

async function expandShortUrl(url) {
  try {
    // First try unshorten.me API
    try {
      const response = await fetch(`https://unshorten.me/json/${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (data.resolved_url && data.resolved_url !== url) {
        return { success: true, expandedUrl: data.resolved_url };
      }
    } catch (e) {
      console.log('unshorten.me failed, trying direct follow');
    }
    
    // Fallback: Return original URL with note
    return { 
      success: false, 
      error: 'Could not expand URL',
      expandedUrl: url 
    };
    
  } catch (error) {
    console.error('Error expanding URL:', error);
    return { success: false, error: error.message };
  }
}
