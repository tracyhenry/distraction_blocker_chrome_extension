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
  blockedSites: []
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

async function addBlockedSite(domain, category) {
  const sites = await getBlockedSites();

  // Check if domain already exists
  const normalizedDomain = normalizeDomain(domain);
  if (sites.some(site => site.domain === normalizedDomain)) {
    throw new Error('Site already blocked');
  }

  const newSite = {
    id: generateId(),
    domain: normalizedDomain,
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
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, '');
    const sites = await getBlockedSites();

    return sites.find(site => {
      // Check if the URL's domain matches or is a subdomain of the blocked domain
      return domain === site.domain || domain.endsWith('.' + site.domain);
    });
  } catch {
    return null;
  }
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
  let normalized = domain.toLowerCase().trim();

  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');

  // Remove www. prefix
  normalized = normalized.replace(/^www\./, '');

  // Remove trailing slash and path
  normalized = normalized.split('/')[0];

  return normalized;
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
    getCategories,
    addCategory,
    removeCategory,
    normalizeDomain,
    extractDomain,
    getSitesGroupedByCategory,
    // Stats functions
    getBlockStats,
    getStatsForPeriod
  };
}

