/**
 * Community Garden - Main Application
 * Orchestrates UI, state, networking, and rendering using GitHub Issue Form for persistence
 */

// App state
const appState = {
  gardens: [], // Array of { id, name }
  currentGardenId: 'main',
  manifest: null,
  allUserGardens: {}, // { userId: garden }
  currentUserId: null,
  selectedTile: null, // { tileX, tileY }
  selectedPlantId: null,
  waterActionsToday: [], // timestamps of successful waters today
  lastRainDay: -1,
  pendingOps: [] // [ { type: 'plant'|'water', x, y, plantId } ]
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
    // Load gardens and set current
    const gardensData = await window.Net.loadGardens();
    appState.gardens = gardensData.gardens;
    
    // Restore garden from localStorage if available
    const savedGardenId = localStorage.getItem('gardenSelected');
    if (savedGardenId && appState.gardens.some(g => g.id === savedGardenId)) {
      appState.currentGardenId = savedGardenId;
    }

    // Restore user from localStorage
    appState.currentUserId = localStorage.getItem(`gardenUserId_${appState.currentGardenId}`);

    // Initialize DOM
    initDOM();

    // Load manifest for current garden
    appState.manifest = await window.Net.fetchManifest(appState.currentGardenId);
    console.log('📋 Manifest loaded:', appState.manifest);

    if (!appState.manifest || !appState.manifest.plots || appState.manifest.plots.length === 0) {
      throw new Error('No plots found in manifest');
    }

    // Load all user gardens
    const userIds = appState.manifest.plots.map(p => p.userId);
    const { gardens } = await window.Net.loadAllUserGardens(appState.currentGardenId, userIds);
    appState.allUserGardens = gardens;
    console.log('🌿 User gardens loaded:', Object.keys(gardens).length, 'users');

    // Rebuild UI
    populateGardenDropdown();
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
    const appDiv = document.getElementById('garden-app');
    appDiv.innerHTML = `<div class="alert alert-danger m-4" role="alert">
      <h4 class="alert-heading">⚠️ Error Loading Garden</h4>
      <p>${err.message}</p>
      <hr>
      <p class="mb-0" style="font-size: 0.9rem;">Check console (F12) for details</p>
    </div>`;
  }
}

/**
 * Initialize DOM elements
 */
function initDOM() {
  const appDiv = document.getElementById('garden-app');
  
  // Create Bootstrap grid layout
  let container = document.querySelector('.garden-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'container-lg py-4';
    appDiv.appendChild(container);
    
    const row = document.createElement('div');
    row.className = 'row g-3';
    container.appendChild(row);
    
    // Left column: Garden
    const leftCol = document.createElement('div');
    leftCol.className = 'col-lg-8';
    row.appendChild(leftCol);
    
    gardenContainer = document.createElement('div');
    gardenContainer.className = 'card h-100';
    gardenContainer.style.background = 'linear-gradient(135deg, #3a5a40 0%, #2d4a35 100%)';
    gardenContainer.style.border = '3px solid #8b7355';
    gardenContainer.style.borderRadius = '8px';
    gardenContainer.innerHTML = '<div class="card-body p-3" style="overflow: auto; max-height: 500px;"></div>';
    leftCol.appendChild(gardenContainer);
    
    // Right column: Sidebar
    const rightCol = document.createElement('div');
    rightCol.className = 'col-lg-4';
    row.appendChild(rightCol);
    
    sidebarDiv = document.createElement('div');
    sidebarDiv.className = 'card h-100 sticky-lg-top';
    sidebarDiv.style.background = 'linear-gradient(135deg, #3a5a40 0%, #2d4a35 100%)';
    sidebarDiv.style.border = '3px solid #8b7355';
    sidebarDiv.style.borderRadius = '8px';
    rightCol.appendChild(sidebarDiv);
  }
}

/**
 * Populate garden dropdown
 */
function populateGardenDropdown() {
  let gardenSelect = document.getElementById('gardenDropdown');
  if (!gardenSelect) return;
  
  gardenSelect.innerHTML = '';
  appState.gardens.forEach(garden => {
    const option = document.createElement('option');
    option.value = garden.id;
    option.textContent = garden.name;
    option.selected = garden.id === appState.currentGardenId;
    gardenSelect.appendChild(option);
  });
}

/**
 * Populate user dropdown
 */
function populateUserDropdown() {
  let userSelect = document.getElementById('userDropdown');
  if (!userSelect) return;
  
  userSelect.innerHTML = '<option value="">-- Choose a user --</option>';
  if (appState.manifest && appState.manifest.plots) {
    appState.manifest.plots.forEach(plot => {
      const option = document.createElement('option');
      option.value = plot.userId;
      option.textContent = plot.name;
      option.selected = plot.userId === appState.currentUserId;
      userSelect.appendChild(option);
    });
  }
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
  const cardBody = gardenContainer.querySelector('.card-body');
  if (cardBody) {
    cardBody.innerHTML = '';
    cardBody.appendChild(gardenSvg);
  }
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
  let html = '<div class="card-body">';
  html += '<h5 class="card-title" style="color: #ffd700;">🌱 Controls</h5>';

  // Garden section - main garden only, no creation
  html += '<div class="mb-3">';
  html += '<label class="form-label" style="color: #e8c89f;">Garden</label>';
  html += '<div class="form-control form-control-sm" style="background: #2d3a2d; color: #e8c89f; border-color: #8b7355;">Main Garden</div>';
  html += '</div>';

  // User section
  html += '<div class="mb-3">';
  html += '<label for="userDropdown" class="form-label" style="color: #e8c89f;">Your Plot</label>';
  html += '<div class="input-group input-group-sm">';
  html += '<select class="form-select form-select-sm" id="userDropdown" style="background: #2d3a2d; color: #e8c89f; border-color: #8b7355;">';
  html += '<option value="">-- Choose a user --</option>';
  if (appState.manifest && appState.manifest.plots) {
    appState.manifest.plots.forEach(plot => {
      const selected = plot.userId === appState.currentUserId ? 'selected' : '';
      html += `<option value="${plot.userId}" ${selected}>${plot.name}</option>`;
    });
  }
  html += '</select>';
  html += '<button class="btn btn-sm btn-outline-light" id="addUserBtn" title="Add User"><strong>+</strong></button>';
  html += '</div>';
  html += '</div>';

  // Tile/plant info
  html += '<div class="mb-3 p-2" style="background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid #8b7355;">';
  
  if (appState.selectedPlantId) {
    const plantInfo = getSelectedPlantInfo();
    if (plantInfo) {
      html += renderPlantInfo(plantInfo, now);
    } else {
      html += '<p style="color: #e8c89f; font-size: 0.9rem;">Plant not found</p>';
    }
  } else if (appState.selectedTile) {
    html += renderTileInfo(appState.selectedTile);
  } else {
    html += '<p style="color: #c9a961; font-size: 0.9rem;">Click a tile or plant to select</p>';
  }

  html += '</div>';

  // Pending operations
  if (appState.pendingOps.length > 0) {
    html += '<div class="mb-3 p-2" style="background: rgba(255,215,0,0.1); border-radius: 4px; border: 1px solid #ffd700;">';
    html += '<p style="color: #ffd700; font-weight: bold; font-size: 0.9rem; margin-bottom: 8px;">📋 Pending Changes:</p>';
    appState.pendingOps.forEach(op => {
      if (op.type === 'plant') {
        html += `<small style="color: #e8c89f; display: block;">🌱 Plant at (${op.x}, ${op.y})</small>`;
      } else if (op.type === 'water') {
        html += `<small style="color: #e8c89f; display: block;">💧 Water ${op.plantId}</small>`;
      }
    });
    html += '</div>';
  }

  // Action buttons
  html += '<div class="d-grid gap-2">';
  
  if (appState.pendingOps.length > 0) {
    html += '<button class="btn btn-warning btn-sm" id="saveBtn" style="background-color: #ffd700; color: #2d3a2d; border: none; font-weight: bold;">💾 Save to GitHub</button>';
    html += '<button class="btn btn-outline-light btn-sm" id="clearBtn">Clear</button>';
  } else {
    html += '<button class="btn btn-outline-light btn-sm" disabled>No changes</button>';
  }
  
  html += '</div>';

  html += '</div>';
  
  sidebarDiv.innerHTML = html;

  // Event listeners
  document.getElementById('userDropdown')?.addEventListener('change', (e) => changeUser(e.target.value));
  document.getElementById('addUserBtn')?.addEventListener('click', showAddUserModal);
  const plantBtn = document.getElementById('plantBtn');
  if (plantBtn) plantBtn.addEventListener('click', plantSeed);
  const waterBtn = document.getElementById('waterBtn');
  if (waterBtn) waterBtn.addEventListener('click', waterPlant);
  document.getElementById('saveBtn')?.addEventListener('click', showSaveModal);
  document.getElementById('clearBtn')?.addEventListener('click', clearPendingOps);
}

/**
 * Get selected plant info
 */
function getSelectedPlantInfo() {
  if (!appState.selectedPlantId) return null;
  
  for (const userId in appState.allUserGardens) {
    const plant = appState.allUserGardens[userId].plants.find(p => p.id === appState.selectedPlantId);
    if (plant) {
      return { userId, plant };
    }
  }
  return null;
}

/**
 * Render plant info section
 */
function renderPlantInfo(info, now) {
  const { userId, plant } = info;
  const stage = window.State.deriveStage(plant, now);
  const ageMs = now - plant.plantedAt;
  const ageDays = Math.floor(ageMs / 86400000);
  
  let html = '';
  html += `<strong style="color: #ffd700;">${plant.id}</strong>`;
  html += `<p style="color: #e8c89f; font-size: 0.85rem; margin: 4px 0;">`;
  html += `📍 (${plant.x}, ${plant.y}) | 🌱 Age: ${ageDays}d | 💧 Watered: ${plant.watered}x | 📈 Stage: ${stage}/3`;
  html += `</p>`;
  
  const isOwner = plant.id.startsWith(appState.currentUserId + '_');
  if (isOwner) {
    html += '<button class="btn btn-sm btn-primary" id="waterBtn" style="background-color: #8DD3FF; color: #2d3a2d; border: none;">💧 Water</button>';
  } else {
    html += `<p style="color: #c9a961; font-size: 0.85rem;">Owner: ${getDisplayName(userId)}</p>`;
  }
  
  return html;
}

/**
 * Render tile info section
 */
function renderTileInfo(tile) {
  const { tileX, tileY } = tile;
  const isInMyPlot = appState.currentUserId && window.State.isTileInUserPlot(appState.currentUserId, tileX, tileY, appState.manifest);
  
  let html = '';
  html += `<strong style="color: #ffd700;">Tile (${tileX}, ${tileY})</strong>`;
  
  if (isInMyPlot) {
    html += '<p style="color: #e8c89f; font-size: 0.85rem; margin: 4px 0;">Empty. Ready to plant!</p>';
    html += '<button class="btn btn-sm btn-success" id="plantBtn" style="background-color: #6a8a70; border: none;">🌱 Plant</button>';
  } else {
    const plotUserId = findPlotAtTile(tileX, tileY);
    if (plotUserId) {
      html += `<p style="color: #c9a961; font-size: 0.85rem;">Belongs to ${getDisplayName(plotUserId)}</p>`;
    } else {
      html += '<p style="color: #c9a961; font-size: 0.85rem;">Outside all plots</p>';
    }
  }
  
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
  const plot = appState.manifest.plots.find(p => p.userId === userId);
  return plot ? plot.name : userId;
}

/**
 * Plant seed at selected tile
 */
function plantSeed() {
  if (!appState.selectedTile || !appState.currentUserId) return;

  const { tileX, tileY } = appState.selectedTile;

  if (!window.State.isTileInUserPlot(appState.currentUserId, tileX, tileY, appState.manifest)) return;
  if (window.State.getPlantAt(appState.allUserGardens, tileX, tileY)) return;

  appState.pendingOps.push({ type: 'plant', x: tileX, y: tileY });
  appState.selectedTile = null;
  appState.selectedPlantId = null;
  render();
}

/**
 * Water the selected plant
 */
function waterPlant() {
  if (!appState.selectedPlantId || !appState.currentUserId) return;

  const plantInfo = getSelectedPlantInfo();
  if (!plantInfo) return;

  const plant = plantInfo.plant;
  if (!plant.id.startsWith(appState.currentUserId + '_')) return;

  appState.pendingOps.push({ type: 'water', plantId: plant.id });
  appState.selectedPlantId = null;
  render();
}

/**
 * Change selected garden
 */
async function changeGarden(e) {
  const gardenId = e.target.value;
  if (gardenId === appState.currentGardenId) return;

  appState.currentGardenId = gardenId;
  localStorage.setItem('gardenSelected', gardenId);
  
  appState.currentUserId = null;
  appState.pendingOps = [];
  appState.selectedTile = null;
  appState.selectedPlantId = null;
  
  try {
    appState.manifest = await window.Net.fetchManifest(gardenId);
    const userIds = appState.manifest.plots.map(p => p.userId);
    const { gardens } = await window.Net.loadAllUserGardens(gardenId, userIds);
    appState.allUserGardens = gardens;
    
    populateUserDropdown();
    render();
  } catch (err) {
    console.error('Error changing garden:', err);
  }
}

/**
 * Change current user
 */
function changeUser(userId) {
  appState.currentUserId = userId;
  localStorage.setItem(`gardenUserId_${appState.currentGardenId}`, userId);
  appState.selectedTile = null;
  appState.selectedPlantId = null;
  appState.pendingOps = [];
  render();
}

/**
 * Clear pending operations
 */
function clearPendingOps() {
  appState.pendingOps = [];
  appState.selectedTile = null;
  appState.selectedPlantId = null;
  render();
}

/**
 * Show save modal and GitHub Issue Form
 */
function showSaveModal() {
  const payload = buildPayload();
  const issueUrl = buildGitHubIssueUrl(payload, 'save');
  
  showModal(
    '💾 Ready to Save',
    `<p style="color: #e8c89f;">Your changes are ready to submit to GitHub.</p>
    <ol style="color: #e8c89f;">
      <li>Click "Open GitHub & Submit" to open the issue form</li>
      <li>Review and click "Submit new issue"</li>
      <li>Wait 1-2 min for  GitHub Action to process</li>
      <li>Click "Refresh Garden" to see your changes</li>
    </ol>`,
    [
      { text: '✅ Open GitHub & Submit', onClick: () => {
        window.open(issueUrl, '_blank');
        clearModal();
        showSubmittingOverlay();
      }},
      { text: 'Cancel', onClick: clearModal, danger: true }
    ]
  );
}

/**
 * Show "Submitting..." overlay
 */
function showSubmittingOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'submitting-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  
  overlay.innerHTML = `
    <div style="background: #2d3a2d; border: 3px solid #8b7355; border-radius: 8px; padding: 40px; text-align: center; color: #e8c89f; max-width: 400px;">
      <div style="font-size: 2rem; margin-bottom: 20px; animation: spin 2s linear infinite;">🌱</div>
      <h3 style="color: #ffd700; margin-bottom: 10px;">Submitting...</h3>
      <p style="margin-bottom: 20px;">Your changes are being processed by GitHub Actions.</p>
      <p style="font-size: 0.9rem; color: #c9a961; margin-bottom: 20px;">Usually takes 1-2 minutes</p>
      <button id="refreshOverlayBtn" class="btn btn-warning btn-sm" style="background-color: #ffd700; color: #2d3a2d; border: none; font-weight: bold;">🔄 Refresh Garden</button>
    </div>
    <style>
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
  `;
  
  document.body.appendChild(overlay);
  document.getElementById('refreshOverlayBtn').addEventListener('click', refreshGarden);
}

/**
 * Refresh the garden (reload from server)
 */
async function refreshGarden() {
  const overlay = document.getElementById('submitting-overlay');
  if (overlay) overlay.remove();
  
  appState.pendingOps = [];
  
  try {
    appState.manifest = await window.Net.fetchManifest(appState.currentGardenId);
    const userIds = appState.manifest.plots.map(p => p.userId);
    const { gardens } = await window.Net.loadAllUserGardens(appState.currentGardenId, userIds);
    appState.allUserGardens = gardens;
    render();
  } catch (err) {
    console.error('Error refreshing garden:', err);
  }
}

/**
 * Show add user modal
 */
function showAddUserModal() {
  showModal(
    '👤 Add New User',
    `<div class="mb-3">
      <label for="displayNameInput" class="form-label" style="color: #e8c89f;">Display Name</label>
      <input type="text" class="form-control form-control-sm" id="displayNameInput" placeholder="e.g., Alice" style="background: #2d3a2d; color: #e8c89f; border-color: #8b7355;">
    </div>
    <div class="mb-3">
      <label for="userIdInput" class="form-label" style="color: #e8c89f;">User ID</label>
      <input type="text" class="form-control form-control-sm" id="userIdInput" placeholder="alice" style="background: #2d3a2d; color: #e8c89f; border-color: #8b7355;">
    </div>`,
    [
      { text: 'Add to GitHub', onClick: () => {
        const displayName = document.getElementById('displayNameInput')?.value || '';
        let userId = document.getElementById('userIdInput')?.value || '';
        
        if (!displayName) { alert('Enter a name'); return; }
        if (!userId) {
          userId = displayName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          document.getElementById('userIdInput').value = userId;
          return;
        }
        
        const payload = `commandType: add_user
gardenId: main
userId: ${userId}
displayName: ${displayName}`;
        
        const issueUrl = buildGitHubIssueUrl(payload, 'add_user');
        clearModal();
        window.open(issueUrl, '_blank');
        showSubmittingOverlay();
      }},
      { text: 'Cancel', onClick: clearModal, danger: true }
    ]
  );
}



/**
 * Build payload for pending operations
 */
function buildPayload() {
  let payload = `commandType: save
gardenId: ${appState.currentGardenId}
userId: ${appState.currentUserId}
ops:`;
  
  appState.pendingOps.forEach(op => {
    if (op.type === 'plant') {
      payload += `\n- plant x=${op.x} y=${op.y}`;
    } else if (op.type === 'water') {
      payload += `\n- water plantId=${op.plantId}`;
    }
  });
  
  payload += `\nclientTs=${Date.now()}`;
  return payload;
}

/**
 * Build GitHub Issue Form URL
 */
function buildGitHubIssueUrl(payload, commandType = 'save') {
  const repoUrl = 'https://github.com/unclegun/unclegun.github.io';
  const title = `[garden] ${commandType}`;
  const body = encodeURIComponent(payload);
  
  return `${repoUrl}/issues/new?title=${encodeURIComponent(title)}&body=${body}&template=garden-command.yml`;
}

/**
 * Show modal dialog
 */
function showModal(title, content, buttons = []) {
  let modalsContainer = document.getElementById('modals-container');
  if (!modalsContainer) {
    modalsContainer = document.createElement('div');
    modalsContainer.id = 'modals-container';
    document.body.appendChild(modalsContainer);
  }
  
  const modal = document.createElement('div');
  modal.className = 'modal fade show';
  modal.id = 'current-modal';
  modal.style.display = 'block';
  modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
  modal.tabIndex = '-1';
  
  let buttonsHtml = buttons.map(btn => {
    const btnClass = btn.danger ? 'btn-outline-secondary' : 'btn-warning';
    return `<button class="btn btn-sm ${btnClass}" data-btn-action="${buttons.indexOf(btn)}">${btn.text}</button>`;
  }).join('');
  
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content" style="background: linear-gradient(135deg, #3a5a40 0%, #2d4a35 100%); border: 2px solid #8b7355;">
        <div class="modal-header" style="border-color: #8b7355;">
          <h5 class="modal-title" style="color: #ffd700;">${title}</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body" style="color: #e8c89f;">
          ${content}
        </div>
        <div class="modal-footer" style="border-color: #8b7355; gap: 8px;">
          ${buttonsHtml}
        </div>
      </div>
    </div>
  `;
  
  modalsContainer.innerHTML = '';
  modalsContainer.appendChild(modal);
  
  buttons.forEach((btn, idx) => {
    const btnEl = modal.querySelector(`[data-btn-action="${idx}"]`);
    if (btnEl) {
      btnEl.addEventListener('click', btn.onClick);
    }
  });
  
  const closeBtn = modal.querySelector('.btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', clearModal);
  }
}

/**
 * Clear modal
 */
function clearModal() {
  const modalsContainer = document.getElementById('modals-container');
  if (modalsContainer) {
    modalsContainer.innerHTML = '';
  }
}

/**
 * Apply daily rain (bonus watering)
 */
function applyDailyRain() {
  const now = Date.now();
  const today = Math.floor(now / 86400000);
  
  if (appState.lastRainDay === today) return;
  
  appState.lastRainDay = today;
  console.log('🌧️ Gentle rain falls on the garden...');
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

/**
 * Cleanup water actions older than 24h
 */
function cleanupWaterActionsToday() {
  const now = Date.now();
  const oneDayMs = 86400000;
  appState.waterActionsToday = appState.waterActionsToday.filter(ts => now - ts < oneDayMs);
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

// Refresh button
document.addEventListener('click', (e) => {
  if (e.target.id === 'refreshBtn') {
    refreshGarden();
  }
});
