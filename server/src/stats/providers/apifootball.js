/**
 * stats/providers/apifootball.js — API-Football adapter.
 *
 * Requires env: APIFOOTBALL_KEY
 * Free tier: 100 req/day on api-football.com (v3)
 *
 * Pitfall: The header must be `x-rapidapi-key`, NOT `Authorization`.
 * Pitfall "dead key 3" — the old TheSportsDB free key `3` is retired and
 *   returns empty results. This module uses api-football.com directly.
 *
 * Endpoint: GET /players?search={name}&league=...&season=...
 */

const BASE = 'https://v3.football.api-sports.io';

let healthy = null;

export function isHealthy() {
  if (!process.env.APIFOOTBALL_KEY) return false;
  return healthy !== false;
}

export async function probe() {
  if (!process.env.APIFOOTBALL_KEY) { healthy = false; return false; }
  try {
    const res = await apiFetch('/status');
    healthy = res.ok;
  } catch { healthy = false; }
  return healthy;
}

export async function fetchStats(name, sport) {
  if (sport !== 'football') return null;
  if (!process.env.APIFOOTBALL_KEY) return null;

  let res;
  try {
    res = await apiFetch(`/players?search=${encodeURIComponent(name)}&season=2024`);
  } catch (e) { healthy = false; throw e; }
  if (!res.ok) { healthy = false; throw new Error(`API-Football HTTP ${res.status}`); }
  healthy = true;

  const body = await res.json();
  const items = body?.response;
  if (!items?.length) return null;

  // Pick first entry — search is close-enough match
  const { player, statistics } = items[0];
  const stats = statistics?.[0] || {};

  return {
    source:       'api-football',
    sport:        'football',
    name:         player.name,
    country:      player.nationality,
    dob:          player.birth?.date,
    age:          player.age,
    height:       player.height,
    weight:       player.weight,
    photo:        player.photo,
    role:         normalisePosition(stats.games?.position),
    club:         stats.team?.name,
    season:       stats.league?.season,
    appearances:  stats.games?.appearences ?? null,    // note: typo is in their API
    goals:        stats.goals?.total ?? null,
    assists:      stats.goals?.assists ?? null,
    yellowCards:  stats.cards?.yellow ?? null,
    redCards:     stats.cards?.red ?? null,
    passAccuracy: stats.passes?.accuracy ?? null,
    rating:       stats.games?.rating ? parseFloat(stats.games.rating) : null,
    cleanSheets:  stats.goals?.conceded === 0 ? null : null,   // GK: computed separately
    saves:        stats.goals?.saves ?? null,
    dribbles:     stats.dribbles?.attempts ?? null,
  };
}

function normalisePosition(pos) {
  if (!pos) return null;
  const p = pos.toLowerCase();
  if (p.includes('goalkeeper')) return 'GK';
  if (p.includes('defender'))   return 'DEF';
  if (p.includes('midfielder')) return 'MID';
  if (p.includes('attacker') || p.includes('forward')) return 'FWD';
  return pos;
}

async function apiFetch(path) {
  return fetch(`${BASE}${path}`, {
    headers: {
      'x-rapidapi-key':  process.env.APIFOOTBALL_KEY,
      'x-rapidapi-host': 'v3.football.api-sports.io',
    },
    signal: AbortSignal.timeout(6000),
  });
}
