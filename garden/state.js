/**
 * Pure state management functions for the garden
 * No mutations; all functions return new objects
 */

const GARDEN_SIZE = { width: 24, height: 12 };
const WATER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_WATERS_PER_DAY = 3; // per-device cap

/**
 * Derive growth stage from plant age and watering
 * ageDays = (now - plantedAt) / 86400000
 * waterBoost = min(watered, 8) * 0.35
 * stage = clamp(floor(ageDays + waterBoost), 0..3)
 */
function deriveStage(plant, now) {
  const plantedMs = plant.plantedAt;
  const ageMs = now - plantedMs;
  const ageDays = ageMs / 86400000;
  const waterBoost = Math.min(plant.watered, 8) * 0.35;
  const rawStage = ageDays + waterBoost;
  return Math.max(0, Math.min(3, Math.floor(rawStage)));
}

/**
 * Check if a tile is within user's plot bounds
 */
function isTileInUserPlot(userId, x, y, manifest) {
  const userEntry = manifest.plots.find(p => p.userId === userId);
  if (!userEntry) return false;
  const { plot } = userEntry;
  return x >= plot.x && x < plot.x + plot.w && y >= plot.y && y < plot.y + plot.h;
}

/**
 * Get plant at (x, y) in garden, or null
 */
function getPlantAt(allUserGardens, x, y) {
  for (const userId in allUserGardens) {
    const ug = allUserGardens[userId];
    const plant = ug.plants.find(p => p.x === x && p.y === y);
    if (plant) return plant;
  }
  return null;
}

/**
 * Plant a new seed at (x, y) in user's garden
 */
function plantAt(userGarden, x, y, now, rng) {
  // Check if already occupied
  if (userGarden.plants.some(p => p.x === x && p.y === y)) {
    return userGarden; // no change
  }

  // Generate genes
  const plantCounter = userGarden.plants.length;
  const genes = window.Genes.generateGenes(userGarden.userId, plantCounter, rng, now);

  // Create plant
  const plant = {
    id: `${userGarden.userId}_${plantCounter}`,
    x,
    y,
    plantedAt: now,
    watered: 0,
    lastWateredAt: 0,
    genes,
    updatedAt: now
  };

  return {
    ...userGarden,
    plants: [...userGarden.plants, plant],
    updatedAt: now
  };
}

/**
 * Water a plant in user's garden
 * Returns same garden if cooldown active or plant not found
 */
function waterPlant(userGarden, plantId, now) {
  const plantIdx = userGarden.plants.findIndex(p => p.id === plantId);
  if (plantIdx === -1) return userGarden; // plant not found

  const plant = userGarden.plants[plantIdx];

  // Check cooldown (6 hours)
  const timeSinceWater = now - plant.lastWateredAt;
  if (plant.lastWateredAt > 0 && timeSinceWater < WATER_COOLDOWN_MS) {
    return userGarden; // still in cooldown
  }

  // Water the plant
  const updatedPlant = {
    ...plant,
    watered: plant.watered + 1,
    lastWateredAt: now,
    updatedAt: now
  };

  const newPlants = [...userGarden.plants];
  newPlants[plantIdx] = updatedPlant;

  return {
    ...userGarden,
    plants: newPlants,
    updatedAt: now
  };
}

/**
 * Check if plant can be watered (respects cooldown)
 */
function canWaterPlant(plant, now) {
  if (plant.lastWateredAt === 0) return true; // never watered
  const timeSinceWater = now - plant.lastWateredAt;
  return timeSinceWater >= WATER_COOLDOWN_MS;
}

/**
 * Get time in ms until plant can be watered again
 */
function getWaterCooldownRemaining(plant, now) {
  if (plant.lastWateredAt === 0) return 0;
  const elapsed = now - plant.lastWateredAt;
  return Math.max(0, WATER_COOLDOWN_MS - elapsed);
}

/**
 * Merge local and remote user gardens (conflict resolution)
 * Newer updatedAt wins per plant
 */
function mergeUserGarden(local, remote) {
  const plantMap = {};

  // Add all remote plants
  (remote.plants || []).forEach(p => {
    plantMap[p.id] = p;
  });

  // Overlay local plants (newer wins)
  (local.plants || []).forEach(p => {
    if (!plantMap[p.id] || p.updatedAt > plantMap[p.id].updatedAt) {
      plantMap[p.id] = p;
    }
  });

  return {
    version: 1,
    userId: local.userId,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    plants: Object.values(plantMap)
  };
}

/**
 * Apply daily "light rain" to one random plant in user's garden
 * Deterministic per day; gated by localStorage
 */
function applyDailyRain(userGarden, now) {
  if (userGarden.plants.length === 0) return userGarden;

  // Check if already rained today
  const today = Math.floor(now / 86400000);
  const lastRainDay = parseInt(localStorage.getItem(`rain_${userGarden.userId}`)) || -1;
  if (lastRainDay === today) {
    return userGarden; // already rained today
  }

  // Pick deterministic plant based on day + userId
  const seed = window.PRNG.generateSeedFromUser(userGarden.userId, today);
  const rng = window.PRNG.createPRNG(seed);
  const idx = Math.floor(rng() * userGarden.plants.length);
  const plantId = userGarden.plants[idx].id;

  // Water it (ignoring cooldown in this call; merge logic will handle)
  const waterResult = waterPlant(userGarden, plantId, now);

  // Mark today as rained
  localStorage.setItem(`rain_${userGarden.userId}`, String(today));

  return waterResult;
}

// Export
window.State = {
  GARDEN_SIZE,
  WATER_COOLDOWN_MS,
  MAX_WATERS_PER_DAY,
  deriveStage,
  isTileInUserPlot,
  getPlantAt,
  plantAt,
  waterPlant,
  canWaterPlant,
  getWaterCooldownRemaining,
  mergeUserGarden,
  applyDailyRain
};
