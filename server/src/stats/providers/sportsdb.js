/**
 * stats/providers/sportsdb.js — TheSportsDB adapter.
 *
 * Public key `123` gives real player profile data for both cricket & football.
 * The dead old free key `3` is RETIRED — always use `123`.
 *
 * Docs: https://www.thesportsdb.com/api.php
 * Base: https://www.thesportsdb.com/api/v1/json/{key}/searchplayers.php?p={name}
 *
 * Pitfall: The v1 /searchplayers endpoint returns a *flat* `player` array; each
 * item has strSport, strPosition, etc. — NOT nested under `data`.
 */

const BASE   = 'https://www.thesportsdb.com/api/v1/json';
const SPORT_MAP = {
  cricket:  'Cricket',
  football: 'Soccer',
};

let healthy = null; // null = unknown, true/false after first probe

export function isHealthy() { return healthy !== false; }

export async function probe() {
  try {
    const res = await fetch(`${BASE}/123/searchplayers.php?p=Virat+Kohli`, { signal: AbortSignal.timeout(4000) });
    healthy = res.ok;
  } catch { healthy = false; }
  return healthy;
}

/**
 * Fetch player profile.
 * @param {string} name  — player's full name
 * @param {string} sport — 'cricket' | 'football'
 * @returns {object|null}
 */
export async function fetchStats(name, sport) {
  const key = process.env.SPORTSDB_KEY || '123';
  const url = `${BASE}/${key}/searchplayers.php?p=${encodeURIComponent(name)}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  } catch (e) {
    healthy = false;
    throw e;
  }
  if (!res.ok) { healthy = false; throw new Error(`TheSportsDB HTTP ${res.status}`); }

  const body = await res.json();
  healthy = true;

  // `player` is either an array or null (not found)
  const players = body?.player;
  if (!players?.length) return null;

  const targetSport = SPORT_MAP[sport] || sport;
  const match = players.find(p =>
    p.strSport?.toLowerCase() === targetSport.toLowerCase() &&
    p.strPlayer?.toLowerCase().includes(name.toLowerCase().split(' ')[0].toLowerCase())
  ) || players[0];

  if (!match) return null;

  return normalise(match, sport);
}

function normalise(p, sport) {
  const base = {
    source:   'thesportsdb',
    sport,
    name:     p.strPlayer,
    country:  p.strNationality,
    dob:      p.dateBorn,
    thumb:    p.strThumb,
    cutout:   p.strCutout,
    bio:      p.strDescriptionEN?.slice(0, 400),
    height:   p.strHeight,
    weight:   p.strWeight,
  };

  if (sport === 'cricket') {
    return {
      ...base,
      role:       p.strPosition,
      // TheSportsDB doesn't give granular cricket stats — these come from CricAPI
    };
  }

  return {
    ...base,
    role:        p.strPosition,
    // Detailed football stats come from API-Football
  };
}
