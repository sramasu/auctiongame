import { CRICKET_PLAYERS } from "../../../shared/players.cricket.js";
import { FOOTBALL_PLAYERS } from "../../../shared/players.football.js";
import { RETENTIONS, TOTAL_PURSE_CR } from "../../../shared/retentions.js";
import {
  MODES, TIER_ORDER, ROLE_SET_ORDER, ROLE_SET_NAME, SPORTS,
} from "../../../shared/constants.js";
import { shuffle } from "../../../shared/format.js";

const POOLS = { cricket: CRICKET_PLAYERS, football: FOOTBALL_PLAYERS };

export function getPool(sport) {
  return POOLS[sport] || CRICKET_PLAYERS;
}

const TIER_PREFIX = {
  MARQUEE: "Marquee",
  ELITE: "Elite",
  CORE: "Established",
  SUPPORT: "Support",
  EMERGING: "Emerging",
};

/**
 * Build the auction list: ordered "sets" of players, marquee first.
 * Returns { players: Map<id,player>, queue: [ids], sets: [{id,name,ids}] }
 */
export function buildAuctionList({ sport, mode, poolTop = 0, seed = Math.random }) {
  const all = getPool(sport).slice();
  const modeCfg = MODES[mode] || MODES.mega;
  let list = all;

  if (poolTop > 0 || (modeCfg.poolTop || 0) > 0) {
    const n = poolTop || modeCfg.poolTop;
    // Keep a spread across roles/tiers rather than a pure rating cut.
    const sorted = all.slice().sort((a, b) => b.rating - a.rating);
    const top = new Set(sorted.slice(0, n).map((p) => p.id));
    const roleOrder = ROLE_SET_ORDER[sport] || [];
    const perRole = Math.ceil(n / Math.max(1, roleOrder.length));
    for (const role of roleOrder) {
      const inRole = sorted.filter((p) => p.role === role);
      inRole.slice(0, perRole).forEach((p) => top.add(p.id));
    }
    list = all.filter((p) => top.has(p.id));
  }

  const groups = new Map();
  for (const p of list) {
    const key = `${p.tier}|${p.role}|${p.overseas ? "os" : "dom"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const tierRank = Object.fromEntries(TIER_ORDER.map((t, i) => [t, i]));
  const roleRank = Object.fromEntries((ROLE_SET_ORDER[sport] || []).map((r, i) => [r, i]));
  const keys = [...groups.keys()].sort((a, b) => {
    const [ta, ra, oa] = a.split("|");
    const [tb, rb, ob] = b.split("|");
    if (tierRank[ta] !== tierRank[tb]) return tierRank[ta] - tierRank[tb];
    if (roleRank[ra] !== roleRank[rb]) return (roleRank[ra] ?? 9) - (roleRank[rb] ?? 9);
    return oa === ob ? 0 : oa === "dom" ? -1 : 1;
  });

  const sets = [];
  const queue = [];
  keys.forEach((key, idx) => {
    const [tier, role, dom] = key.split("|");
    const members = groups.get(key).sort((a, b) => b.rating - a.rating);
    const overseas = dom === "os";
    const prefix = TIER_PREFIX[tier] || tier;
    const geo = sport === "football" ? "" : overseas ? " Overseas" : " Indian";
    const name = `${prefix}${geo} ${ROLE_SET_NAME[role] || role}`;
    const ids = members.map((p) => p.id);
    sets.push({ id: `set-${idx + 1}`, index: idx + 1, name, tier, role, overseas, ids });
    queue.push(...ids);
  });

  const players = new Map(list.map((p) => [p.id, p]));
  return { players, queue, sets, list };
}

/**
 * Retained squads for mock mode. Returns map teamId -> { entries, spentL, purseLeftL }
 */
export function buildRetentions(teamIds, playersMap, seed = Math.random) {
  const out = {};
  const used = new Set();
  const byName = new Map([...playersMap.values()].map((p) => [p.name, p]));

  for (const teamId of teamIds) {
    const rows = RETENTIONS[teamId] || [];
    const entries = [];
    let spentL = 0;
    for (const [name, salary] of rows) {
      const p = byName.get(name);
      if (!p || used.has(p.id)) continue;
      used.add(p.id);
      entries.push({ playerId: p.id, name: p.name, salaryL: salary, role: p.role, rating: p.rating, overseas: p.overseas, country: p.country, style: p.style, id: p.id });
      spentL += salary;
    }
    out[teamId] = {
      entries,
      spentL,
      purseLeftL: TOTAL_PURSE_CR * 100 - spentL,
    };
  }
  return { retentions: out, reservedIds: used };
}

export function pickTeamsFromRetentions() {
  return Object.keys(RETENTIONS);
}

export { shuffle };
