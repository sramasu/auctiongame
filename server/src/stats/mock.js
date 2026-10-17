/**
 * stats/mock.js — offline mock provider.
 *
 * Returns plausible-looking stat stubs for any player so the game always
 * works even when no real API keys are configured.  The numbers are generated
 * from the player's built-in `rating` value so results are deterministic and
 * internally consistent.
 */

/** @param {object} player — a player record from the shared pool */
export function mockStats(player) {
  if (!player) return null;
  const r = player.rating ?? 70;
  const sport = player.sport ?? (player.role?.match(/GK|DEF|MID|FWD/) ? 'football' : 'cricket');

  if (sport === 'cricket') {
    const isBat  = ['BAT', 'WK', 'AR'].includes(player.role);
    const isBowl = ['PACE', 'SPIN', 'AR'].includes(player.role);
    return {
      source:     'mock',
      sport:      'cricket',
      name:       player.name,
      country:    player.country,
      role:       player.role,
      // Batting
      matches:    isBat  ? Math.round(r * 1.8 + 20) : Math.round(r * 0.6 + 5),
      innings:    isBat  ? Math.round(r * 1.5 + 15) : Math.round(r * 0.4 + 3),
      runs:       isBat  ? Math.round(r * 38 - 900)  : Math.round(r * 5),
      average:    isBat  ? +(r * 0.52 - 5).toFixed(1): null,
      strikeRate: isBat  ? +(r * 1.4 + 5).toFixed(1) : null,
      hundreds:   isBat  ? Math.max(0, Math.round(r * 0.18 - 9)) : null,
      fifties:    isBat  ? Math.max(0, Math.round(r * 0.28 - 10)): null,
      // Bowling
      wickets:    isBowl ? Math.round(r * 2.2 - 70) : null,
      economy:    isBowl ? +(10 - r * 0.035).toFixed(2) : null,
      bowlAvg:    isBowl ? +(42 - r * 0.22).toFixed(1)  : null,
      fiveFor:    isBowl ? Math.max(0, Math.round(r * 0.07 - 4)) : null,
    };
  }

  // football
  const isGK  = player.role === 'GK';
  const isDEF = player.role === 'DEF';
  const isMID = player.role === 'MID';
  const isFWD = player.role === 'FWD';
  return {
    source:       'mock',
    sport:        'football',
    name:         player.name,
    country:      player.country,
    role:         player.role,
    appearances:  Math.round(r * 2.8 - 50),
    goals:        isFWD ? Math.round(r * 1.1 - 35) : isMID ? Math.round(r * 0.4 - 10) : Math.round(r * 0.05),
    assists:      isFWD || isMID ? Math.round(r * 0.35 - 8) : Math.round(r * 0.08),
    cleanSheets:  isGK || isDEF ? Math.round(r * 0.55 - 15) : null,
    yellowCards:  Math.round(r * 0.1),
    redCards:     Math.max(0, Math.round(r * 0.01 - 0.3)),
    passAccuracy: +(r * 0.4 + 45).toFixed(1),
  };
}
