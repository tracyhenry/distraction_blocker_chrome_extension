// Storage utilities for Focus Mode extension

const DEFAULT_CATEGORIES = [
  'Social Media',
  'News',
  'Entertainment',
  'Shopping',
  'Gaming'
];

const DEFAULT_STATE = {
  focusMode: false,
  categories: DEFAULT_CATEGORIES,
  blockedSites: [],
  blockedKeywords: []
};

// Generate a unique ID
function generateId() {
  return 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize storage with defaults if empty
async function initializeStorage() {
  const data = await chrome.storage.local.get(null);

  if (Object.keys(data).length === 0) {
    await chrome.storage.local.set(DEFAULT_STATE);
    return DEFAULT_STATE;
  }

  // Ensure all required keys exist
  const updates = {};
  if (data.focusMode === undefined) updates.focusMode = false;
  if (!data.categories) updates.categories = DEFAULT_CATEGORIES;
  if (!data.blockedSites) updates.blockedSites = [];
  if (!data.blockedKeywords) updates.blockedKeywords = [];

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  return { ...DEFAULT_STATE, ...data, ...updates };
}

// Focus Mode operations
async function getFocusMode() {
  const { focusMode } = await chrome.storage.local.get('focusMode');
  return focusMode ?? false;
}

async function setFocusMode(enabled) {
  await chrome.storage.local.set({ focusMode: enabled });
  return enabled;
}

async function toggleFocusMode() {
  const current = await getFocusMode();
  return await setFocusMode(!current);
}

// Blocked Sites operations
async function getBlockedSites() {
  const { blockedSites } = await chrome.storage.local.get('blockedSites');
  return blockedSites ?? [];
}

// `target` is either a bare domain ("reddit.com") or a domain plus a path
// ("github.com/user/repo"). A path means only that page and its children are
// blocked; no path means the whole domain.
async function addBlockedSite(target, category) {
  const sites = await getBlockedSites();

  const { domain, path } = parseBlockTarget(target);

  if (!domain) {
    throw new Error('Please enter a domain');
  }

  if (sites.some(site => site.domain === domain && (site.path || '') === path)) {
    throw new Error(path ? 'This page is already blocked' : 'Site already blocked');
  }

  const newSite = {
    id: generateId(),
    domain: domain,
    path: path,
    category: category,
    dateAdded: new Date().toISOString()
  };

  sites.push(newSite);
  await chrome.storage.local.set({ blockedSites: sites });

  return newSite;
}

async function removeBlockedSite(siteId) {
  const sites = await getBlockedSites();
  const filteredSites = sites.filter(site => site.id !== siteId);

  if (filteredSites.length === sites.length) {
    throw new Error('Site not found');
  }

  await chrome.storage.local.set({ blockedSites: filteredSites });
  return true;
}

async function isUrlBlocked(url) {
  const sites = await getBlockedSites();
  return findBlockedSite(url, sites);
}

// Blocked Keywords operations (for search-engine keyword blocking)
function normalizeKeyword(keyword) {
  return String(keyword || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function getBlockedKeywords() {
  const { blockedKeywords } = await chrome.storage.local.get('blockedKeywords');
  return blockedKeywords ?? [];
}

async function addBlockedKeyword(keyword) {
  const normalized = normalizeKeyword(keyword);

  if (!normalized) {
    throw new Error('Keyword cannot be empty');
  }

  const keywords = await getBlockedKeywords();
  if (keywords.some(k => k.keyword === normalized)) {
    throw new Error('Keyword already blocked');
  }

  const newKeyword = {
    id: generateId(),
    keyword: normalized,
    dateAdded: new Date().toISOString()
  };

  keywords.push(newKeyword);
  await chrome.storage.local.set({ blockedKeywords: keywords });

  return newKeyword;
}

async function removeBlockedKeyword(keywordId) {
  const keywords = await getBlockedKeywords();
  const filtered = keywords.filter(k => k.id !== keywordId);

  if (filtered.length === keywords.length) {
    throw new Error('Keyword not found');
  }

  await chrome.storage.local.set({ blockedKeywords: filtered });
  return true;
}

// Categories operations
async function getCategories() {
  const { categories } = await chrome.storage.local.get('categories');
  return categories ?? DEFAULT_CATEGORIES;
}

async function addCategory(name) {
  const categories = await getCategories();
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Category name cannot be empty');
  }

  if (categories.includes(trimmedName)) {
    throw new Error('Category already exists');
  }

  categories.push(trimmedName);
  await chrome.storage.local.set({ categories });

  return categories;
}

async function removeCategory(name) {
  const categories = await getCategories();
  const filteredCategories = categories.filter(cat => cat !== name);

  if (filteredCategories.length === categories.length) {
    throw new Error('Category not found');
  }

  await chrome.storage.local.set({ categories: filteredCategories });
  return filteredCategories;
}

// Helper functions
function normalizeDomain(domain) {
  return parseBlockTarget(domain).domain;
}

// Split what the user typed (or what we read off the current tab) into a domain
// and an optional path prefix:
//   "reddit.com"                     -> { domain: 'reddit.com', path: '' }
//   "https://github.com/user/repo/"  -> { domain: 'github.com', path: '/user/repo' }
// An empty path means "the whole domain".
function parseBlockTarget(target) {
  let normalized = String(target || '').toLowerCase().trim();

  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');

  // Remove www. prefix
  normalized = normalized.replace(/^www\./, '');

  // Query strings and fragments don't take part in matching
  normalized = normalized.split(/[?#]/)[0];

  const slash = normalized.indexOf('/');
  if (slash === -1) {
    return { domain: normalized, path: '' };
  }

  return {
    domain: normalized.slice(0, slash),
    // Trailing slashes are meaningless here, so "/user/repo/" === "/user/repo",
    // and a bare "/" collapses to '' (i.e. the whole domain).
    path: normalized.slice(slash).replace(/\/+$/, '')
  };
}

// A URL's path, normalized the same way blocked paths are.
function normalizeUrlPath(pathname) {
  return String(pathname || '/').toLowerCase().replace(/\/+$/, '') || '/';
}

// Does a URL's path fall under a blocked path? Matching is on whole segments,
// so "/user/repo" covers "/user/repo/issues" but NOT "/user/repo-two".
function pathMatches(urlPath, blockedPath) {
  if (!blockedPath) return true; // whole-domain block
  const path = normalizeUrlPath(urlPath);
  return path === blockedPath || path.startsWith(blockedPath + '/');
}

// Find the blocked-sites entry that matches a URL, or null. When several match
// (e.g. the whole domain plus one specific page), the most specific one wins.
function findBlockedSite(url, sites) {
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    return null;
  }

  const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
  const urlPath = normalizeUrlPath(urlObj.pathname);

  let best = null;
  for (const site of sites || []) {
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

// How a blocked entry is shown to the user and keyed in stats.
function formatBlockedSite(site) {
  if (!site) return '';
  return `${site.domain || ''}${site.path || ''}`;
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Get sites grouped by category
async function getSitesGroupedByCategory() {
  const sites = await getBlockedSites();
  const grouped = {};

  sites.forEach(site => {
    if (!grouped[site.category]) {
      grouped[site.category] = [];
    }
    grouped[site.category].push(site);
  });

  return grouped;
}

// ============ Stats Functions ============

// Get all block stats
async function getBlockStats() {
  const { blockStats } = await chrome.storage.local.get('blockStats');
  return blockStats ?? [];
}

// Get stats for a specific period
// period: 'day' | 'week' | 'month' | 'year' | 'all'
async function getStatsForPeriod(period) {
  const stats = await getBlockStats();
  const now = new Date();

  // Calculate time boundaries
  const boundaries = getPeriodBoundaries(period, now);

  // Filter events within the period
  const filtered = stats.filter(e => e.timestamp >= boundaries.start && e.timestamp <= boundaries.end);

  // Calculate total
  const total = filtered.length;

  // Calculate trend data
  const trend = calculateTrend(filtered, period, now);

  // Calculate by category
  const byCategory = {};
  filtered.forEach(e => {
    const cat = e.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  // Calculate top sites
  const siteCounts = {};
  filtered.forEach(e => {
    const domain = e.domain || 'unknown';
    siteCounts[domain] = (siteCounts[domain] || 0) + 1;
  });

  const topSites = Object.entries(siteCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { total, trend, byCategory, topSites };
}

// Get period boundaries (start and end timestamps)
function getPeriodBoundaries(period, now) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;

  switch (period) {
    case 'day':
      return { start: startOfDay, end: endOfDay };

    case 'week': {
      // Past 7 days (rolling window, including today)
      const startOfWeek = startOfDay - 6 * 24 * 60 * 60 * 1000;
      return { start: startOfWeek, end: endOfDay };
    }

    case 'month': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      return { start: startOfMonth, end: endOfMonth };
    }

    case 'year': {
      const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
      const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
      return { start: startOfYear, end: endOfYear };
    }

    case 'all':
    default:
      return { start: 0, end: Date.now() };
  }
}

// Calculate trend data for visualization
function calculateTrend(events, period, now) {
  switch (period) {
    case 'day':
      return calculateHourlyTrend(events, now);
    case 'week':
      return calculateDailyTrend(events, now, 7);
    case 'month':
      return calculateDailyTrend(events, now, getDaysInMonth(now));
    case 'year':
      return calculateMonthlyTrend(events, now);
    case 'all':
      return calculateAllTimeTrend(events);
    default:
      return [];
  }
}

// Get number of days in current month
function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

// Hourly trend for "day" view (24 bars)
function calculateHourlyTrend(events, now) {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const hourMs = 60 * 60 * 1000;

  const hours = [];
  for (let i = 0; i < 24; i++) {
    const hourStart = startOfDay + i * hourMs;
    const hourEnd = hourStart + hourMs;
    const count = events.filter(e => e.timestamp >= hourStart && e.timestamp < hourEnd).length;

    // Format label: 12am, 1am, ..., 12pm, 1pm, ...
    const label = i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`;
    hours.push({ label, count });
  }
  return hours;
}

// Daily trend for "week" or "month" view
function calculateDailyTrend(events, now, numDays) {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayMs = 24 * 60 * 60 * 1000;

  // For week: past 7 days (rolling window, including today)
  // For month: start from 1st of current month
  let startDate;
  if (numDays === 7) {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  for (let i = 0; i < numDays; i++) {
    const dayStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i).getTime();
    const dayEnd = dayStart + dayMs;
    const count = events.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd).length;

    // Label: day name for week, date number for month
    const dayDate = new Date(dayStart);
    const label = numDays === 7 ? dayNames[dayDate.getDay()] : String(dayDate.getDate());
    days.push({ label, count });
  }
  return days;
}

// Monthly trend for "year" view (12 bars)
function calculateMonthlyTrend(events, now) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = [];

  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(now.getFullYear(), i, 1).getTime();
    const monthEnd = new Date(now.getFullYear(), i + 1, 0, 23, 59, 59, 999).getTime();
    const count = events.filter(e => e.timestamp >= monthStart && e.timestamp <= monthEnd).length;

    months.push({ label: monthNames[i], count });
  }
  return months;
}

// All-time trend (by month, all months since first event)
function calculateAllTimeTrend(events) {
  if (events.length === 0) return [];

  // Find earliest and latest event
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const earliest = new Date(sorted[0].timestamp);
  const latest = new Date(sorted[sorted.length - 1].timestamp);

  const months = [];
  let current = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);

  while (current <= end) {
    const monthStart = current.getTime();
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    const count = events.filter(e => e.timestamp >= monthStart && e.timestamp <= monthEnd).length;

    // Format: "Jan '24"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = `${monthNames[current.getMonth()]} '${String(current.getFullYear()).slice(-2)}`;

    months.push({ label, count });

    // Move to next month
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  return months;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.FocusModeStorage = {
    initializeStorage,
    getFocusMode,
    setFocusMode,
    toggleFocusMode,
    getBlockedSites,
    addBlockedSite,
    removeBlockedSite,
    isUrlBlocked,
    getBlockedKeywords,
    addBlockedKeyword,
    removeBlockedKeyword,
    normalizeKeyword,
    getCategories,
    addCategory,
    removeCategory,
    normalizeDomain,
    parseBlockTarget,
    normalizeUrlPath,
    pathMatches,
    findBlockedSite,
    formatBlockedSite,
    extractDomain,
    getSitesGroupedByCategory,
    // Stats functions
    getBlockStats,
    getStatsForPeriod
  };
}

