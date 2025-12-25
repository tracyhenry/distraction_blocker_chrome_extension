// Background service worker for Focus Mode extension

const DEFAULT_CATEGORIES = [
  'Social Media',
  'News',
  'Entertainment',
  'Shopping',
  'Gaming'
];

// If this extension previously used declarativeNetRequest redirect/block rules,
// those rules can persist and override our current webNavigation-based logic.
// Clear them defensively on install/startup.
async function clearLegacyDnrRules() {
  try {
    const dnr = chrome.declarativeNetRequest;
    if (!dnr?.getDynamicRules || !dnr?.updateDynamicRules) return;

    const dynamicRules = await dnr.getDynamicRules();
    const dynamicIds = (dynamicRules || []).map(r => r.id).filter(id => typeof id === 'number');
    if (dynamicIds.length > 0) {
      await dnr.updateDynamicRules({ removeRuleIds: dynamicIds });
    }

    let sessionIds = [];
    if (dnr.getSessionRules && dnr.updateSessionRules) {
      const sessionRules = await dnr.getSessionRules();
      sessionIds = (sessionRules || []).map(r => r.id).filter(id => typeof id === 'number');
      if (sessionIds.length > 0) {
        await dnr.updateSessionRules({ removeRuleIds: sessionIds });
      }
    }

    if (dynamicIds.length > 0 || sessionIds.length > 0) {
      console.log('Cleared legacy DNR rules', { dynamic: dynamicIds.length, session: sessionIds.length });
    }
  } catch (e) {
    // Non-fatal; we still rely on webNavigation logic.
    console.warn('Failed clearing legacy DNR rules', e);
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Focus Mode extension installed');
  await clearLegacyDnrRules();
  await initializeStorage();
});

// Initialize/migrate on browser startup (service worker may be recreated often).
chrome.runtime.onStartup.addListener(async () => {
  await clearLegacyDnrRules();
  await initializeStorage();
});

// Also run a best-effort migration on service worker start.
(async () => {
  await clearLegacyDnrRules();
  await initializeStorage();
})().catch(() => { });

// Initialize storage with defaults
async function initializeStorage() {
  const data = await chrome.storage.local.get(null);

  // Fresh install defaults
  if (Object.keys(data).length === 0) {
    await chrome.storage.local.set({
      focusMode: false,
      categories: DEFAULT_CATEGORIES,
      blockedSites: [],
      // Temporary passes for "I really need this" moments.
      // Each entry: { domain, expiresAt, createdAt, reason, targetUrl? }
      temporaryAllows: []
    });
    return;
  }

  // Migration for existing installs (add missing keys without overwriting user data)
  const patch = {};
  if (!Array.isArray(data.categories)) patch.categories = DEFAULT_CATEGORIES;
  if (!Array.isArray(data.blockedSites)) patch.blockedSites = [];
  if (!Array.isArray(data.temporaryAllows)) patch.temporaryAllows = [];

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
}

// Remove expired temporary allows (and cap list size to avoid unbounded growth).
async function pruneTemporaryAllows() {
  const { temporaryAllows = [] } = await chrome.storage.local.get('temporaryAllows');
  const now = Date.now();

  const valid = temporaryAllows
    .filter(a => a && typeof a.expiresAt === 'number' && a.expiresAt > now)
    .slice(-100);

  if (valid.length !== temporaryAllows.length) {
    await chrome.storage.local.set({ temporaryAllows: valid });
  }

  return valid;
}

function normalizeHostnameToDomain(hostname) {
  return (hostname || '').toLowerCase().replace(/^www\./, '');
}

function domainMatches(candidateDomain, allowDomain) {
  if (!candidateDomain || !allowDomain) return false;
  return candidateDomain === allowDomain || candidateDomain.endsWith('.' + allowDomain);
}

async function isTemporarilyAllowed(url, blockedDomainHint) {
  let candidateDomain = null;
  try {
    const urlObj = new URL(url);
    candidateDomain = normalizeHostnameToDomain(urlObj.hostname);
  } catch {
    return false;
  }

  const allows = await pruneTemporaryAllows();
  const hint = blockedDomainHint ? blockedDomainHint.toLowerCase() : null;

  // Helpful debug signal when troubleshooting allow-not-working issues.
  // (Visible in chrome://extensions -> Service worker -> Inspect)
  // console.log('Temp allow check', { url, hint, allowsCount: allows.length });

  return allows.some(a => {
    const allowDomain = (a.domain || '').toLowerCase();
    if (!allowDomain) return false;

    // If we already know which blocked domain matched, prefer that exact domain match.
    if (hint && allowDomain === hint) return true;

    // Otherwise match by candidate domain / subdomain.
    return domainMatches(candidateDomain, allowDomain);
  });
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
    // If the user granted a temporary pass for this domain, don't block.
    if (await isTemporarilyAllowed(details.url, blockedSite.domain)) {
      console.log('Temporarily allowing (final URL):', details.url);
      return;
    }

    console.log('Blocking (final URL):', details.url, '-> matched:', blockedSite.domain);

    // Redirect to blocked page
    const blockedPageUrl = chrome.runtime.getURL(
      `/blocked/blocked.html?domain=${encodeURIComponent(blockedSite.domain)}&category=${encodeURIComponent(blockedSite.category)}&url=${encodeURIComponent(details.url)}`
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
    if (await isTemporarilyAllowed(details.url, blockedSite.domain)) {
      console.log('Temporarily allowing (history state):', details.url);
      return;
    }

    console.log('Blocking (history state):', details.url, '-> matched:', blockedSite.domain);

    const blockedPageUrl = chrome.runtime.getURL(
      `/blocked/blocked.html?domain=${encodeURIComponent(blockedSite.domain)}&category=${encodeURIComponent(blockedSite.category)}&url=${encodeURIComponent(details.url)}`
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

  if (message.action === 'grantTemporaryPass') {
    (async () => {
      try {
        const domain = (message.domain || '').toLowerCase().trim().replace(/^www\./, '');
        const durationMs = Number(message.durationMs);
        const reason = typeof message.reason === 'string' ? message.reason.trim() : '';
        const targetUrl = typeof message.targetUrl === 'string' ? message.targetUrl : null;

        if (!domain) {
          sendResponse({ success: false, error: 'Missing domain' });
          return;
        }

        // Reason is the "intentional friction" piece. Keep it required.
        // Count words (split by whitespace, filter empty strings)
        const wordCount = reason.split(/\s+/).filter(w => w.length > 0).length;
        if (wordCount < 5) {
          sendResponse({ success: false, error: 'Reason must be at least 5 words' });
          return;
        }

        // Clamp duration: 1 min .. 30 min (default 5 min)
        const clamped = Number.isFinite(durationMs) ? Math.max(60_000, Math.min(30 * 60_000, durationMs)) : 5 * 60_000;

        const { temporaryAllows = [] } = await chrome.storage.local.get('temporaryAllows');
        const now = Date.now();
        const expiresAt = now + clamped;

        const next = [
          ...temporaryAllows.filter(a => a && a.expiresAt && a.expiresAt > now),
          { domain, createdAt: now, expiresAt, reason, targetUrl }
        ].slice(-100);

        await chrome.storage.local.set({ temporaryAllows: next });
        console.log('Temporary pass granted', { domain, expiresAt, durationMs: clamped, targetUrl });
        sendResponse({ success: true, expiresAt });
      } catch (e) {
        console.error('grantTemporaryPass failed', e);
        sendResponse({ success: false, error: 'Unexpected error' });
      }
    })();
    return true;
  }
});

// Log when service worker starts
console.log('Focus Mode background service worker started');
