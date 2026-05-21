/**
 * Client-side API response cache.
 * Enables instant UI rendering with stale-while-revalidate semantics.
 *
 * Usage:
 *   import { cache } from '/js/core/cache.js';
 *   const data = await cache.getOrFetch('/auth/me', () => api.auth.me(), (fresh) => updateUI(fresh));
 */
const CACHE_PREFIX = 'vac_';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;

let memoryCache = {};

function cacheKey(key) {
  return CACHE_PREFIX + key;
}

function now() {
  return Date.now();
}

function loadFromStorage(key) {
  try {
    const raw = sessionStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (now() - entry._ts > (entry._maxAge || DEFAULT_MAX_AGE_MS)) {
      sessionStorage.removeItem(cacheKey(key));
      return null;
    }
    return entry._data;
  } catch {
    return null;
  }
}

function saveToStorage(key, data, maxAge) {
  try {
    const entry = { _data: data, _ts: now(), _maxAge: maxAge || DEFAULT_MAX_AGE_MS };
    sessionStorage.setItem(cacheKey(key), JSON.stringify(entry));
  } catch { /* storage full */ }
}

function removeFromStorage(key) {
  try {
    sessionStorage.removeItem(cacheKey(key));
  } catch { }
}

export const cache = {
  /**
   * Get cached data or fetch fresh.
   * Returns cached data immediately, then calls onUpdate with fresh data.
   * If no cached data, awaits the fetchPromise.
   *
   * @param {string} key - unique cache key (e.g. '/files?limit=100')
   * @param {() => Promise<any>} fetchFn - function that returns fresh data
   * @param {(data: any, isFresh: boolean) => void} [onUpdate] - called when data is available (cached or fresh)
   * @param {number} [maxAgeMs] - max age of cached data in ms (default 5 min)
   * @returns {Promise<any>} - resolves with cached data immediately, or fresh data if no cache
   */
  async getOrFetch(key, fetchFn, onUpdate, maxAgeMs) {
    const memCached = memoryCache[key];
    const stored = loadFromStorage(key);

    let cachedData = null;
    if (memCached && (now() - memCached._ts < (maxAgeMs || DEFAULT_MAX_AGE_MS))) {
      cachedData = memCached._data;
    } else if (stored) {
      cachedData = stored;
      memoryCache[key] = { _data: stored, _ts: now() };
    }

    if (cachedData) {
      if (onUpdate) onUpdate(cachedData, false);
    }

    const fetchPromise = fetchFn().then(fresh => {
      memoryCache[key] = { _data: fresh, _ts: now() };
      saveToStorage(key, fresh, maxAgeMs);
      if (onUpdate) {
        try { onUpdate(fresh, true); } catch { }
      }
      return fresh;
    }).catch(err => {
      if (cachedData) return cachedData;
      throw err;
    });

    if (cachedData) {
      fetchPromise.catch(() => { });
      return cachedData;
    }

    const fresh = await fetchPromise;
    if (onUpdate && !cachedData) {
      try { onUpdate(fresh, true); } catch { }
    }
    return fresh;
  },

  /**
   * Set cache data manually.
   */
  set(key, data, maxAgeMs) {
    memoryCache[key] = { _data: data, _ts: now() };
    saveToStorage(key, data, maxAgeMs);
  },

  /**
   * Get cached data synchronously. Returns null if not cached.
   */
  getSync(key) {
    const mem = memoryCache[key];
    if (mem && (now() - mem._ts < DEFAULT_MAX_AGE_MS)) return mem._data;
    const stored = loadFromStorage(key);
    if (stored) {
      memoryCache[key] = { _data: stored, _ts: now() };
    }
    return stored;
  },

  /**
   * Invalidate a specific cache entry or entries matching a pattern.
   */
  invalidate(keyOrPrefix) {
    if (memoryCache[keyOrPrefix]) {
      delete memoryCache[keyOrPrefix];
    }
    removeFromStorage(keyOrPrefix);

    for (const k of Object.keys(memoryCache)) {
      if (k.startsWith(keyOrPrefix)) {
        delete memoryCache[k];
      }
    }

    const prefix = cacheKey(keyOrPrefix);
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) {
        sessionStorage.removeItem(k);
      }
    }

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'INVALIDATE_API_CACHE',
        prefix: keyOrPrefix,
      });
    }
  },

  /**
   * Clear all cached data.
   */
  clearAll() {
    memoryCache = {};
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        sessionStorage.removeItem(k);
      }
    }
  },
};
