/**
 * Networking layer: fetch manifest and user gardens
 * Supports multi-garden structure with garden/data/<gardenId>/ paths
 * No server writes - uses GitHub Issue Form + Action for persistence
 */

/**
 * Load the gardens index
 */
async function loadGardens() {
  try {
    const response = await fetch('./data/gardens.json');
    if (!response.ok) throw new Error(`Failed to load gardens: ${response.status}`);
    const data = await response.json();
    console.log('✓ Gardens loaded:', data.gardens.length, 'gardens');
    return data;
  } catch (err) {
    console.error('✗ Error loading gardens:', err);
    return { version: 1, gardens: [{ id: 'main', name: 'Main Garden' }] };
  }
}

/**
 * Load manifest for a specific garden
 */
async function fetchManifest(gardenId = 'main') {
  try {
    const response = await fetch(`./data/${gardenId}/manifest.json`);
    if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
    const data = await response.json();
    console.log(`✓ Manifest loaded for ${gardenId}:`, data);
    return data;
  } catch (err) {
    console.error(`✗ Error loading manifest for ${gardenId}:`, err);
    return { version: 1, gardenId, grid: { w: 24, h: 12, tile: 24 }, plots: [], updatedAt: Date.now() };
  }
}

/**
 * Fetch a user's garden JSON
 * Falls back to localStorage if server file not available
 * @returns { data, etag } or { data: null, etag: null } if not found
 */
async function fetchUserGarden(gardenId = 'main', userId) {
  try {
    const response = await fetch(`./data/${gardenId}/users/${userId}.json`);
    if (response.status === 404) {
      // Try to load from localStorage
      const cached = localStorage.getItem(`garden_cache_${gardenId}_${userId}`);
      if (cached) {
        console.log(`📱 Loaded ${gardenId}/${userId} from local storage (server file not found)`);
        return { data: JSON.parse(cached), etag: null };
      }
      console.log(`ℹ User file not found: ${gardenId}/${userId}`);
      return { data: null, etag: null };
    }
    if (!response.ok) throw new Error(`Failed to load user garden: ${response.status}`);
    const data = await response.json();
    // Cache to localStorage
    localStorage.setItem(`garden_cache_${gardenId}_${userId}`, JSON.stringify(data));
    console.log(`✓ Loaded user garden: ${gardenId}/${userId}`);
    return { data, etag: null };
  } catch (err) {
    console.error(`✗ Error loading user garden ${gardenId}/${userId}:`, err);
    // Try localStorage as fallback
    const cached = localStorage.getItem(`garden_cache_${gardenId}_${userId}`);
    if (cached) {
      console.log(`⚠ Using local storage for ${gardenId}/${userId} (server unreachable)`);
      return { data: JSON.parse(cached), etag: null };
    }
    return { data: null, etag: null };
  }
}

/**
 * Load all user gardens in parallel for a specific garden
 * @param {string} gardenId
 * @param {Array} userIds from manifest
 * @returns { gardens: { userId: data }, etags: { userId: etag } }
 */
async function loadAllUserGardens(gardenId = 'main', userIds) {
  const promises = userIds.map(userId => 
    fetchUserGarden(gardenId, userId).then(result => ({
      userId,
      ...result
    }))
  );

  const results = await Promise.allSettled(promises);
  const gardens = {};
  const etags = {};

  results.forEach(result => {
    if (result.status === 'fulfilled') {
      const { userId, data, etag } = result.value;
      if (data) {
        gardens[userId] = data;
        if (etag) etags[userId] = etag;
      }
    }
  });

  return { gardens, etags };
}

// Export
window.Net = {
  loadGardens,
  fetchManifest,
  fetchUserGarden,
  loadAllUserGardens
};
