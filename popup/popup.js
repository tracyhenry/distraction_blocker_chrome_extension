// Popup script for Focus Mode extension

// DOM Elements - Header
const focusToggle = document.getElementById('focusToggle');
const focusStatus = document.getElementById('focusStatus');
const confettiContainer = document.getElementById('confettiContainer');

// DOM Elements - Tabs
const tabCurrentSite = document.getElementById('tabCurrentSite');
const tabManualAdd = document.getElementById('tabManualAdd');
const tabKeyword = document.getElementById('tabKeyword');
const currentSiteTab = document.getElementById('currentSiteTab');
const manualAddTab = document.getElementById('manualAddTab');
const keywordTab = document.getElementById('keywordTab');

// DOM Elements - Current Site Tab
const currentDomainEl = document.getElementById('currentDomain');
const categorySelect = document.getElementById('categorySelect');
const newCategoryContainer = document.getElementById('newCategoryContainer');
const newCategoryInput = document.getElementById('newCategoryInput');
const addSiteBtn = document.getElementById('addSiteBtn');
const addSiteMessage = document.getElementById('addSiteMessage');
const quickAddContent = document.getElementById('quickAddContent');
const alreadyBlocked = document.getElementById('alreadyBlocked');
const alreadyBlockedText = document.getElementById('alreadyBlockedText');
const alreadyBlockedCategory = document.getElementById('alreadyBlockedCategory');
const scopeSelector = document.getElementById('scopeSelector');
const scopeDomainBtn = document.getElementById('scopeDomainBtn');
const scopePathBtn = document.getElementById('scopePathBtn');
const scopeDomainLabel = document.getElementById('scopeDomainLabel');
const scopePathLabel = document.getElementById('scopePathLabel');

// DOM Elements - Manual Add Tab
const manualDomainInput = document.getElementById('manualDomainInput');
const manualCategorySelect = document.getElementById('manualCategorySelect');
const manualNewCategoryContainer = document.getElementById('manualNewCategoryContainer');
const manualNewCategoryInput = document.getElementById('manualNewCategoryInput');
const manualAddSiteBtn = document.getElementById('manualAddSiteBtn');
const manualAddMessage = document.getElementById('manualAddMessage');

// DOM Elements - Blocked Sites List
const sitesList = document.getElementById('sitesList');
const sitesCount = document.getElementById('sitesCount');
const emptyState = document.getElementById('emptyState');
const sitesContainer = document.getElementById('sitesContainer');

// DOM Elements - Keyword Tab
const keywordInput = document.getElementById('keywordInput');
const addKeywordBtn = document.getElementById('addKeywordBtn');
const keywordAddMessage = document.getElementById('keywordAddMessage');

// DOM Elements - Blocked Keywords List
const keywordsCount = document.getElementById('keywordsCount');
const keywordsEmptyState = document.getElementById('keywordsEmptyState');
const keywordsContainer = document.getElementById('keywordsContainer');

// State
let currentDomain = null;
// Path of the active tab, normalized ('' when it's the site root).
let currentPath = '';
// Which scope the quick-add button will use: 'domain' or 'path'.
let currentScope = 'domain';
let currentSiteBlocked = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await FocusModeStorage.initializeStorage();
  await loadFocusMode();
  await loadCategories();
  await loadCurrentTab();
  await loadBlockedSites();
  await loadBlockedKeywords();

  // Set up event listeners - Header
  focusToggle.addEventListener('click', handleToggleFocus);

  // Set up event listeners - Tabs
  tabCurrentSite.addEventListener('click', () => switchTab('current'));
  tabManualAdd.addEventListener('click', () => switchTab('manual'));
  tabKeyword.addEventListener('click', () => switchTab('keyword'));

  // Set up event listeners - Keyword Tab
  keywordInput.addEventListener('input', updateAddKeywordButtonState);
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddKeyword();
  });
  addKeywordBtn.addEventListener('click', handleAddKeyword);

  // Set up event listeners - Current Site Tab
  scopeDomainBtn.addEventListener('click', () => setScope('domain'));
  scopePathBtn.addEventListener('click', () => setScope('path'));
  categorySelect.addEventListener('change', handleCategoryChange);
  addSiteBtn.addEventListener('click', handleAddSite);
  newCategoryInput.addEventListener('input', updateAddButtonState);
  newCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddSite();
  });

  // Set up event listeners - Manual Add Tab
  manualDomainInput.addEventListener('input', updateManualAddButtonState);
  manualCategorySelect.addEventListener('change', handleManualCategoryChange);
  manualAddSiteBtn.addEventListener('click', handleManualAddSite);
  manualNewCategoryInput.addEventListener('input', updateManualAddButtonState);
  manualNewCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualAddSite();
  });
  manualDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleManualAddSite();
  });
});

// Switch between tabs
function switchTab(tab) {
  const tabs = [
    { name: 'current', btn: tabCurrentSite, panel: currentSiteTab },
    { name: 'manual', btn: tabManualAdd, panel: manualAddTab },
    { name: 'keyword', btn: tabKeyword, panel: keywordTab }
  ];

  tabs.forEach(({ name, btn, panel }) => {
    const active = name === tab;
    btn.classList.toggle('tab-active', active);
    btn.classList.toggle('text-gray-400', !active);
    panel.classList.toggle('hidden', !active);
  });
}

// Load and display focus mode state
async function loadFocusMode() {
  const enabled = await FocusModeStorage.getFocusMode();
  updateToggleUI(enabled);
}

// Update toggle UI
function updateToggleUI(enabled) {
  const knob = focusToggle.querySelector('.toggle-knob');

  if (enabled) {
    focusToggle.classList.remove('toggle-switch-off');
    focusToggle.classList.add('toggle-switch-on');
    knob.classList.remove('toggle-knob-off');
    knob.classList.add('toggle-knob-on');
    focusToggle.setAttribute('aria-checked', 'true');
    focusStatus.textContent = 'Stay focused! 🎯';
    focusStatus.classList.remove('text-gray-500');
    focusStatus.classList.add('text-teal-600');
  } else {
    focusToggle.classList.remove('toggle-switch-on');
    focusToggle.classList.add('toggle-switch-off');
    knob.classList.remove('toggle-knob-on');
    knob.classList.add('toggle-knob-off');
    focusToggle.setAttribute('aria-checked', 'false');
    focusStatus.textContent = 'Taking a break';
    focusStatus.classList.remove('text-teal-600');
    focusStatus.classList.add('text-gray-500');
  }
}

// Handle toggle focus mode
async function handleToggleFocus() {
  const newState = await FocusModeStorage.toggleFocusMode();
  updateToggleUI(newState);

  // Show confetti when turning on
  if (newState) {
    showConfetti();
  }

  // Notify background to update rules
  chrome.runtime.sendMessage({ action: 'updateRules' });
}

// Show confetti animation
function showConfetti() {
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF8585', '#6ED9D0'];
  const confettiCount = 30;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'absolute w-2 h-2 rounded-full animate-confetti';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.top = '50%';
    confetti.style.animationDelay = `${Math.random() * 0.3}s`;
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confettiContainer.appendChild(confetti);

    // Remove after animation
    setTimeout(() => confetti.remove(), 800);
  }
}

// Load categories into dropdown(s)
async function loadCategories() {
  const categories = await FocusModeStorage.getCategories();
  const defaultCategory = 'Shopping';

  // Populate current site category select
  categorySelect.innerHTML = '<option value="">Select category...</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (cat === defaultCategory) option.selected = true;
    categorySelect.appendChild(option);
  });
  const newOption = document.createElement('option');
  newOption.value = '__new__';
  newOption.textContent = '+ Create new category...';
  categorySelect.appendChild(newOption);

  // Populate manual add category select
  manualCategorySelect.innerHTML = '<option value="">Select category...</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (cat === defaultCategory) option.selected = true;
    manualCategorySelect.appendChild(option);
  });
  const manualNewOption = document.createElement('option');
  manualNewOption.value = '__new__';
  manualNewOption.textContent = '+ Create new category...';
  manualCategorySelect.appendChild(manualNewOption);
}

// Handle category selection change
function handleCategoryChange() {
  const value = categorySelect.value;

  if (value === '__new__') {
    newCategoryContainer.classList.remove('hidden');
    newCategoryInput.focus();
    addSiteBtn.disabled = true;
  } else {
    newCategoryContainer.classList.add('hidden');
    newCategoryInput.value = '';
    updateAddButtonState();
  }
}

// Update add button state
function updateAddButtonState() {
  const value = categorySelect.value;
  const isNewCategory = value === '__new__';
  const newCategoryName = newCategoryInput.value.trim();

  // Enable if we have current domain AND either:
  // - A valid category selected (not empty, not __new__)
  // - OR new category is selected AND has a non-empty name
  addSiteBtn.disabled = !currentDomain || !value || (isNewCategory && !newCategoryName);
}

// Get current tab domain + path
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
      const { domain, path } = FocusModeStorage.parseBlockTarget(tab.url);

      if (domain && !domain.includes('chrome://') && !domain.includes('chrome-extension://')) {
        currentDomain = domain;
        currentPath = path;
        currentDomainEl.textContent = `${domain}${path}`;

        // Offer the page-only option whenever we're below the site root.
        // At the root there's nothing to scope to, so it's domain-only.
        const canBlockPath = !!path;
        scopeSelector.classList.toggle('hidden', !canBlockPath);
        scopeDomainLabel.textContent = domain;
        scopePathLabel.textContent = path;
        setScope(canBlockPath ? currentScope : 'domain');

        // Check if already blocked
        const blockedSite = await FocusModeStorage.isUrlBlocked(tab.url);

        if (blockedSite) {
          currentSiteBlocked = blockedSite;
          quickAddContent.classList.add('hidden');
          alreadyBlocked.classList.remove('hidden');
          alreadyBlockedText.textContent = blockedSite.path
            ? 'This page is already blocked!'
            : 'This site is already blocked!';
          alreadyBlockedCategory.textContent =
            `${FocusModeStorage.formatBlockedSite(blockedSite)} · ${blockedSite.category}`;
        } else {
          currentSiteBlocked = null;
          quickAddContent.classList.remove('hidden');
          alreadyBlocked.classList.add('hidden');
          // Update button state now that we have the domain
          updateAddButtonState();
        }
      } else {
        currentDomainEl.textContent = 'Cannot block this page';
        scopeSelector.classList.add('hidden');
        addSiteBtn.disabled = true;
      }
    }
  } catch (error) {
    currentDomainEl.textContent = 'Unable to get current tab';
    scopeSelector.classList.add('hidden');
    addSiteBtn.disabled = true;
  }
}

// Pick whether quick-add blocks the whole domain or just the current page
function setScope(scope) {
  currentScope = scope === 'path' && currentPath ? 'path' : 'domain';

  scopeDomainBtn.classList.toggle('scope-btn-active', currentScope === 'domain');
  scopePathBtn.classList.toggle('scope-btn-active', currentScope === 'path');

  addSiteBtn.textContent = currentScope === 'path' ? 'Block this page' : 'Block this site';
  updateAddButtonState();
}

// What quick-add will block, e.g. "github.com" or "github.com/user/repo"
function getQuickAddTarget() {
  if (!currentDomain) return null;
  return currentScope === 'path' ? `${currentDomain}${currentPath}` : currentDomain;
}

// Handle add site button
async function handleAddSite() {
  if (!currentDomain) return;

  let category = categorySelect.value;

  // Handle new category
  if (category === '__new__') {
    const newCat = newCategoryInput.value.trim();
    if (!newCat) {
      showMessage('Please enter a category name', 'error');
      return;
    }

    try {
      await FocusModeStorage.addCategory(newCat);
      category = newCat;
    } catch (error) {
      showMessage(error.message, 'error');
      return;
    }
  }

  if (!category) {
    showMessage('Please select a category', 'error');
    return;
  }

  try {
    addSiteBtn.disabled = true;
    addSiteBtn.textContent = 'Adding...';

    const target = getQuickAddTarget();
    await FocusModeStorage.addBlockedSite(target, category);

    // Update UI
    showMessage(currentScope === 'path' ? 'Page blocked! 🎉' : 'Site blocked! 🎉', 'success');
    await loadCategories();
    await loadBlockedSites();

    // Show already blocked state
    quickAddContent.classList.add('hidden');
    alreadyBlocked.classList.remove('hidden');
    alreadyBlockedText.textContent = currentScope === 'path'
      ? 'This page is already blocked!'
      : 'This site is already blocked!';
    alreadyBlockedCategory.textContent = `${target} · ${category}`;

    // Notify background to update rules
    chrome.runtime.sendMessage({ action: 'updateRules' });

  } catch (error) {
    showMessage(error.message, 'error');
    addSiteBtn.disabled = false;
    addSiteBtn.textContent = currentScope === 'path' ? 'Block this page' : 'Block this site';
  }
}

// Show message
function showMessage(text, type) {
  addSiteMessage.textContent = text;
  addSiteMessage.classList.remove('hidden', 'text-red-500', 'text-green-500');
  addSiteMessage.classList.add(type === 'error' ? 'text-red-500' : 'text-green-500');

  setTimeout(() => {
    addSiteMessage.classList.add('hidden');
  }, 3000);
}

// Manual Add Tab Functions

// Handle manual category selection change
function handleManualCategoryChange() {
  const value = manualCategorySelect.value;

  if (value === '__new__') {
    manualNewCategoryContainer.classList.remove('hidden');
    manualNewCategoryInput.focus();
  } else {
    manualNewCategoryContainer.classList.add('hidden');
    manualNewCategoryInput.value = '';
  }

  updateManualAddButtonState();
}

// Update manual add button state
function updateManualAddButtonState() {
  const domain = manualDomainInput.value.trim();
  const category = manualCategorySelect.value;
  const isNewCategory = category === '__new__';
  const newCategoryName = manualNewCategoryInput.value.trim();

  // Enable button if we have a domain and either a selected category or a new category name
  manualAddSiteBtn.disabled = !domain || !category || (isNewCategory && !newCategoryName);
}

// Handle manual add site
async function handleManualAddSite() {
  const domain = manualDomainInput.value.trim();

  if (!domain) {
    showManualMessage('Please enter a domain', 'error');
    return;
  }

  let category = manualCategorySelect.value;

  // Handle new category
  if (category === '__new__') {
    const newCat = manualNewCategoryInput.value.trim();
    if (!newCat) {
      showManualMessage('Please enter a category name', 'error');
      return;
    }

    try {
      await FocusModeStorage.addCategory(newCat);
      category = newCat;
    } catch (error) {
      showManualMessage(error.message, 'error');
      return;
    }
  }

  if (!category) {
    showManualMessage('Please select a category', 'error');
    return;
  }

  try {
    manualAddSiteBtn.disabled = true;
    manualAddSiteBtn.textContent = 'Adding...';

    // addBlockedSite parses the input into a domain + optional path
    const { path } = FocusModeStorage.parseBlockTarget(domain);

    await FocusModeStorage.addBlockedSite(domain, category);

    // Update UI
    showManualMessage(path ? 'Page blocked! 🎉' : 'Site blocked! 🎉', 'success');
    await loadCategories();
    await loadBlockedSites();

    // Clear inputs
    manualDomainInput.value = '';
    manualCategorySelect.value = '';
    manualNewCategoryContainer.classList.add('hidden');
    manualNewCategoryInput.value = '';

    // Refresh current tab state in case same domain
    await loadCurrentTab();

    // Notify background to update rules
    chrome.runtime.sendMessage({ action: 'updateRules' });

  } catch (error) {
    showManualMessage(error.message, 'error');
  } finally {
    manualAddSiteBtn.disabled = false;
    manualAddSiteBtn.textContent = 'Block this site';
    updateManualAddButtonState();
  }
}

// Show message for manual add
function showManualMessage(text, type) {
  manualAddMessage.textContent = text;
  manualAddMessage.classList.remove('hidden', 'text-red-500', 'text-green-500');
  manualAddMessage.classList.add(type === 'error' ? 'text-red-500' : 'text-green-500');

  setTimeout(() => {
    manualAddMessage.classList.add('hidden');
  }, 3000);
}

// Load and display blocked sites
async function loadBlockedSites() {
  const grouped = await FocusModeStorage.getSitesGroupedByCategory();
  const sites = await FocusModeStorage.getBlockedSites();

  sitesCount.textContent = sites.length;

  if (sites.length === 0) {
    emptyState.classList.remove('hidden');
    sitesContainer.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  sitesContainer.classList.remove('hidden');
  sitesContainer.innerHTML = '';

  // Render grouped sites
  Object.entries(grouped).forEach(([category, categorySites]) => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'mb-2';
    categoryEl.innerHTML = `
      <div class="category-header" data-category="${category}">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-gray-400 transition-transform category-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
          <span>${category}</span>
          <span class="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">${categorySites.length}</span>
        </div>
      </div>
      <div class="category-sites pl-6 mt-1 space-y-1">
        ${categorySites.map(site => `
          <div class="site-item group" data-id="${site.id}">
            <span class="text-sm text-charcoal truncate" title="${escapeHtml(FocusModeStorage.formatBlockedSite(site))}">${escapeHtml(FocusModeStorage.formatBlockedSite(site))}</span>
            <button class="delete-site-btn opacity-0 group-hover:opacity-100 text-gray-400 hover:text-coral-500 transition-all p-1 rounded-lg hover:bg-coral-50" data-id="${site.id}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    `;

    sitesContainer.appendChild(categoryEl);
  });

  // Add event listeners for category headers (collapse/expand)
  document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', () => {
      const sites = header.nextElementSibling;
      const arrow = header.querySelector('.category-arrow');
      sites.classList.toggle('hidden');
      arrow.classList.toggle('rotate-180');
    });
  });

  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-site-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const siteId = btn.dataset.id;

      try {
        await FocusModeStorage.removeBlockedSite(siteId);
        await loadBlockedSites();
        await loadCurrentTab(); // Refresh current tab state

        // Notify background to update rules
        chrome.runtime.sendMessage({ action: 'updateRules' });
      } catch (error) {
        console.error('Error removing site:', error);
      }
    });
  });
}

// ============ Keyword Blocking ============

// Enable/disable the add-keyword button based on input
function updateAddKeywordButtonState() {
  addKeywordBtn.disabled = keywordInput.value.trim().length === 0;
}

// Handle add keyword button
async function handleAddKeyword() {
  const keyword = keywordInput.value.trim();

  if (!keyword) {
    showKeywordMessage('Please enter a keyword', 'error');
    return;
  }

  try {
    addKeywordBtn.disabled = true;
    addKeywordBtn.textContent = 'Adding...';

    await FocusModeStorage.addBlockedKeyword(keyword);

    showKeywordMessage('Keyword blocked! 🎉', 'success');
    keywordInput.value = '';
    await loadBlockedKeywords();
  } catch (error) {
    showKeywordMessage(error.message, 'error');
  } finally {
    addKeywordBtn.textContent = 'Block this keyword';
    updateAddKeywordButtonState();
  }
}

// Show message for keyword add
function showKeywordMessage(text, type) {
  keywordAddMessage.textContent = text;
  keywordAddMessage.classList.remove('hidden', 'text-red-500', 'text-green-500');
  keywordAddMessage.classList.add(type === 'error' ? 'text-red-500' : 'text-green-500');

  setTimeout(() => {
    keywordAddMessage.classList.add('hidden');
  }, 3000);
}

// Load and display blocked keywords
async function loadBlockedKeywords() {
  const keywords = await FocusModeStorage.getBlockedKeywords();

  keywordsCount.textContent = keywords.length;

  if (keywords.length === 0) {
    keywordsEmptyState.classList.remove('hidden');
    keywordsContainer.classList.add('hidden');
    return;
  }

  keywordsEmptyState.classList.add('hidden');
  keywordsContainer.classList.remove('hidden');

  keywordsContainer.innerHTML = keywords.map(k => `
    <div class="site-item group" data-id="${k.id}">
      <span class="text-sm text-charcoal truncate">"${escapeHtml(k.keyword)}"</span>
      <button class="delete-keyword-btn opacity-0 group-hover:opacity-100 text-gray-400 hover:text-coral-500 transition-all p-1 rounded-lg hover:bg-coral-50" data-id="${k.id}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');

  document.querySelectorAll('.delete-keyword-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await FocusModeStorage.removeBlockedKeyword(btn.dataset.id);
        await loadBlockedKeywords();
      } catch (error) {
        console.error('Error removing keyword:', error);
      }
    });
  });
}

// Escape user-provided text before inserting into innerHTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ Stats View ============

// DOM Elements - Stats
const mainView = document.getElementById('mainView');
const statsView = document.getElementById('statsView');
const statsLink = document.getElementById('statsLink');
const statsBackBtn = document.getElementById('statsBackBtn');
const statsTabs = document.querySelectorAll('.stats-tab');
const statsTotalNumber = document.getElementById('statsTotalNumber');
const statsEncouragement = document.getElementById('statsEncouragement');
const statsTrendChart = document.getElementById('statsTrendChart');
const statsTrendLabels = document.getElementById('statsTrendLabels');
const statsCategoryList = document.getElementById('statsCategoryList');
const statsNoCategoryData = document.getElementById('statsNoCategoryData');
const statsTopSitesList = document.getElementById('statsTopSitesList');
const statsNoSitesData = document.getElementById('statsNoSitesData');

// Stats state
let currentStatsPeriod = 'day';

// Initialize stats event listeners
statsLink.addEventListener('click', showStatsView);
statsBackBtn.addEventListener('click', hideStatsView);

statsTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const period = tab.dataset.period;
    switchStatsPeriod(period);
  });
});

// Show stats view
async function showStatsView() {
  mainView.classList.add('hidden');
  statsView.classList.remove('hidden');
  await loadStatsData(currentStatsPeriod);
}

// Hide stats view
function hideStatsView() {
  statsView.classList.add('hidden');
  mainView.classList.remove('hidden');
}

// Switch stats period
async function switchStatsPeriod(period) {
  currentStatsPeriod = period;

  // Update tab styles
  statsTabs.forEach(tab => {
    if (tab.dataset.period === period) {
      tab.classList.add('stats-tab-active');
    } else {
      tab.classList.remove('stats-tab-active');
    }
  });

  await loadStatsData(period);
}

// Load and display stats data
async function loadStatsData(period) {
  const stats = await FocusModeStorage.getStatsForPeriod(period);

  // Update total number
  statsTotalNumber.textContent = stats.total;

  // Update encouragement message
  statsEncouragement.textContent = getEncouragementMessage(stats.total);

  // Render trend chart
  renderTrendChart(stats.trend);

  // Render category breakdown
  renderCategoryBreakdown(stats.byCategory, stats.total);

  // Render top sites
  renderTopSites(stats.topSites);
}

// Get encouragement message based on block count
function getEncouragementMessage(count) {
  if (count === 0) return 'Start blocking to see your stats!';
  if (count < 5) return 'Good start! Keep it up! 🌱';
  if (count < 20) return 'Great progress! You\'re building focus! 💪';
  if (count < 50) return 'Amazing! You\'re a focus champion! 🏆';
  if (count < 100) return 'Incredible discipline! Keep crushing it! 🔥';
  return 'Legendary focus! You\'re unstoppable! 🚀';
}

// Render trend chart
function renderTrendChart(trend) {
  if (!trend || trend.length === 0) {
    statsTrendChart.innerHTML = '<div class="text-center text-gray-400 text-xs py-4 w-full">No data yet</div>';
    statsTrendLabels.innerHTML = '';
    return;
  }

  const maxCount = Math.max(...trend.map(t => t.count), 1);
  const trendCount = trend.length;

  // Set CSS variable for grid column count
  const container = statsTrendChart.closest('.stats-trend-container');
  if (container) {
    container.style.setProperty('--trend-count', trendCount);
  }

  // Render bars
  statsTrendChart.innerHTML = trend.map(t => {
    const heightPercent = (t.count / maxCount) * 100;
    const isEmpty = t.count === 0;
    return `<div class="stats-bar ${isEmpty ? 'stats-bar-empty' : ''}" style="height: ${Math.max(heightPercent, 8)}%" title="${t.label}: ${t.count}"></div>`;
  }).join('');

  // Determine which labels to show (to avoid crowding)
  let visibleIndices = new Set();

  if (trendCount <= 7) {
    // Show all labels for small sets (week view)
    for (let i = 0; i < trendCount; i++) visibleIndices.add(i);
  } else {
    // For larger sets, show 5 evenly distributed labels
    const step = Math.max(1, Math.floor((trendCount - 1) / 4));
    visibleIndices.add(0);
    for (let i = step; i < trendCount - 1; i += step) {
      if (visibleIndices.size < 4) visibleIndices.add(i);
    }
    visibleIndices.add(trendCount - 1);
  }

  // Render ALL label slots (one per bar) but only show text for visible ones
  // This keeps labels aligned with their corresponding bars
  statsTrendLabels.innerHTML = trend.map((t, i) =>
    `<span class="text-center">${visibleIndices.has(i) ? t.label : ''}</span>`
  ).join('');
}

// Render category breakdown
function renderCategoryBreakdown(byCategory, total) {
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (categories.length === 0) {
    statsCategoryList.classList.add('hidden');
    statsNoCategoryData.classList.remove('hidden');
    return;
  }

  statsNoCategoryData.classList.add('hidden');
  statsCategoryList.classList.remove('hidden');

  const maxCount = Math.max(...categories.map(c => c[1]), 1);

  statsCategoryList.innerHTML = categories.map(([category, count]) => {
    const barWidth = Math.max((count / maxCount) * 100, 4);

    return `
      <div class="stats-category-item">
        <div class="stats-category-meta">
          <span class="stats-category-name">${category}</span>
          <span class="stats-category-count">${count}</span>
        </div>
        <div class="stats-category-bar-wrap">
          <div class="stats-category-bar">
            <div class="stats-category-bar-fill" style="width: ${barWidth}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render top sites
function renderTopSites(topSites) {
  if (!topSites || topSites.length === 0) {
    statsTopSitesList.classList.add('hidden');
    statsNoSitesData.classList.remove('hidden');
    return;
  }

  statsNoSitesData.classList.add('hidden');
  statsTopSitesList.classList.remove('hidden');

  statsTopSitesList.innerHTML = topSites.map((site, index) => {
    const rank = index + 1;
    let rankClass = 'stats-site-rank-default';
    if (rank === 1) rankClass = 'stats-site-rank-1';
    else if (rank === 2) rankClass = 'stats-site-rank-2';
    else if (rank === 3) rankClass = 'stats-site-rank-3';

    return `
      <div class="stats-site-item">
        <div class="flex items-center">
          <span class="stats-site-rank ${rankClass}">${rank}</span>
          <span class="text-charcoal truncate" title="${escapeHtml(site.domain)}">${escapeHtml(site.domain)}</span>
        </div>
        <span class="text-gray-500 text-sm font-medium">${site.count}</span>
      </div>
    `;
  }).join('');
}

