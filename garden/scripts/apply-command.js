#!/usr/bin/env node

/**
 * Garden Command Processor
 * Applies garden commands from GitHub Issue Form to repository JSON files
 * Usage: node apply-command.js "<issue-body>"
 */

const fs = require('fs');
const path = require('path');

const GARDEN_DATA_DIR = path.join(__dirname, '../data');
const WATER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const SITE_SEED = 1337;

/**
 * Simple mulberry32 PRNG for deterministic genes
 */
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, 1 | t);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generateSeedFromUser(userId, plantCounter, siteConstant = SITE_SEED) {
  let hash = siteConstant;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  hash = ((hash << 5) - hash) + plantCounter;
  hash = hash & hash;
  return Math.abs(hash);
}

function generateGenes(userId, plantCounter, now) {
  const seed = generateSeedFromUser(userId, plantCounter, SITE_SEED);
  const rng = mulberry32(seed);
  
  const archetype = Math.floor(rng() * 8);
  const month = new Date(now).getMonth();
  let palette = (month < 4 || month >= 10) ? 2 : (month < 7 ? 4 : 0);
  palette = (palette + Math.floor(rng() * 3)) % 6;
  const pattern = Math.floor(rng() * 4);
  const rarityVal = rng();
  let rarity = 0;
  if (rarityVal < 0.6) rarity = 0;
  else if (rarityVal < 0.9) rarity = 1;
  else if (rarityVal < 0.98) rarity = 2;
  else rarity = 3;
  const accent = Math.floor(rng() * 4);

  return {
    archetype,
    palette,
    pattern,
    accent,
    rarity
  };
}

/**
 * Parse the issue body into command object
 */
function parseCommand(issueBody) {
  const result = {
    commandType: null,
    gardenId: null,
    userId: null,
    displayName: null,
    ops: [],
    clientTs: Date.now()
  };

  if (!issueBody) throw new Error('Empty issue body');

  const lines = issueBody.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse field: value pairs
    if (trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      const keyLower = key.toLowerCase();
      
      if (keyLower === 'commandtype' || keyLower.includes('command')) {
        result.commandType = value.toLowerCase();
      } else if (keyLower === 'gardenid' || keyLower.includes('garden')) {
        result.gardenId = value.toLowerCase();
      } else if (keyLower === 'userid' || keyLower.includes('user id')) {
        result.userId = value.toLowerCase();
      } else if (keyLower === 'displayname' || keyLower.includes('display')) {
        result.displayName = value;
      }
    }

    // Parse operations (ops: section)
    if (trimmed.startsWith('- plant') || trimmed.startsWith('- water')) {
      const op = {};
      const parts = trimmed.split(/\s+/);
      
      if (parts[1] === 'plant') {
        op.type = 'plant';
        for (let i = 2; i < parts.length; i++) {
          const [k, v] = parts[i].split('=');
          if (k === 'x') op.x = parseInt(v);
          if (k === 'y') op.y = parseInt(v);
        }
      } else if (parts[1] === 'water') {
        op.type = 'water';
        for (let i = 2; i < parts.length; i++) {
          const [k, v] = parts[i].split('=');
          if (k === 'plantId') op.plantId = v;
        }
      }
      
      if (op.type) result.ops.push(op);
    }

    // Parse clientTs
    if (trimmed.startsWith('clientTs=')) {
      result.clientTs = parseInt(trimmed.split('=')[1]);
    }
  }

  return result;
}

/**
 * Ensure garden directory exists
 */
function ensureGardenDir(gardenId) {
  const gardenDir = path.join(GARDEN_DATA_DIR, gardenId);
  if (!fs.existsSync(gardenDir)) {
    fs.mkdirSync(gardenDir, { recursive: true });
  }
  const usersDir = path.join(gardenDir, 'users');
  if (!fs.existsSync(usersDir)) {
    fs.mkdirSync(usersDir, { recursive: true });
  }
}

/**
 * Load manifest for a garden
 */
function loadManifest(gardenId) {
  const filePath = path.join(GARDEN_DATA_DIR, gardenId, 'manifest.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Garden not found: ${gardenId}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Save manifest for a garden
 */
function saveManifest(gardenId, manifest) {
  const filePath = path.join(GARDEN_DATA_DIR, gardenId, 'manifest.json');
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Load user garden
 */
function loadUserGarden(gardenId, userId) {
  const filePath = path.join(GARDEN_DATA_DIR, gardenId, 'users', `${userId}.json`);
  if (!fs.existsSync(filePath)) {
    return {
      version: 1,
      gardenId,
      userId,
      updatedAt: Date.now(),
      plants: []
    };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Save user garden
 */
function saveUserGarden(gardenId, userId, garden) {
  garden.updatedAt = Date.now();
  const filePath = path.join(GARDEN_DATA_DIR, gardenId, 'users', `${userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(garden, null, 2) + '\n');
}

/**
 * Load gardens index
 */
function loadGardens() {
  const filePath = path.join(GARDEN_DATA_DIR, 'gardens.json');
  if (!fs.existsSync(filePath)) {
    return { version: 1, gardens: [] };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Save gardens index
 */
function saveGardens(gardens) {
  const filePath = path.join(GARDEN_DATA_DIR, 'gardens.json');
  fs.writeFileSync(filePath, JSON.stringify(gardens, null, 2) + '\n');
}

/**
 * Validate and apply save command
 */
function applySaveCommand(command) {
  const { gardenId, userId, ops } = command;
  
  if (!gardenId || !userId) {
    throw new Error('save requires gardenId and userId');
  }

  const manifest = loadManifest(gardenId);
  
  // Check user exists
  const userPlot = manifest.plots.find(p => p.userId === userId);
  if (!userPlot) {
    throw new Error(`User ${userId} not found in garden ${gardenId}`);
  }

  const userGarden = loadUserGarden(gardenId, userId);
  const now = Date.now();

  for (const op of ops) {
    if (op.type === 'plant') {
      const { x, y } = op;
      
      // Validate bounds
      const { plot } = userPlot;
      if (x < plot.x || x >= plot.x + plot.w || y < plot.y || y >= plot.y + plot.h) {
        throw new Error(`Tile (${x}, ${y}) outside user's plot`);
      }

      // Check if already occupied
      let occupied = false;
      for (const userId2 in (manifest.plots || [])) {
        const ug = loadUserGarden(gardenId, userId2);
        if (ug.plants.some(p => p.x === x && p.y === y)) {
          occupied = true;
          break;
        }
      }

      // Also check in current user's plants
      if (userGarden.plants.some(p => p.x === x && p.y === y)) {
        throw new Error(`Tile (${x}, ${y}) already occupied`);
      }

      // Create plant
      const plantCounter = userGarden.plants.length + 1;
      const newPlantId = `${userId}_${String(plantCounter).padStart(4, '0')}`;
      
      const plant = {
        id: newPlantId,
        x,
        y,
        plantedAt: now,
        watered: 0,
        lastWateredAt: 0,
        genes: generateGenes(userId, plantCounter, now),
        updatedAt: now
      };

      userGarden.plants.push(plant);
    } else if (op.type === 'water') {
      const { plantId } = op;
      
      // Find plant
      const plant = userGarden.plants.find(p => p.id === plantId);
      if (!plant) {
        throw new Error(`Plant ${plantId} not found`);
      }

      // Check cooldown (6 hours per plant)
      if (plant.lastWateredAt > 0) {
        const timeSinceWater = now - plant.lastWateredAt;
        if (timeSinceWater < WATER_COOLDOWN_MS) {
          throw new Error(`Plant ${plantId} was watered too recently`);
        }
      }

      // Water
      plant.watered += 1;
      plant.lastWateredAt = now;
      plant.updatedAt = now;
    }
  }

  // Save
  saveUserGarden(gardenId, userId, userGarden);
  console.log(`✓ Applied save command to ${userId}'s garden`);
}

/**
 * Validate and apply add_user command
 */
function applyAddUserCommand(command) {
  const { gardenId, userId, displayName } = command;
  
  if (!gardenId || !userId || !displayName) {
    throw new Error('add_user requires gardenId, userId, and displayName');
  }

  const manifest = loadManifest(gardenId);

  // Check user doesn't exist
  if (manifest.plots.some(p => p.userId === userId)) {
    throw new Error(`User ${userId} already exists in garden ${gardenId}`);
  }

  // Find next available plot rectangle (simple left-to-right packing)
  const plotWidth = 6;
  const plotHeight = 6;
  const gridWidth = manifest.grid.w;
  const gridHeight = manifest.grid.h;

  let newPlot = null;
  for (let y = 0; y < gridHeight; y += plotHeight) {
    for (let x = 0; x < gridWidth; x += plotWidth) {
      // Check if occupied
      const occupied = manifest.plots.some(p => {
        const px = p.plot.x;
        const py = p.plot.y;
        return px === x && py === y;
      });

      if (!occupied) {
        newPlot = { x, y, w: plotWidth, h: plotHeight };
        break;
      }
    }
    if (newPlot) break;
  }

  if (!newPlot) {
    throw new Error('Garden is full, no more plots available');
  }

  // Add to manifest
  manifest.plots.push({
    userId,
    name: displayName,
    plot: newPlot
  });
  manifest.updatedAt = Date.now();
  saveManifest(gardenId, manifest);

  // Create user garden
  const userGarden = {
    version: 1,
    gardenId,
    userId,
    updatedAt: Date.now(),
    plants: []
  };
  saveUserGarden(gardenId, userId, userGarden);

  console.log(`✓ Added user ${userId} to garden ${gardenId}`);
}

/**
 * Validate and apply create_garden command
 */
function applyCreateGardenCommand(command) {
  const { gardenId, displayName } = command;
  
  if (!gardenId) {
    throw new Error('create_garden requires gardenId');
  }

  // Check garden doesn't exist
  const gardens = loadGardens();
  if (gardens.gardens.some(g => g.id === gardenId)) {
    throw new Error(`Garden ${gardenId} already exists`);
  }

  // Create garden directory
  ensureGardenDir(gardenId);

  // Create manifest
  const manifest = {
    version: 1,
    gardenId,
    grid: { w: 24, h: 12, tile: 24 },
    plots: [],
    updatedAt: Date.now()
  };
  saveManifest(gardenId, manifest);

  // Update gardens index
  gardens.gardens.push({
    id: gardenId,
    name: displayName || gardenId
  });
  saveGardens(gardens);

  console.log(`✓ Created new garden: ${gardenId}`);
}

/**
 * Main entry point
 */
async function main() {
  const issueBody = process.argv[2];
  
  try {
    if (!issueBody) {
      throw new Error('No issue body provided');
    }

    const command = parseCommand(issueBody);
    
    console.log('Parsed command:', JSON.stringify(command, null, 2));

    if (!command.commandType) {
      throw new Error('Unknown command type');
    }

    switch (command.commandType) {
      case 'save':
        applySaveCommand(command);
        break;
      case 'add_user':
        applyAddUserCommand(command);
        break;
      case 'create_garden':
        applyCreateGardenCommand(command);
        break;
      default:
        throw new Error(`Unknown command: ${command.commandType}`);
    }

    console.log('✅ Command processed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Command failed:', err.message);
    process.exit(1);
  }
}

main();
