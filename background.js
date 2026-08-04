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
      // Blocked search keywords. Searching for one of these on a search engine
      // (Google, Bing, etc.) redirects to the blocked page.
      // Each entry: { id, keyword, dateAdded }
      blockedKeywords: [],
      // Temporary passes for "I really need this" moments.
      // Each entry: { domain, expiresAt, createdAt, reason, targetUrl? }
      temporaryAllows: [],
      // Stats: record each block event with timestamp
      // Each entry: { timestamp, domain, category }
      blockStats: []
    });
    return;
  }

  // Migration for existing installs (add missing keys without overwriting user data)
  const patch = {};
  if (!Array.isArray(data.categories)) patch.categories = DEFAULT_CATEGORIES;
  if (!Array.isArray(data.blockedSites)) patch.blockedSites = [];
  if (!Array.isArray(data.blockedKeywords)) patch.blockedKeywords = [];
  if (!Array.isArray(data.temporaryAllows)) patch.temporaryAllows = [];
  if (!Array.isArray(data.blockStats)) patch.blockStats = [];

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
}

// Record a block event for stats tracking
async function recordBlockEvent(domain, category) {
  try {
    const { blockStats = [] } = await chrome.storage.local.get('blockStats');
    const event = {
      timestamp: Date.now(),
      domain: domain.toLowerCase(),
      category: category || 'Uncategorized'
    };

    // Keep last 10,000 events to prevent unbounded growth
    const updated = [...blockStats, event].slice(-10000);
    await chrome.storage.local.set({ blockStats: updated });
    console.log('Block event recorded:', event);
  } catch (e) {
    console.error('Failed to record block event:', e);
  }
}

// Remove recent block event for a domain (called when temporary pass is granted)
async function removeRecentBlockEvent(domain) {
  try {
    const { blockStats = [] } = await chrome.storage.local.get('blockStats');
    const normalizedDomain = domain.toLowerCase();

    // Find the most recent block event for this domain (within last 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    let indexToRemove = -1;

    for (let i = blockStats.length - 1; i >= 0; i--) {
      if (blockStats[i].domain === normalizedDomain && blockStats[i].timestamp >= fiveMinutesAgo) {
        indexToRemove = i;
        break;
      }
    }

    if (indexToRemove >= 0) {
      const removed = blockStats.splice(indexToRemove, 1)[0];
      await chrome.storage.local.set({ blockStats });
      console.log('Block event removed for temporary allow:', removed);
      return true;
    }

    return false;
  } catch (e) {
    console.error('Failed to remove block event:', e);
    return false;
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

// A URL's path, normalized the same way blocked paths are (lowercase, no
// trailing slash). Mirrors the helper in shared/storage.js.
function normalizeUrlPath(pathname) {
  return String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
}

// Does a URL's path fall under a blocked path? Matching is on whole segments,
// so "/user/repo" covers "/user/repo/issues" but NOT "/user/repo-two".
// An empty blocked path means the whole domain.
function pathMatches(urlPath, blockedPath) {
  if (!blockedPath) return true;
  const path = normalizeUrlPath(urlPath);
  return path === blockedPath || path.startsWith(blockedPath + '/');
}

// A pass is scoped to the exact entry it was granted for: passing
// github.com/user/repo does NOT unblock github.com/user/other-repo, but passing
// a whole domain unblocks everything under it.
async function isTemporarilyAllowed(url, blockedSiteHint) {
  let candidateDomain = null;
  let candidatePath = '/';
  try {
    const urlObj = new URL(url);
    candidateDomain = normalizeHostnameToDomain(urlObj.hostname);
    candidatePath = normalizeUrlPath(urlObj.pathname);
  } catch {
    return false;
  }

  const allows = await pruneTemporaryAllows();
  const hintDomain = blockedSiteHint?.domain ? blockedSiteHint.domain.toLowerCase() : null;
  const hintPath = blockedSiteHint?.path || '';

  // Helpful debug signal when troubleshooting allow-not-working issues.
  // (Visible in chrome://extensions -> Service worker -> Inspect)
  // console.log('Temp allow check', { url, hintDomain, hintPath, allowsCount: allows.length });

  return allows.some(a => {
    const allowDomain = (a.domain || '').toLowerCase();
    if (!allowDomain) return false;
    const allowPath = a.path || '';

    // If we already know which blocked entry matched, prefer that exact entry.
    if (hintDomain && allowDomain === hintDomain && allowPath === hintPath) return true;

    // Otherwise match by candidate domain / subdomain, within the allowed path.
    return domainMatches(candidateDomain, allowDomain) && pathMatches(candidatePath, allowPath);
  });
}

// Whether there's an active temporary pass for a specific search keyword.
// Keyword passes are scoped to the keyword only — passing "world cup" does NOT
// unblock "nba games", and it does NOT unblock the whole search engine.
async function isKeywordTemporarilyAllowed(keyword) {
  const kw = (keyword || '').toLowerCase().trim();
  if (!kw) return false;

  const allows = await pruneTemporaryAllows();
  return allows.some(a => (a.keyword || '').toLowerCase().trim() === kw);
}

// Check if a URL matches any blocked site.
// A blocked entry is a domain plus an optional path prefix; entries without a
// path (everything created before path blocking existed) cover the whole domain.
// When several entries match, the most specific path wins.
function isUrlBlocked(url, blockedSites) {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return null;
  }

  // Remove www. prefix for matching
  const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
  const urlPath = normalizeUrlPath(urlObj.pathname);

  let best = null;
  for (const site of blockedSites || []) {
    const blockedDomain = (site?.domain || '').toLowerCase();
    if (!blockedDomain) continue;

    // Exact match or subdomain match
    if (domain !== blockedDomain && !domain.endsWith('.' + blockedDomain)) continue;

    const blockedPath = site.path || '';
    if (!pathMatches(urlPath, blockedPath)) continue;

    if (!best || blockedPath.length > (best.path || '').length) best = site;
  }

  return best;
}

// How a blocked entry is shown to the user and keyed in stats
// ("github.com" or "github.com/user/repo").
function formatBlockedSite(site) {
  if (!site) return '';
  return `${site.domain || ''}${site.path || ''}`;
}

// Extract the user's search text from a search-engine results URL.
// Returns the raw query string (e.g. "nba games") or null if this isn't a search.
function getSearchQuery(url) {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return null;
  }

  const host = urlObj.hostname.toLowerCase();
  const isSearchEngine =
    host.includes('google.') ||
    host.includes('bing.com') ||
    host.includes('duckduckgo.com') ||
    host.includes('search.yahoo.') ||
    host.includes('search.brave.com') ||
    host.includes('ecosia.org') ||
    host.includes('startpage.com');

  if (!isSearchEngine) return null;

  // Most engines use `q`; Yahoo uses `p`; some use `query`.
  for (const key of ['q', 'query', 'p']) {
    const value = urlObj.searchParams.get(key);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

// If the URL is a search whose query contains a blocked keyword, return the
// matched keyword entry; otherwise null.
function getMatchedKeyword(url, blockedKeywords) {
  if (!Array.isArray(blockedKeywords) || blockedKeywords.length === 0) return null;

  const query = getSearchQuery(url);
  if (!query) return null;

  const normalizedQuery = query.toLowerCase();
  for (const entry of blockedKeywords) {
    const keyword = (entry?.keyword || '').toLowerCase().trim();
    if (keyword && normalizedQuery.includes(keyword)) {
      return entry;
    }
  }
  return null;
}

// We listen to several navigation events (onBeforeNavigate, onCommitted,
// onHistoryStateUpdated, onCompleted) so we catch a blocked page/search as early
// as possible and across Google's SPA behavior. Because multiple events can fire
// for the SAME navigation, this map dedupes so we don't redirect/record twice.
const recentlyHandled = new Map(); // tabId -> { url, ts }
const DEDUPE_WINDOW_MS = 4000;

function alreadyHandled(tabId, url) {
  const prev = recentlyHandled.get(tabId);
  return !!prev && prev.url === url && (Date.now() - prev.ts) < DEDUPE_WINDOW_MS;
}

function markHandled(tabId, url) {
  recentlyHandled.set(tabId, { url, ts: Date.now() });
  // Keep the map small.
  if (recentlyHandled.size > 200) {
    const cutoff = Date.now() - DEDUPE_WINDOW_MS;
    for (const [k, v] of recentlyHandled) {
      if (v.ts < cutoff) recentlyHandled.delete(k);
    }
  }
}

// Shared handler for all navigation events. Checks domain blocks first, then
// search-keyword blocks, and redirects to the blocked page when appropriate.
async function handleNavigation(details, sourceLabel) {
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

  // Another event already redirected this exact tab+URL moments ago.
  if (alreadyHandled(details.tabId, details.url)) return;

  const { focusMode, blockedSites, blockedKeywords } =
    await chrome.storage.local.get(['focusMode', 'blockedSites', 'blockedKeywords']);

  // If focus mode is off, do nothing
  if (!focusMode) return;

  // 1. Domain / path-based blocking
  const blockedSite = isUrlBlocked(details.url, blockedSites || []);
  if (blockedSite) {
    if (await isTemporarilyAllowed(details.url, blockedSite)) {
      console.log(`Temporarily allowing (${sourceLabel}):`, details.url);
      return;
    }

    const blockedLabel = formatBlockedSite(blockedSite);
    console.log(`Blocking (${sourceLabel}):`, details.url, '-> matched:', blockedLabel);
    markHandled(details.tabId, details.url);
    // Recorded under the full label so a blocked page shows up separately from
    // its domain in stats.
    await recordBlockEvent(blockedLabel, blockedSite.category);

    const blockedPageUrl = chrome.runtime.getURL(
      `/blocked/blocked.html?domain=${encodeURIComponent(blockedSite.domain)}&path=${encodeURIComponent(blockedSite.path || '')}&category=${encodeURIComponent(blockedSite.category)}&url=${encodeURIComponent(details.url)}`
    );
    chrome.tabs.update(details.tabId, { url: blockedPageUrl });
    return;
  }

  // 2. Search-keyword blocking
  const matchedKeyword = getMatchedKeyword(details.url, blockedKeywords || []);
  if (matchedKeyword) {
    // A temporary pass is scoped to this exact keyword only.
    if (await isKeywordTemporarilyAllowed(matchedKeyword.keyword)) {
      console.log(`Temporarily allowing keyword (${sourceLabel}):`, matchedKeyword.keyword);
      return;
    }

    console.log(`Blocking search (${sourceLabel}):`, details.url, '-> keyword:', matchedKeyword.keyword);
    markHandled(details.tabId, details.url);
    // Record under the keyword itself so it shows up meaningfully in stats.
    await recordBlockEvent(matchedKeyword.keyword, 'Search Keyword');

    const blockedPageUrl = chrome.runtime.getURL(
      `/blocked/blocked.html?keyword=${encodeURIComponent(matchedKeyword.keyword)}&category=${encodeURIComponent('Search Keyword')}&url=${encodeURIComponent(details.url)}`
    );
    chrome.tabs.update(details.tabId, { url: blockedPageUrl });
  }
}

// Intercept as early as possible: onBeforeNavigate fires the instant a navigation
// starts (before the search results load), onCommitted once the URL is committed.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  handleNavigation(details, 'before navigate');
});

chrome.webNavigation.onCommitted.addListener((details) => {
  handleNavigation(details, 'committed');
});

// SPA navigations (typing a new query on an existing Google results page).
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  handleNavigation(details, 'history state');
});

// Backstop: catch anything the earlier events missed once the page finishes.
chrome.webNavigation.onCompleted.addListener((details) => {
  handleNavigation(details, 'completed');
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
        // Scope the pass to the same path the blocked entry used ('' = whole domain).
        const path = (message.path || '').toLowerCase().trim().replace(/\/+$/, '');
        const keyword = (message.keyword || '').toLowerCase().trim();
        const durationMs = Number(message.durationMs);
        const targetUrl = typeof message.targetUrl === 'string' ? message.targetUrl : null;

        // A pass is either for a site (domain) or a search keyword — need one.
        if (!domain && !keyword) {
          sendResponse({ success: false, error: 'Missing domain or keyword' });
          return;
        }

        // Clamp duration: 1 min .. 60 min (default 5 min).
        // No typed reason required — a single click on a duration is enough.
        const clamped = Number.isFinite(durationMs) ? Math.max(60_000, Math.min(60 * 60_000, durationMs)) : 5 * 60_000;

        const { temporaryAllows = [] } = await chrome.storage.local.get('temporaryAllows');
        const now = Date.now();
        const expiresAt = now + clamped;

        const next = [
          ...temporaryAllows.filter(a => a && a.expiresAt && a.expiresAt > now),
          { domain: domain || null, path, keyword: keyword || null, createdAt: now, expiresAt, targetUrl }
        ].slice(-100);

        await chrome.storage.local.set({ temporaryAllows: next });

        // Remove the recent block event (keyword blocks are recorded under the
        // keyword, site blocks under "domain + path").
        await removeRecentBlockEvent(keyword || `${domain}${path}`);

        console.log('Temporary pass granted', { domain, path, keyword, expiresAt, durationMs: clamped, targetUrl });
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
