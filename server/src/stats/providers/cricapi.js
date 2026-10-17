/**
 * stats/providers/cricapi.js — CricAPI adapter.
 *
 * Requires env: CRICAPI_KEY  (or CRICKETDATA_KEY as alias)
 * Free tier: limited requests/day.
 *
 * Pitfall "CricAPI paging": /players only returns 5 results per page and uses
 * `?offset=N` (NOT page=N).  You must paginate until you find the right player.
 * We limit to 3 pages (15 results) so we don't blow the daily quota.
 *
 * Pitfall: Use `?apikey=` query param, NOT a header.
 *
 * Base: https://api.cricapi.com/v1/players?apikey={key}&search={name}&offset={n}
 * Profile: https://api.cricapi.com/v1/players_info?apikey={key}&id={id}
 */

const BASE = 'https://api.cricapi.com/v1';
const MAX_PAGES   = 3;
const PAGE_SIZE   = 5;

let healthy = null;

function apiKey() {
  return process.env.CRICAPI_KEY || process.env.CRICKETDATA_KEY || '';
}

export function isHealthy() {
  if (!apiKey()) return false;
  return healthy !== false;
}

export async function probe() {
  if (!apiKey()) { healthy = false; return false; }
  try {
    const res = await cricFetch(`/players?search=Sachin&offset=0`);
    healthy = res.ok;
  } catch { healthy = false; }
  return healthy;
}

export async function fetchStats(name, sport) {
  if (sport !== 'cricket') return null;
  if (!apiKey()) return null;

  // Step 1: search (with pagination)
  let playerId = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    let res;
    try {
      res = await cricFetch(`/players?search=${encodeURIComponent(name)}&offset=${offset}`);
    } catch (e) { healthy = false; throw e; }
    if (!res.ok) { healthy = false; throw new Error(`CricAPI HTTP ${res.status}`); }
    healthy = true;

    const body = await res.json();
    if (body.status !== 'success') break;
    const items = body.data || [];
    const match = items.find(p => p.name?.toLowerCase().includes(name.toLowerCase().split(' ')[0].toLowerCase()));
    if (match) { playerId = match.id; break; }
    if (items.length < PAGE_SIZE) break; // no more pages
  }

  if (!playerId) return null;

  // Step 2: fetch full profile
  let infoRes;
  try {
    infoRes = await cricFetch(`/players_info?id=${playerId}`);
  } catch (e) { healthy = false; throw e; }
  if (!infoRes.ok) { healthy = false; throw new Error(`CricAPI info HTTP ${infoRes.status}`); }

  const info = await infoRes.json();
  if (info.status !== 'success' || !info.data) return null;

  return normalise(info.data);
}

function normalise(p) {
  const stats = extractStats(p.stats || []);
  return {
    source:      'cricapi',
    sport:       'cricket',
    name:        p.name,
    country:     p.country,
    dob:         p.dateOfBirth,
    role:        p.role,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    photo:       p.playerImg,
    // Test stats
    testMatches:  stats?.testMatches?.m  ?? null,
    testRuns:     stats?.testMatches?.r  ?? null,
    testAvg:      stats?.testMatches?.avg ?? null,
    testSR:       stats?.testMatches?.sr  ?? null,
    testHS:       stats?.testMatches?.hs  ?? null,
    testHundreds: stats?.testMatches?.['100'] ?? null,
    testFifties:  stats?.testMatches?.['50']  ?? null,
    testWickets:  stats?.testMatches?.wkts ?? null,
    testBowlAvg:  stats?.testMatches?.econ ?? null,
    // ODI stats
    odiMatches:   stats?.odis?.m   ?? null,
    odiRuns:      stats?.odis?.r   ?? null,
    odiAvg:       stats?.odis?.avg ?? null,
    odiSR:        stats?.odis?.sr  ?? null,
    odiWickets:   stats?.odis?.wkts ?? null,
    // T20I stats
    t20Matches:   stats?.t20s?.m   ?? null,
    t20Runs:      stats?.t20s?.r   ?? null,
    t20Average:   stats?.t20s?.avg ?? null,
    t20SR:        stats?.t20s?.sr  ?? null,
    t20Wickets:   stats?.t20s?.wkts ?? null,
  };
}

/** CricAPI returns `stats` as an array of { fn, values: [...] } objects. */
function extractStats(statsArray) {
  const result = {};
  const FM = { 'Test': 'testMatches', 'ODI': 'odis', 'T20I': 't20s', 'IPL': 'ipl' };
  for (const entry of statsArray) {
    const format = FM[entry.fn];
    if (!format) continue;
    const row = {};
    for (const v of entry.values || []) row[v.name?.toLowerCase()] = v.value;
    result[format] = row;
  }
  return result;
}

async function cricFetch(path) {
  return fetch(`${BASE}${path}&apikey=${apiKey()}`, {
    signal: AbortSignal.timeout(7000),
  });
}
