// Popup script for Focus Mode extension

// DOM Elements - Header
const focusToggle = document.getElementById('focusToggle');
const focusStatus = document.getElementById('focusStatus');
const confettiContainer = document.getElementById('confettiContainer');

// DOM Elements - Tabs
const tabCurrentSite = document.getElementById('tabCurrentSite');
const tabManualAdd = document.getElementById('tabManualAdd');
const currentSiteTab = document.getElementById('currentSiteTab');
const manualAddTab = document.getElementById('manualAddTab');

// DOM Elements - Current Site Tab
const currentDomainEl = document.getElementById('currentDomain');
const categorySelect = document.getElementById('categorySelect');
const newCategoryContainer = document.getElementById('newCategoryContainer');
const newCategoryInput = document.getElementById('newCategoryInput');
const addSiteBtn = document.getElementById('addSiteBtn');
const addSiteMessage = document.getElementById('addSiteMessage');
const quickAddContent = document.getElementById('quickAddContent');
const alreadyBlocked = document.getElementById('alreadyBlocked');
const alreadyBlockedCategory = document.getElementById('alreadyBlockedCategory');

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

// State
let currentDomain = null;
let currentSiteBlocked = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await FocusModeStorage.initializeStorage();
  await loadFocusMode();
  await loadCategories();
  await loadCurrentTab();
  await loadBlockedSites();

  // Set up event listeners - Header
  focusToggle.addEventListener('click', handleToggleFocus);

  // Set up event listeners - Tabs
  tabCurrentSite.addEventListener('click', () => switchTab('current'));
  tabManualAdd.addEventListener('click', () => switchTab('manual'));

  // Set up event listeners - Current Site Tab
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
  if (tab === 'current') {
    tabCurrentSite.classList.add('tab-active');
    tabCurrentSite.classList.remove('text-gray-400');
    tabManualAdd.classList.remove('tab-active');
    tabManualAdd.classList.add('text-gray-400');
    currentSiteTab.classList.remove('hidden');
    manualAddTab.classList.add('hidden');
  } else {
    tabManualAdd.classList.add('tab-active');
    tabManualAdd.classList.remove('text-gray-400');
    tabCurrentSite.classList.remove('tab-active');
    tabCurrentSite.classList.add('text-gray-400');
    manualAddTab.classList.remove('hidden');
    currentSiteTab.classList.add('hidden');
  }
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

// Get current tab domain
async function loadCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab && tab.url) {
      const domain = FocusModeStorage.extractDomain(tab.url);

      if (domain && !domain.includes('chrome://') && !domain.includes('chrome-extension://')) {
        currentDomain = domain;
        currentDomainEl.textContent = domain;

        // Check if already blocked
        const blockedSite = await FocusModeStorage.isUrlBlocked(tab.url);

        if (blockedSite) {
          currentSiteBlocked = blockedSite;
          quickAddContent.classList.add('hidden');
          alreadyBlocked.classList.remove('hidden');
          alreadyBlockedCategory.textContent = `Category: ${blockedSite.category}`;
        } else {
          quickAddContent.classList.remove('hidden');
          alreadyBlocked.classList.add('hidden');
          // Update button state now that we have the domain
          updateAddButtonState();
        }
      } else {
        currentDomainEl.textContent = 'Cannot block this page';
        addSiteBtn.disabled = true;
      }
    }
  } catch (error) {
    currentDomainEl.textContent = 'Unable to get current tab';
    addSiteBtn.disabled = true;
  }
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

    await FocusModeStorage.addBlockedSite(currentDomain, category);

    // Update UI
    showMessage('Site blocked! 🎉', 'success');
    await loadCategories();
    await loadBlockedSites();

    // Show already blocked state
    quickAddContent.classList.add('hidden');
    alreadyBlocked.classList.remove('hidden');
    alreadyBlockedCategory.textContent = `Category: ${category}`;

    // Notify background to update rules
    chrome.runtime.sendMessage({ action: 'updateRules' });

  } catch (error) {
    showMessage(error.message, 'error');
    addSiteBtn.disabled = false;
    addSiteBtn.textContent = 'Block this site';
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

    // Normalize the domain
    const normalizedDomain = FocusModeStorage.normalizeDomain(domain);

    await FocusModeStorage.addBlockedSite(normalizedDomain, category);

    // Update UI
    showManualMessage('Site blocked! 🎉', 'success');
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
            <span class="text-sm text-charcoal truncate">${site.domain}</span>
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

