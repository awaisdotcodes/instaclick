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

## Changelog

### v2.4.7

### v2.4.6
- **Fixed hover behavior** - Small delay (150ms) when leaving link allows moving to card
- **Card hides immediately** when mouse leaves the card itself
- **Balanced UX** - Easy to reach card, but disappears instantly when you leave it

### v2.4.5
- **Hover card hides immediately** - Card disappears instantly when mouse leaves (no delay)
- **QR popup hides immediately** - Same instant hide behavior for QR popup
- **Removed unnecessary delays** - Faster, more responsive UX

### v2.4.4
- **Fixed right-click on hover card** - Now shows proper browser context menu with "Open link in new tab"
- **Fixed middle-click on hover card** - Mouse scroll button now opens link in new tab
- **Uses actual anchor tag** - Hover card now uses real `<a>` element for proper link behavior

### v2.4.3
- **Simplified settings** - Removed link style option (using default style)
- **Moved hover features to About** - QR Code and Expand URL info now in About tab
- **Cleaner UI** - Streamlined settings panel

### v2.4.2
- **QR Code popup beside card** - QR code now appears to the right of hover card (or left/bottom if no space)
- **Cleaner QR display** - Just shows QR code, no extra branding below it
- **Smart positioning** - QR popup automatically positions based on available screen space
- **Improved hover behavior** - Moving between card and QR popup keeps both visible

### v2.4.1
- **Fixed hover card disappearing** - Card now stays visible when moving mouse to it
- **QR Code on hover card** - Click "📱 QR Code" button to generate QR for current link
- **URL Expander on hover card** - Click "🔓 Expand URL" to see real destination of short URLs
- **Removed Tools tab** - QR and Expand features moved to hover card for easier access
- **Better button styling** - Action buttons have distinct colors (green for expand, purple for QR)
- **Improved UX** - Small delay before hiding allows smooth mouse movement to card

### v2.4.0
- **New Tools Tab** - Added dedicated tools section in popup
- **QR Code Generator** - Generate QR codes for any URL (also on hover card)
- **URL Expander** - See where short URLs (bit.ly, t.co, etc.) really lead
- **Example URLs** - Try URL expander with example buttons
- **Offline Cache Setting** - Save previews for faster loading
- **Auto-Expand Short URLs Setting** - Toggle automatic URL expansion
- **Moved History Toggle** - Track history setting now in History tab
- **Bigger Popup** - More room for all features

### v2.3.3
- **Hover card hides immediately** - Card disappears as soon as mouse leaves link (unless moving to card)
- **Middle-click support** - Scroll wheel click opens link in new tab
- **Right-click context menu** - Shows proper browser context menu with "Open in new tab" option
- **Bigger popup** - Increased extension popup height to fit all content without scrollbar
- **Better branding** - "Powered by InstaClick" is now more prominent with gradient background

### v2.3.2
- **Fixed CORS errors completely** - No longer makes direct fetch requests from extension
- **Using Microlink API** - Gets page metadata and detects 404s server-side (no CORS issues)
- **History always records** - Removed settings check that was blocking history
- **Better 404 detection** - Uses API to detect if page exists or not
- **Cleaner error console** - No more CORS error spam

### v2.3.1
- Fixed CORS errors when fetching link previews
- Fixed history not recording clicks
- Links are now preloaded immediately when found (not just on visibility)
- Better 404 detection and display
- Added logging for debugging
- Click tracking now always sends to background (settings checked there)

### v2.3.0
- Website screenshot thumbnails using thum.io service
- Fixed "Extension context invalidated" errors
- Removed Instagram link handler (causes issues since we're on Instagram)
- Better error handling and graceful fallbacks
- Improved preload queue stability

### v2.2.0
- WhatsApp-style preview cards with thumbnails
- Dead link (404) detection with visual indicators
- Link preloading via Intersection Observer
- Clickable history items
- Right-click and middle-click tracking
- Extension branding on preview cards
- Updated sourcelogs.com attribution

### v2.1.0
- Rich link previews with Open Graph metadata
- Site-specific previews (YouTube, GitHub, Twitter, etc.)
- Quick actions (Open, Copy, Pin)

### v2.0.0
- Complete rewrite with improved architecture
- XSS-safe URL sanitization
- Settings popup with customization
- Keyboard navigation support
- Performance optimizations

### v1.0.0
- Initial release

---

**Discover more tools at [sourcelogs.com/tools](https://sourcelogs.com/tools)**
