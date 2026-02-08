/**
 * Networking layer: fetch/save manifest and user gardens
 * Handles ETag-based conflict resolution
 */

async function fetchManifest() {
  try {
    const response = await fetch('./manifest.json');
    if (!response.ok) throw new Error(`Failed to load manifest: ${response.status}`);
    const data = await response.json();
    console.log('✓ Manifest loaded:', data);
    return data;
  } catch (err) {
    console.error('✗ Error loading manifest:', err);
    return { version: 1, plots: [] };
  }
}

/**
 * Fetch a user's garden JSON
 * Falls back to localStorage if server file not available
 * @returns { data, etag } or { data: null, etag: null } if not found
 */
async function fetchUserGarden(userId) {
  try {
    const response = await fetch(`./users/${userId}.json`);
    if (response.status === 404) {
      // Try to load from localStorage
      const cached = localStorage.getItem(`garden_cache_${userId}`);
      if (cached) {
        console.log(`📱 Loaded ${userId} from local storage (server file not found)`);
        return { data: JSON.parse(cached), etag: null };
      }
      console.log(`ℹ User file not found: ${userId}`);
      return { data: null, etag: null };
    }
    if (!response.ok) throw new Error(`Failed to load user garden: ${response.status}`);
    const data = await response.json();
    const etag = response.headers.get('ETag');
    console.log(`✓ Loaded user garden: ${userId}`);
    return { data, etag };
  } catch (err) {
    console.error(`✗ Error loading user garden ${userId}:`, err);
    // Try localStorage as fallback
    const cached = localStorage.getItem(`garden_cache_${userId}`);
    if (cached) {
      console.log(`⚠ Using local storage for ${userId} (server unreachable)`);
      return { data: JSON.parse(cached), etag: null };
    }
    return { data: null, etag: null };
  }
}

/**
 * Save or create a user garden using PUT + If-Match when etag exists
 * Falls back to localStorage if server doesn't support PUT (like GitHub Pages)
 * @param {string} userId
 * @param {Object} data - the garden data
 * @param {string|null} etag - ETag from last fetch, or null
 * @returns { success, data, etag, conflict }
 */
async function saveUserGarden(userId, data, etag = null) {
  try {
    // Always save to localStorage as fallback
    const cacheKey = `garden_cache_${userId}`;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    console.log(`💾 Saved ${userId} to local storage`);

    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

    // Add If-Match header if we have an etag
    if (etag) {
      options.headers['If-Match'] = etag;
    }

    const response = await fetch(`users/${userId}.json`, options);

    // 412 = Precondition Failed (ETag mismatch)
    if (response.status === 412) {
      return { success: false, data: null, etag: null, conflict: true };
    }

    // 405 = Method Not Allowed (expected on GitHub Pages static hosting)
    if (response.status === 405) {
      console.log('ℹ️  Server does not support PUT (expected on GitHub Pages). Using localStorage.');
      return { success: true, data, etag: null, conflict: false };
    }

    if (!response.ok) {
      throw new Error(`Failed to save user garden: ${response.status}`);
    }

    const newEtag = response.headers.get('ETag');
    console.log(`✓ Synced ${userId} with server`);
    return { success: true, data, etag: newEtag, conflict: false };
  } catch (err) {
    console.error(`Error saving user garden ${userId}:`, err);
    // Still return success since we have localStorage
    return { success: true, data, etag: null, conflict: false };
  }
}

/**
 * Save with automatic retry + merge on conflict
 * Fetches remote, merges, and retries once
 */
async function saveUserGardenWithMerge(userId, localData, etag) {
  const result = await saveUserGarden(userId, localData, etag);
  
  if (result.conflict) {
    // Conflict: fetch remote, merge, retry
    const { data: remoteData } = await fetchUserGarden(userId);
    if (remoteData) {
      const merged = window.State.mergeUserGarden(localData, remoteData);
      return await saveUserGarden(userId, merged, null);
    }
  }
  
  return result;
}

/**
 * Load all user gardens in parallel
 * @param {Array} userIds from manifest
 * @returns { gardens: { userId: data }, etags: { userId: etag } }
 */
async function loadAllUserGardens(userIds) {
  const promises = userIds.map(userId => 
    fetchUserGarden(userId).then(result => ({
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
  fetchManifest,
  fetchUserGarden,
  saveUserGarden,
  saveUserGardenWithMerge,
  loadAllUserGardens
};
