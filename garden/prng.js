/**
 * Tiny deterministic PRNG (Mulberry32)
 * No Math.random() for gameplay outcomes.
 * Usage: let rng = createPRNG(seed); let val = rng();
 */

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, 1 | t);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createPRNG(seed) {
  return mulberry32(seed);
}

function seededInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Generate a stable seed from userId, plantSeed, and site constant
 */
function generateSeedFromUser(userId, plantCounter, siteConstant = 0xDEADBEEF) {
  let hash = siteConstant;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  hash = ((hash << 5) - hash) + plantCounter;
  hash = hash & hash;
  return Math.abs(hash);
}

// Export for use
window.PRNG = { createPRNG, seededInt, generateSeedFromUser };
