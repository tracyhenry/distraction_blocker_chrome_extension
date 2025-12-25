# Focus Mode - Distraction Blocker

A Chrome extension that helps you stay focused by blocking distracting websites.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build CSS** (one-time or after style changes)
   ```bash
   npm run build
   ```

   Or watch for changes during development:
   ```bash
   npm run dev
   ```

## Install in Chrome

1. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions`
   - Or: three-dot menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `distraction_blocker` folder

4. **Pin the extension** (recommended)
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "Focus Mode"

## Usage

- Click the extension icon to open the popup
- Toggle Focus Mode on/off
- Add websites to your block list with categories
- Blocked sites show a motivational page during focus mode

## Development

After code changes:
1. Run `npm run build` if you changed styles
2. Go to `chrome://extensions`
3. Click the refresh icon on Focus Mode

