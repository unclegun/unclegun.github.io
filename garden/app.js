/**
 * Community Garden - Main Application
 * Orchestrates UI, state, networking, and rendering
 */

// App state
const appState = {
  manifest: null,
  allUserGardens: {}, // { userId: garden }
  currentUserId: null,
  selectedTile: null, // { tileX, tileY }
  selectedPlantId: null,
  etagsByUser: {}, // { userId: etag }
  waterActionsToday: [], // timestamps of successful waters today
  lastRainDay: -1
};

// DOM elements
let gardenContainer;
let gardenSvg;
let sidebarDiv;

/**
 * Initialize the app on page load
 */
async function init() {
  console.log('🌱 Initializing Community Garden...');

  try {
    // Restore user from localStorage
    appState.currentUserId = localStorage.getItem('gardenUserId');

    // Initialize DOM
    initDOM();

    // Load manifest
    appState.manifest = await window.Net.fetchManifest();
    console.log('📋 Manifest loaded:', appState.manifest);

    if (!appState.manifest || !appState.manifest.plots || appState.manifest.plots.length === 0) {
      throw new Error('No plots found in manifest');
    }

    // Load all user gardens
    const userIds = appState.manifest.plots.map(p => p.userId);
    const { gardens, etags } = await window.Net.loadAllUserGardens(userIds);
    appState.allUserGardens = gardens;
    appState.etagsByUser = etags;
    console.log('🌿 User gardens loaded:', Object.keys(gardens).length, 'users');

    // Rebuild UI
    populateUserDropdown();
    render();

    // Remove loading message
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) loadingMsg.remove();

    // Apply daily rain if applicable
    if (appState.currentUserId && appState.allUserGardens[appState.currentUserId]) {
      applyDailyRain();
    }

    console.log('✅ Garden ready!');
  } catch (err) {
    console.error('❌ Initialization error:', err);
    const main = document.querySelector('main');
    main.innerHTML = `<div style="padding: 40px; color: #ff6b6b; font-size: 1.2rem; text-align: center;">
      <p>⚠️ Error loading garden</p>
      <p style="font-size: 0.9rem; color: #e8c89f;">Check console (F12) for details</p>
      <pre style="text-align: left; background: #1a1a1a; padding: 15px; border-radius: 4px; color: #00ff00; overflow-x: auto;">${err.message}</pre>
    </div>`;
  }
}

/**
 * Initialize DOM elements
 */
function initDOM() {
  const main = document.querySelector('main');
  let container = document.querySelector('.container');

  if (!container) {
    container = document.createElement('div');
    container.className = 'container';
    main.appendChild(container);
  }

  // Garden container
  gardenContainer = document.querySelector('.garden-container') || document.createElement('div');
  gardenContainer.className = 'garden-container';
  if (!gardenContainer.parentElement) container.appendChild(gardenContainer);

  // Sidebar
  sidebarDiv = document.querySelector('.sidebar') || document.createElement('div');
  sidebarDiv.className = 'sidebar';
  if (!sidebarDiv.parentElement) container.appendChild(sidebarDiv);
}

/**
 * Render the entire UI
 */
function render() {
  renderGarden();
  renderSidebar();
}

/**
 * Render the garden SVG
 */
function renderGarden() {
  const now = Date.now();

  // Create SVG
  gardenSvg = window.Render.renderGardenSVG(
    appState.manifest,
    appState.allUserGardens,
    appState.currentUserId,
    appState.selectedPlantId ? { plantId: appState.selectedPlantId } : appState.selectedTile,
    now
  );

  gardenSvg.addEventListener('click', (e) => handleGardenClick(e, now));

  // Clear and replace
  gardenContainer.innerHTML = '';
  gardenContainer.appendChild(gardenSvg);
}

/**
 * Handle garden SVG click
 */
function handleGardenClick(e, now) {
  const target = e.target.closest('[data-x][data-y], [data-plant-id]');
  if (!target) return;

  // Check if it's a plant
  const plantId = target.getAttribute('data-plant-id');
  if (plantId) {
    selectPlant(plantId);
    return;
  }

  // It's a tile
  const x = parseInt(target.getAttribute('data-x'));
  const y = parseInt(target.getAttribute('data-y'));
  selectTile(x, y);
}

/**
 * Select a tile
 */
function selectTile(x, y) {
  appState.selectedTile = { tileX: x, tileY: y };
  appState.selectedPlantId = null;
  render();
}

/**
 * Select a plant
 */
function selectPlant(plantId) {
  // Find the plant to verify it exists
  let found = false;
  for (const userId in appState.allUserGardens) {
    if (appState.allUserGardens[userId].plants.some(p => p.id === plantId)) {
      found = true;
      break;
    }
  }

  if (found) {
    appState.selectedPlantId = plantId;
    appState.selectedTile = null;
    render();
  }
}

/**
 * Render sidebar with user selection and action panel
 */
function renderSidebar() {
  const now = Date.now();
  let html = '<h2>🌿 Garden</h2>';

  // User section
  html += '<div class="user-section">';
  html += '<h3>Select Your Plot</h3>';

  // Dropdown
  html += '<select class="user-dropdown" id="userDropdown">';
  html += '<option value="">-- Choose a user --</option>';
  appState.manifest.plots.forEach(plot => {
    const selected = plot.userId === appState.currentUserId ? 'selected' : '';
    html += `<option value="${plot.userId}" ${selected}>${plot.name}</option>`;
  });
  html += '</select>';

  // Add user form
  html += '<div class="user-add-section">';
  html += '<input class="user-input" id="newUserName" placeholder="Your name" />';
  html += '<button class="user-add-btn" id="addUserBtn">Add</button>';
  html += '</div>';

  if (appState.currentUserId) {
    html += `<div class="user-info">✓ Logged in as <strong>${getDisplayName(appState.currentUserId)}</strong></div>`;
  } else {
    html += '<div class="user-info">Select or create a user to begin.</div>';
  }

  html += '</div>';

  // Info section
  if (appState.selectedPlantId) {
    const plant = findPlantById(appState.selectedPlantId);
    if (plant) {
      html += renderPlantInfo(plant, appState.currentUserId, now);
    }
  } else if (appState.selectedTile) {
    html += renderTileInfo(appState.selectedTile, now);
  } else {
    html += '<div class="tile-info empty">Click a tile or plant to select.</div>';
  }

  sidebarDiv.innerHTML = html;

  // Attach event listeners
  document.getElementById('userDropdown').addEventListener('change', (e) => {
    changeUser(e.target.value);
  });

  document.getElementById('addUserBtn').addEventListener('click', addUser);
  document.getElementById('newUserName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addUser();
  });
}

/**
 * Render plant info panel
 */
function renderPlantInfo(plant, currentUserId, now) {
  const stage = window.State.deriveStage(plant, now);
  const genes = plant.genes;
  const archetype = window.Genes.ARCHETYPES[genes.archetype];
  const palette = window.Genes.PALETTES[genes.palette];
  const pattern = window.Genes.PATTERNS[genes.pattern];
  const isOwner = plant.id.startsWith(currentUserId + '_');

  let html = '<div class="plant-info">';
  html += `<strong>${archetype.toUpperCase()}</strong>`;
  html += `<div class="plant-stat"><span class="label">Age:</span><span class="value">${formatAge(plant.plantedAt, now)}</span></div>`;
  html += `<div class="plant-stat"><span class="label">Growth Stage:</span><span class="value">${stage} / 3</span></div>`;
  html += `<div class="plant-stat"><span class="label">Waterings:</span><span class="value">${plant.watered}</span></div>`;

  if (isOwner) {
    html += '<hr style="border: none; border-top: 1px solid #6b5344; margin: 10px 0;">';

    const canWater = window.State.canWaterPlant(plant, now);
    if (canWater) {
      html += '<button id="waterBtn" class="primary">💧 Water Plant</button>';
      html += '<p class="hint">Watering helps your plant grow faster and look more lush!</p>';
    } else {
      const remaining = window.State.getWaterCooldownRemaining(plant, now);
      const timeStr = formatTime(remaining);
      html += `<div class="cooldown-timer">⏳ Water again in ${timeStr}</div>`;
      html += '<p class="hint">Plants need time between waterings.</p>';
    }
  } else {
    html += `<div class="hint">This is ${getDisplayName(plant.id.split('_')[0])}'s plant. Read-only.</div>`;
  }

  html += '</div>';

  // Check device-level rate limit
  cleanupWaterActionsToday();
  const actionsRemaining = window.State.MAX_WATERS_PER_DAY - appState.waterActionsToday.length;
  if (actionsRemaining <= 1) {
    html += `<div class="message warning">⚠️ You have ${actionsRemaining} water action(s) left today.</div>`;
  }

  return html;
}

/**
 * Render tile info panel
 */
function renderTileInfo(tile, now) {
  const plant = window.State.getPlantAt(appState.allUserGardens, tile.tileX, tile.tileY);

  let html = '';
  if (plant) {
    return renderPlantInfo(plant, appState.currentUserId, now);
  }

  // Empty tile
  const isInMyPlot =
    appState.currentUserId &&
    window.State.isTileInUserPlot(appState.currentUserId, tile.tileX, tile.tileY, appState.manifest);

  html += '<div class="tile-info">';
  html += `<strong>Tile (${tile.tileX}, ${tile.tileY})</strong>`;
  if (isInMyPlot) {
    html += '<p>Empty. Ready to plant!</p>';
    html += '<button id="plantBtn" class="primary">🌱 Plant Seed</button>';
  } else {
    const plotUserId = findPlotAtTile(tile.tileX, tile.tileY);
    if (plotUserId) {
      html += `<p>This tile is in ${getDisplayName(plotUserId)}'s plot.</p>`;
    } else {
      html += '<p>This tile is outside all plots.</p>';
    }
  }
  html += '</div>';

  return html;
}

/**
 * Find which user's plot contains a tile (or null)
 */
function findPlotAtTile(x, y) {
  for (const plot of appState.manifest.plots) {
    if (window.State.isTileInUserPlot(plot.userId, x, y, appState.manifest)) {
      return plot.userId;
    }
  }
  return null;
}

/**
 * Get display name for a userId
 */
function getDisplayName(userId) {
  const local = JSON.parse(localStorage.getItem('gardenUsers') || '{}');
  if (local[userId]) return local[userId].name;

  const plot = appState.manifest.plots.find(p => p.userId === userId);
  return plot ? plot.name : userId;
}

/**
 * Plant seed at selected tile
 */
function plantSeed() {
  if (!appState.selectedTile || !appState.currentUserId) return;

  const now = Date.now();
  const { tileX, tileY } = appState.selectedTile;

  // Check if in user's plot
  if (!window.State.isTileInUserPlot(appState.currentUserId, tileX, tileY, appState.manifest)) {
    return;
  }

  // Check if already occupied
  if (window.State.getPlantAt(appState.allUserGardens, tileX, tileY)) {
    return;
  }

  // Generate PRNG with stable seed
  const seed = window.PRNG.generateSeedFromUser(appState.currentUserId, Date.now());
  const rng = window.PRNG.createPRNG(seed);

  // Plant
  const ug = appState.allUserGardens[appState.currentUserId];
  const newUg = window.State.plantAt(ug, tileX, tileY, now, rng);

  // Save
  appState.allUserGardens[appState.currentUserId] = newUg;
  saveUserGarden(appState.currentUserId);

  // Clear selection + re-render
  appState.selectedTile = null;
  appState.selectedPlantId = null;
  render();
}

/**
 * Water the selected plant
 */
function waterPlant() {
  if (!appState.selectedPlantId || !appState.currentUserId) return;

  const now = Date.now();

  // Find plant
  const plant = findPlantById(appState.selectedPlantId);
  if (!plant) return;

  // Check if owner
  if (!plant.id.startsWith(appState.currentUserId + '_')) return;

  // Check device-level rate limit
  cleanupWaterActionsToday();
  if (appState.waterActionsToday.length >= window.State.MAX_WATERS_PER_DAY) {
    return; // silently ignore
  }

  // Check cooldown
  if (!window.State.canWaterPlant(plant, now)) {
    return; // silently ignore
  }

  // Water
  const ug = appState.allUserGardens[appState.currentUserId];
  const newUg = window.State.waterPlant(ug, appState.selectedPlantId, now);

  // Update app state
  appState.allUserGardens[appState.currentUserId] = newUg;
  appState.waterActionsToday.push(now);
  saveWaterActionsToday();

  // Save to server
  saveUserGarden(appState.currentUserId);

  // Re-render
  render();
}

/**
 * Save user garden to server
 */
async function saveUserGarden(userId) {
  const data = appState.allUserGardens[userId];
  if (!data) return;

  const etag = appState.etagsByUser[userId] || null;
  const result = await window.Net.saveUserGardenWithMerge(userId, data, etag);

  if (result.success) {
    appState.etagsByUser[userId] = result.etag;
    // Reload to sync
    const { data: latest, etag: newEtag } = await window.Net.fetchUserGarden(userId);
    if (latest) {
      appState.allUserGardens[userId] = latest;
      appState.etagsByUser[userId] = newEtag;
    }
    render();
  }
}

/**
 * Change current user
 */
function changeUser(userId) {
  appState.currentUserId = userId;
  localStorage.setItem('gardenUserId', userId);

  // Ensure user garden exists
  if (userId && !appState.allUserGardens[userId]) {
    appState.allUserGardens[userId] = {
      version: 1,
      userId,
      updatedAt: Date.now(),
      plants: []
    };
  }

  // Apply daily rain
  if (userId && appState.allUserGardens[userId]) {
    applyDailyRain();
  }

  appState.selectedTile = null;
  appState.selectedPlantId = null;
  render();
}

/**
 * Add a new user locally
 */
function addUser() {
  const nameInput = document.getElementById('newUserName');
  const name = nameInput.value.trim();

  if (!name) return;

  // Generate userId slug
  const userId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  // Store in localStorage
  const local = JSON.parse(localStorage.getItem('gardenUsers') || '{}');
  local[userId] = { name };
  localStorage.setItem('gardenUsers', JSON.stringify(local));

  // Create empty garden
  appState.allUserGardens[userId] = {
    version: 1,
    userId,
    updatedAt: Date.now(),
    plants: []
  };

  // Switch to this user
  changeUser(userId);

  // Clear input
  nameInput.value = '';
}

/**
 * Populate user dropdown from manifest + localStorage
 */
function populateUserDropdown() {
  // Ensure all users have gardens
  appState.manifest.plots.forEach(plot => {
    if (!appState.allUserGardens[plot.userId]) {
      appState.allUserGardens[plot.userId] = {
        version: 1,
        userId: plot.userId,
        updatedAt: Date.now(),
        plants: []
      };
    }
  });

  // Local users
  const local = JSON.parse(localStorage.getItem('gardenUsers') || '{}');
  Object.keys(local).forEach(userId => {
    if (!appState.allUserGardens[userId]) {
      appState.allUserGardens[userId] = {
        version: 1,
        userId,
        updatedAt: Date.now(),
        plants: []
      };
    }
  });
}

/**
 * Apply daily "light rain" to one plant
 */
function applyDailyRain() {
  const ug = appState.allUserGardens[appState.currentUserId];
  if (!ug) return;

  const newUg = window.State.applyDailyRain(ug, Date.now());
  if (newUg !== ug) {
    appState.allUserGardens[appState.currentUserId] = newUg;
    saveUserGarden(appState.currentUserId);
  }
}

/**
 * Find a plant by ID anywhere in the gardens
 */
function findPlantById(plantId) {
  for (const userId in appState.allUserGardens) {
    const ug = appState.allUserGardens[userId];
    const plant = ug.plants.find(p => p.id === plantId);
    if (plant) return plant;
  }
  return null;
}

/**
 * Format age in human-readable form
 */
function formatAge(plantedAtMs, nowMs) {
  const ageMs = nowMs - plantedAtMs;
  const ageDays = ageMs / 86400000;

  if (ageDays < 1) {
    const hours = Math.floor(ageDays * 24);
    return hours + 'h';
  }
  return Math.floor(ageDays) + 'd';
}

/**
 * Format time duration
 */
function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);

  if (hours > 0) {
    return hours + 'h ' + minutes + 'm';
  }
  return minutes + 'm';
}

/**
 * Cleanup old water actions (older than 24 hours)
 */
function cleanupWaterActionsToday() {
  const now = Date.now();
  const oneDayAgo = now - 86400000;
  appState.waterActionsToday = appState.waterActionsToday.filter(t => t > oneDayAgo);
  saveWaterActionsToday();
}

/**
 * Save water actions to localStorage
 */
function saveWaterActionsToday() {
  localStorage.setItem('gardenWaterActions', JSON.stringify(appState.waterActionsToday));
}

/**
 * Load water actions from localStorage
 */
function loadWaterActionsToday() {
  appState.waterActionsToday = JSON.parse(
    localStorage.getItem('gardenWaterActions') || '[]'
  );
  cleanupWaterActionsToday();
}

// Start on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadWaterActionsToday();
    init();
  });
} else {
  loadWaterActionsToday();
  init();
}

// Event delegation for sidebar buttons & dropdowns
document.addEventListener('click', (e) => {
  if (e.target.id === 'plantBtn') {
    plantSeed();
  } else if (e.target.id === 'waterBtn') {
    waterPlant();
  } else if (e.target.id === 'addUserBtn') {
    addUser();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'userDropdown') {
    changeUser(e.target.value);
  }
});

document.addEventListener('keypress', (e) => {
  if (e.target.id === 'newUserName' && e.key === 'Enter') {
    addUser();
  }
});
