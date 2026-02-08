/**
 * Deterministic plant genes generation
 * "same inputs => same plant"
 */

const ARCHETYPES = {
  0: 'flower',
  1: 'fern',
  2: 'shrub',
  3: 'cactus',
  4: 'vine',
  5: 'tree',
  6: 'mushroom',
  7: 'lotus'
};

const PALETTES = {
  0: ['#F4D4A8', '#E8AA54', '#D4845C'], // warm tan/brown
  1: ['#FFC9B0', '#FF8A65', '#D84315'], // warm coral/orange
  2: ['#FFE4B5', '#FFB347', '#D2691E'], // warm cream/tan
  3: ['#FFD4E5', '#F894D7', '#E61E78'], // warm pink/magenta
  4: ['#FFF4CC', '#FFDA5B', '#FFA500'], // warm yellow/gold
  5: ['#E0F4FF', '#8DD3FF', '#4EB3E6']  // cool blue (seasonal)
};

const PATTERNS = {
  0: 'spots',
  1: 'stripes',
  2: 'ring-glow',
  3: 'none'
};

const RARITY_WEIGHTS = [60, 30, 8, 2]; // common, uncommon, rare, mythic

/**
 * Generate deterministic genes for a plant
 * @param {string} userId
 * @param {number} plantCounter - sequential counter per user
 * @param {any} rng - PRNG context
 * @param {number} now - current timestamp
 * @returns {Object} genes object
 */
function generateGenes(userId, plantCounter, rng, now) {
  // archetype: pick one of 8
  const archetype = Math.floor(rng() * 8);

  // palette: seasonal rotation based on month + user hash
  const month = new Date(now).getMonth();
  let palette = (month < 4 || month >= 10) ? 2 : (month < 7 ? 4 : 0); // rotate warm tones
  palette = (palette + Math.floor(rng() * 3)) % 6;

  // pattern: 4 options, weighted toward "none"
  const patternRoll = rng();
  const pattern = patternRoll < 0.6 ? 3 : Math.floor(rng() * 3);

  // accent: subtle modifier
  const accent = Math.floor(rng() * 5);

  // rarity: weighted distribution
  const rarityRoll = rng() * 100;
  let rarity = 0; // common
  if (rarityRoll < 60) rarity = 0;
  else if (rarityRoll < 90) rarity = 1;
  else if (rarityRoll < 98) rarity = 2;
  else rarity = 3;

  return {
    archetype,
    palette,
    pattern,
    accent,
    rarity
  };
}

/**
 * Generate color palette for a plant based on genes + seasonal shift
 */
function getPaletteColors(genes) {
  return PALETTES[genes.palette] || PALETTES[0];
}

/**
 * Get archetype name
 */
function getArchetypeName(genes) {
  return ARCHETYPES[genes.archetype] || 'flower';
}

/**
 * Get pattern name
 */
function getPatternName(genes) {
  return PATTERNS[genes.pattern] || 'none';
}

// Export
window.Genes = {
  ARCHETYPES,
  PALETTES,
  PATTERNS,
  generateGenes,
  getPaletteColors,
  getArchetypeName,
  getPatternName
};
