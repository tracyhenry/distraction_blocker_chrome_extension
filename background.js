// Background service worker for Focus Mode extension

const DEFAULT_CATEGORIES = [
  'Social Media',
  'News',
  'Entertainment',
  'Shopping',
  'Gaming'
];

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Focus Mode extension installed');
  await initializeStorage();
});

// Initialize storage with defaults
async function initializeStorage() {
  const data = await chrome.storage.local.get(null);

  if (Object.keys(data).length === 0) {
    await chrome.storage.local.set({
      focusMode: false,
      categories: DEFAULT_CATEGORIES,
      blockedSites: []
    });
  }
}

// Check if a URL matches any blocked site
function isUrlBlocked(url, blockedSites) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Remove www. prefix for matching
    const domain = hostname.replace(/^www\./, '');

    for (const site of blockedSites) {
      const blockedDomain = site.domain.toLowerCase();

      // Exact match or subdomain match
      if (domain === blockedDomain || domain.endsWith('.' + blockedDomain)) {
        return site;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Listen for completed navigations - this catches the FINAL URL after all redirects
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only check main frame navigations (not iframes)
  if (details.frameId !== 0) return;

  // Skip chrome:// and extension pages
  if (details.url.startsWith('chrome://') ||
    details.url.startsWith('chrome-extension://') ||
    details.url.startsWith('about:')) {
    return;
  }

  // Skip our own blocked page to avoid infinite loops
  if (details.url.includes('blocked/blocked.html')) {
    return;
  }

  const { focusMode, blockedSites } = await chrome.storage.local.get(['focusMode', 'blockedSites']);

  // If focus mode is off, do nothing
  if (!focusMode) return;

  // Check if the FINAL URL is blocked
  const blockedSite = isUrlBlocked(details.url, blockedSites || []);

  if (blockedSite) {
    console.log('Blocking (final URL):', details.url, '-> matched:', blockedSite.domain);

    // Redirect to blocked page
    const blockedPageUrl = chrome.runtime.getURL(
      `/blocked/blocked.html?domain=${encodeURIComponent(blockedSite.domain)}&category=${encodeURIComponent(blockedSite.category)}`
    );

    // Update the tab to show blocked page
    chrome.tabs.update(details.tabId, { url: blockedPageUrl });
  }
});

// Also listen for URL changes within a tab (like SPA navigations)
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  // Only check main frame
  if (details.frameId !== 0) return;

  // Skip chrome:// and extension pages
  if (details.url.startsWith('chrome://') ||
    details.url.startsWith('chrome-extension://') ||
    details.url.startsWith('about:')) {
    return;
  }

  // Skip our own blocked page
  if (details.url.includes('blocked/blocked.html')) {
    return;
  }

  const { focusMode, blockedSites } = await chrome.storage.local.get(['focusMode', 'blockedSites']);

  if (!focusMode) return;

  const blockedSite = isUrlBlocked(details.url, blockedSites || []);

  if (blockedSite) {
    console.log('Blocking (history state):', details.url, '-> matched:', blockedSite.domain);

    const blockedPageUrl = chrome.runtime.getURL(
      `/blocked/blocked.html?domain=${encodeURIComponent(blockedSite.domain)}&category=${encodeURIComponent(blockedSite.category)}`
    );

    chrome.tabs.update(details.tabId, { url: blockedPageUrl });
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateRules') {
    // No longer using declarativeNetRequest, but keep message handler for compatibility
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'getState') {
    chrome.storage.local.get(['focusMode', 'blockedSites', 'categories']).then(data => {
      sendResponse(data);
    });
    return true;
  }
});

// Log when service worker starts
console.log('Focus Mode background service worker started');
