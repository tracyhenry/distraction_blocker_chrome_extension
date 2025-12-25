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
    getSitesGroupedByCategory
  };
}

