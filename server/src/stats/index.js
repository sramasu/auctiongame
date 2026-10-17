/**
 * stats/index.js — Stats coordinator.
 *
 * Priority chain per sport:
 *   cricket:  CricAPI (full stats) → TheSportsDB (profile) → mock
 *   football: API-Football (full stats) → TheSportsDB (profile) → mock
 *
 * Every result is cached:  60 min on hit, 5 min on miss.
 * The coordinator NEVER throws to its caller — it always returns something.
 */

import { cacheKey, cacheGet, cacheSet, cacheStats } from './cache.js';
import { mockStats } from './mock.js';

import * as sportsdb    from './providers/sportsdb.js';
import * as apifootball from './providers/apifootball.js';
import * as cricapi     from './providers/cricapi.js';

// Run health probes once on startup (non-blocking).
let probesDone = false;
export async function probeAll() {
  if (probesDone) return;
  probesDone = true;
  await Promise.allSettled([sportsdb.probe(), apifootball.probe(), cricapi.probe()]);
}

/**
 * Fetch stats for a player.
 * @param {object} player  — player record (must have .name, .sport or inferred)
 * @param {string} [sport] — 'cricket' | 'football' (overrides player.sport)
 * @returns {object}       — stats object, never null
 */
export async function getStats(player, sport) {
  const s   = sport || player.sport || 'cricket';
  const key = cacheKey(s, player.name);

  const cached = cacheGet(key);
  if (cached) return cached;

  let result = null;

  try {
    if (s === 'cricket') {
      result = await cricapi.fetchStats(player.name, s).catch(() => null);
      if (!result) result = await sportsdb.fetchStats(player.name, s).catch(() => null);
    } else {
      result = await apifootball.fetchStats(player.name, s).catch(() => null);
      if (!result) result = await sportsdb.fetchStats(player.name, s).catch(() => null);
    }
  } catch {
    result = null;
  }

  if (!result) {
    result = mockStats({ ...player, sport: s });
    cacheSet(key, result, { miss: true });
  } else {
    cacheSet(key, result);
  }

  return result;
}

/**
 * Status of all providers — used by GET /api/stats/status.
 */
export function getProviderStatus() {
  return {
    thesportsdb: {
      name:    'TheSportsDB',
      key:     'public (123)',
      healthy: sportsdb.isHealthy(),
      sports:  ['cricket', 'football'],
    },
    apifootball: {
      name:    'API-Football',
      key:     process.env.APIFOOTBALL_KEY ? 'configured' : 'not configured',
      healthy: apifootball.isHealthy(),
      sports:  ['football'],
    },
    cricapi: {
      name:    'CricAPI',
      key:     (process.env.CRICAPI_KEY || process.env.CRICKETDATA_KEY) ? 'configured' : 'not configured',
      healthy: cricapi.isHealthy(),
      sports:  ['cricket'],
    },
    mock: {
      name:    'Mock (offline fallback)',
      key:     'built-in',
      healthy: true,
      sports:  ['cricket', 'football'],
    },
    cache: cacheStats(),
  };
}

/**
 * Diagnose a single player lookup — used by GET /api/stats/diagnose.
 * Bypasses cache so the caller always sees a fresh attempt.
 */
export async function diagnose(name, sport) {
  const s = sport || 'cricket';
  const steps = [];

  async function tryProvider(label, fn) {
    const start = Date.now();
    try {
      const result = await fn();
      steps.push({ provider: label, ok: !!result, ms: Date.now() - start, result });
      return result;
    } catch (e) {
      steps.push({ provider: label, ok: false, ms: Date.now() - start, error: e.message });
      return null;
    }
  }

  let result = null;
  if (s === 'cricket') {
    result = await tryProvider('CricAPI',      () => cricapi.fetchStats(name, s));
    if (!result) result = await tryProvider('TheSportsDB', () => sportsdb.fetchStats(name, s));
  } else {
    result = await tryProvider('API-Football', () => apifootball.fetchStats(name, s));
    if (!result) result = await tryProvider('TheSportsDB', () => sportsdb.fetchStats(name, s));
  }
  if (!result) {
    result = mockStats({ name, sport: s });
    steps.push({ provider: 'Mock', ok: true, ms: 0, result });
  }

  return { name, sport: s, steps, final: result };
}
