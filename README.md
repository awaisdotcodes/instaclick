# InstaClick v2.4.7

**Automatically converts plain text URLs in Instagram posts, comments, bios, and reels into clickable links.**

![Version](https://img.shields.io/badge/version-2.4.7-blue)
![Chrome](https://img.shields.io/badge/chrome-extension-green)

## Features

- 🔗 **Smart URL Detection** - Improved regex with fewer false positives
- 🛡️ **XSS-Safe** - Secure URL sanitization prevents malicious links
- 🌙 **Dark Mode Support** - Automatic theme detection
- 👁️ **Rich Link Previews** - WhatsApp-style previews with website screenshots
- ⚡ **Instant Previews** - Preloads links as they become visible
- 🚫 **Dead Link Detection** - Identifies 404/broken links with visual warning
- ⌨️ **Keyboard Navigation** - Tab and Enter support
- 📊 **Click History** - Clickable history with tracking

## What's New in v2.3

- **Website Screenshots** - Preview cards now show actual website thumbnails
- **Fixed extension context errors** - Better handling when extension reloads
- **Removed Instagram link fetching** - No more errors when hovering Instagram links
- **Improved error recovery** - Graceful fallbacks instead of error messages
- **Better stability** - More robust preloading and caching

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `instaclick-v2` folder
6. Visit Instagram and enjoy clickable links!

## Usage

Once installed, the extension automatically:
- Detects URLs in posts, comments, bios, and reels
- Converts them to clickable links
- Preloads link previews as you scroll
- Shows rich previews on hover
- Marks broken/404 links with a warning

### Settings

Click the extension icon to access settings:

- **Extension Enabled** - Turn the extension on/off
- **Open in new tab** - Links open in new tabs (default: on)
- **Show link preview** - Hover preview cards (default: on)
- **Link style** - Choose from Default, Subtle, or Bold
- **Track click history** - Log clicked links locally (default: off)

## Preview Card

The preview card shows:
- Page thumbnail (if available)
- Page title
- Website favicon and domain
- Site badge (YouTube, GitHub, Twitter, etc.)
- Play button for video content
- Extension branding

For broken links (404):
- Error icon and message
- Link changes to red with strikethrough
- Warning emoji indicator

## Privacy

- All data is stored locally on your device
- No data is sent to external servers
- Click history (if enabled) is stored only in your browser
- You can clear history at any time from the settings

## Technical Details

### File Structure

```
instaclick-v2/
├── manifest.json          # Extension configuration
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── src/
    ├── background.js      # Service worker
    ├── content.js         # Main content script
    ├── preview.js         # Link preview manager
    ├── styles.css         # Link and preview styles
    ├── popup.html         # Settings UI
    ├── popup.css          # Popup styles
    └── popup.js           # Popup logic
```

### Permissions

- `activeTab` - Access current tab to process links
- `storage` - Save settings and click history

### Host Permissions

- `https://www.instagram.com/*`
- `https://instagram.com/*`

---

**Discover more tools at [sourcelogs.com/tools](https://sourcelogs.com/tools)**
