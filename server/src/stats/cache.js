/**
 * stats/cache.js — simple in-memory TTL cache for player stat lookups.
 * Keyed by "<sport>:<normalised-name>".
 * - Successful hit: 60 min TTL
 * - "Not found" / error: 5 min TTL (so transient outages recover quickly)
 */

const HITS_TTL_MS   = 60 * 60 * 1000;  // 1 hour
const MISS_TTL_MS   =  5 * 60 * 1000;  // 5 minutes

const store = new Map(); // key → { data, expiresAt }

export function cacheKey(sport, name) {
  return `${sport}:${name.toLowerCase().trim()}`;
}

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.data;
}

export function cacheSet(key, data, { miss = false } = {}) {
  store.set(key, {
    data,
    expiresAt: Date.now() + (miss ? MISS_TTL_MS : HITS_TTL_MS),
  });
}

export function cacheSize() { return store.size; }

export function cacheClear() { store.clear(); }

export function cacheStats() {
  let valid = 0, expired = 0;
  const now = Date.now();
  for (const [, v] of store) {
    if (now > v.expiresAt) expired++; else valid++;
  }
  return { total: store.size, valid, expired };
}
