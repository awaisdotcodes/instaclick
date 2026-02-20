/**
 * InstaClick v2.4.1 - Popup Script
 */

class PopupController {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    document.getElementById('header-logo').src = chrome.runtime.getURL('icons/icon128.png');
    document.getElementById('about-logo').src = chrome.runtime.getURL('icons/icon128.png');
    await this.loadSettings();
    this.setupTabs();
    this.setupSettings();
    this.setupHistory();
    await this.loadHistory();
  }

  async loadSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response.success) {
        this.settings = response.settings;
        this.applySettingsToUI();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  applySettingsToUI() {
    document.getElementById('enabled').checked = this.settings.enabled !== false;
    document.getElementById('openInNewTab').checked = this.settings.openInNewTab !== false;
    document.getElementById('showPreview').checked = this.settings.showPreview !== false;
    document.getElementById('trackHistory').checked = this.settings.trackHistory !== false;
  }

  setupSettings() {
    const settingIds = ['enabled', 'openInNewTab', 'showPreview', 'trackHistory'];
    
    settingIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          this.updateSetting(id, e.target.checked);
        });
      }
    });
  }

  async updateSetting(key, value) {
    try {
      const newSettings = { ...this.settings, [key]: value };
      const response = await chrome.runtime.sendMessage({ 
        type: 'UPDATE_SETTINGS', 
        settings: newSettings 
      });
      if (response.success) {
        this.settings = response.settings;
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const panelId = `panel-${tab.dataset.tab}`;
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(panelId).classList.add('active');
        
        if (tab.dataset.tab === 'history') {
          this.loadHistory();
        }
      });
    });
  }

  setupHistory() {
    document.getElementById('clearHistory').addEventListener('click', async () => {
      if (confirm('Clear all click history?')) {
        await this.clearHistory();
      }
    });
  }

  async loadHistory() {
    try {
      const statsResponse = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
      if (statsResponse.success) {
        document.getElementById('totalClicks').textContent = statsResponse.stats.totalClicks || 0;
        document.getElementById('uniqueDomains').textContent = 
          Object.keys(statsResponse.stats.domains || {}).length;
      }
      
      const historyResponse = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
      if (historyResponse.success) {
        this.renderHistory(historyResponse.history);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  renderHistory(history) {
    const container = document.getElementById('historyList');
    container.textContent = '';

    if (!history || history.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'history-empty';
      empty.textContent = 'No history yet. Click on links to start recording.';
      container.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of history.slice(0, 50)) {
      const time = this.formatTime(item.timestamp);
      const icon = this.getDomainIcon(item.hostname);
      const shortUrl = item.url.length > 40 ? item.url.slice(0, 40) + '...' : item.url;

      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'history-item';
      link.title = item.url;

      const iconDiv = document.createElement('div');
      iconDiv.className = 'history-icon';
      iconDiv.textContent = icon;

      const infoDiv = document.createElement('div');
      infoDiv.className = 'history-info';

      const hostnameDiv = document.createElement('div');
      hostnameDiv.className = 'history-hostname';
      hostnameDiv.textContent = item.hostname;

      const urlDiv = document.createElement('div');
      urlDiv.className = 'history-url';
      urlDiv.textContent = shortUrl;

      const timeDiv = document.createElement('div');
      timeDiv.className = 'history-time';
      timeDiv.textContent = time;

      infoDiv.appendChild(hostnameDiv);
      infoDiv.appendChild(urlDiv);
      infoDiv.appendChild(timeDiv);

      const arrowDiv = document.createElement('div');
      arrowDiv.className = 'history-arrow';
      arrowDiv.textContent = '\u2192';

      link.appendChild(iconDiv);
      link.appendChild(infoDiv);
      link.appendChild(arrowDiv);

      fragment.appendChild(link);
    }

    container.appendChild(fragment);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getDomainIcon(hostname) {
    const iconMap = {
      'youtube.com': '📺', 'youtu.be': '📺',
      'twitter.com': '🐦', 'x.com': '🐦',
      'facebook.com': '📘', 'tiktok.com': '🎵',
      'linkedin.com': '💼', 'github.com': '🐙',
      'reddit.com': '🤖', 'amazon.com': '📦',
      'spotify.com': '🎧', 'netflix.com': '🎬',
      'discord.com': '💬', 'twitch.tv': '🎮',
      'instagram.com': '📷', 'pinterest.com': '📌',
      'medium.com': '📝', 'wikipedia.org': '📚',
    };
    
    for (const [domain, icon] of Object.entries(iconMap)) {
      if (hostname.includes(domain)) return icon;
    }
    return '🔗';
  }

  async clearHistory() {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      await this.loadHistory();
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
