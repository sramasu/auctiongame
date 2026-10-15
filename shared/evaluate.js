// Squad evaluation shared by server (results) and client (live strength meter).
import { SPORTS } from "./constants.js";
import { clamp } from "./format.js";

const XI_SHAPES = {
  cricket: { WK: 1, BAT: 4, AR: 2, PACE: 2, SPIN: 2 },
  football: { GK: 1, DEF: 4, MID: 3, FWD: 3 },
};

// Cricket: a batter can cover for a wicket-keeper slot only if no WK available,
// all-rounders cover batting and bowling slots, etc.
function roleFit(role, slot) {
  if (role === slot) return 1;
  if (role === "AR") return 0.95;
  if (slot === "WK" && role === "BAT") return 0.6;
  if ((slot === "BAT" || slot === "AR") && role === "WK") return 0.8;
  if (slot === "BAT" && role === "AR") return 0.95;
  return 0.2;
}

/**
 * Build the strongest plausible XI from a squad.
 * @param {Array} squad player objects (must include role, rating, overseas)
 * @param {string} sport 'cricket' | 'football'
 * @param {object} opts { overseasInXI }
 */
export function bestXI(squad, sport = "cricket", opts = {}) {
  const shape = XI_SHAPES[sport] || XI_SHAPES.cricket;
  const maxOverseas = opts.overseasInXI ?? 4;
  const pool = squad.slice().sort((a, b) => b.rating - a.rating);
  const chosen = [];
  const usedIds = new Set();

  const take = (slot) => {
    let best = null;
    let bestScore = -1;
    for (const p of pool) {
      if (usedIds.has(p.id)) continue;
      const fit = roleFit(p.role, slot);
      if (fit < 0.35) continue;
      const osCount = chosen.filter((c) => c.overseas).length;
      if (p.overseas && osCount >= maxOverseas) continue;
      const score = p.rating * fit;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      chosen.push(best);
      usedIds.add(best.id);
    }
  };

  // Fill specialist slots first (scarcest), then flex slots.
  const order = sport === "cricket" ? ["WK", "SPIN", "PACE", "AR", "BAT"] : ["GK", "DEF", "MID", "FWD"];
  for (const slot of order) {
    const need = shape[slot] || 0;
    for (let i = 0; i < need; i++) take(slot);
  }
  // Backfill from whoever is left if the squad is thin.
  while (chosen.length < 11 && pool.length > chosen.length) {
    const remaining = pool.find((p) => !usedIds.has(p.id));
    if (!remaining) break;
    const osCount = chosen.filter((c) => c.overseas).length;
    if (remaining.overseas && osCount >= maxOverseas) {
      const next = pool.find((p) => !usedIds.has(p.id) && !p.overseas);
      if (!next) break;
      chosen.push(next);
      usedIds.add(next.id);
      continue;
    }
    chosen.push(remaining);
    usedIds.add(remaining.id);
  }
  return chosen.sort((a, b) => b.rating - a.rating);
}

export function roleCounts(squad) {
  const counts = {};
  for (const p of squad) counts[p.role] = (counts[p.role] || 0) + 1;
  return counts;
}

export function squadIssues(squad, settings, sport = "cricket") {
  const issues = [];
  const counts = roleCounts(squad);
  const overseas = squad.filter((p) => p.overseas).length;
  const maxOverseas = settings?.maxOverseas ?? SPORTS[sport]?.defaults?.maxOverseas ?? 8;
  const minSquad = settings?.minSquad ?? SPORTS[sport]?.defaults?.minSquad ?? 18;
  const maxSquad = settings?.maxSquad ?? SPORTS[sport]?.defaults?.maxSquad ?? 25;

  if (maxOverseas != null && overseas > maxOverseas)
    issues.push({ level: "error", text: `Overseas limit breached (${overseas}/${maxOverseas})` });
  else if (maxOverseas != null && overseas === maxOverseas)
    issues.push({ level: "warn", text: `Overseas slots full (${overseas}/${maxOverseas})` });

  if (squad.length > maxSquad) issues.push({ level: "error", text: `Squad over the ${maxSquad} player cap` });
  else if (squad.length < minSquad)
    issues.push({ level: "warn", text: `${minSquad - squad.length} more needed to reach the ${minSquad} minimum` });

  if (sport === "cricket") {
    if ((counts.WK || 0) < 1) issues.push({ level: "warn", text: "No wicket-keeper in the squad" });
    const bowlers = (counts.PACE || 0) + (counts.SPIN || 0) + (counts.AR || 0);
    if (bowlers < 6) issues.push({ level: "warn", text: "Bowling options are thin (need 6+)" });
    if ((counts.SPIN || 0) < 2) issues.push({ level: "info", text: "Only one frontline spinner" });
    if ((counts.PACE || 0) < 3) issues.push({ level: "info", text: "Pace attack looks short" });
    const batters = (counts.BAT || 0) + (counts.WK || 0);
    if (batters < 5) issues.push({ level: "warn", text: "Batting depth is short" });
  } else {
    if ((counts.GK || 0) < 2) issues.push({ level: "warn", text: "Need at least two goalkeepers" });
    if ((counts.DEF || 0) < 6) issues.push({ level: "warn", text: "Defensive cover is thin" });
    if ((counts.MID || 0) < 5) issues.push({ level: "warn", text: "Midfield is light" });
    if ((counts.FWD || 0) < 4) issues.push({ level: "warn", text: "Not enough attacking options" });
  }
  return issues;
}

/**
 * Overall squad report: rating, XI, balance, grade.
 */
export function evaluateSquad(squad, { sport = "cricket", settings = {}, purseLeftL = 0, spentL = 0 } = {}) {
  const xi = bestXI(squad, sport, { overseasInXI: settings.overseasInXI ?? SPORTS[sport]?.defaults?.overseasInXI ?? 4 });
  const xiRating = xi.length ? xi.reduce((a, p) => a + p.rating, 0) / xi.length : 0;
  const counts = roleCounts(squad);
  const overseas = squad.filter((p) => p.overseas).length;

  // Balance score: how close to the ideal role distribution (0..1)
  const ideal = sport === "cricket"
    ? { WK: 2, BAT: 7, AR: 5, PACE: 6, SPIN: 4 }
    : { GK: 3, DEF: 8, MID: 8, FWD: 6 };
  let balErr = 0;
  for (const r of Object.keys(ideal)) {
    balErr += Math.abs((counts[r] || 0) - ideal[r]) / ideal[r];
  }
  const balance = clamp(1 - balErr / Object.keys(ideal).length, 0, 1);

  // Depth rewards a fuller squad without letting hoarding dominate.
  const target = settings.minSquad ?? SPORTS[sport]?.defaults?.minSquad ?? 18;
  const depth = clamp(squad.length / target, 0, 1.15);

  const benchAvg = squad.length > xi.length
    ? squad
        .filter((p) => !xi.includes(p))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .reduce((a, p) => a + p.rating, 0) /
      Math.min(5, Math.max(1, squad.length - xi.length))
    : 0;

  const strength = xi.length ? xiRating * 0.62 + benchAvg * 0.16 + balance * 12 + depth * 8 : 0;
  const value = spentL > 0 ? (strength / spentL) * 1000 : 0;

  return {
    xi,
    xiRating,
    counts,
    overseas,
    balance,
    depth,
    strength: Math.round(strength * 10) / 10,
    value: Math.round(value * 100) / 100,
    grade: gradeFor(strength, depth),
    purseLeftL,
    spentL,
    size: squad.length,
  };
}

export function gradeFor(strength, depth = 1) {
  const s = strength * (depth < 0.7 ? 0.92 : 1);
  if (s >= 84) return "A+";
  if (s >= 79) return "A";
  if (s >= 74) return "B+";
  if (s >= 69) return "B";
  if (s >= 64) return "C+";
  if (s >= 58) return "C";
  if (s >= 50) return "D";
  return "F";
}

/**
 * Pacing advisor: what a team should be willing to spend right now so the
 * squad can still be completed before the pool runs out.
 * @returns {{ceilingL:number, slotsLeft:number, playersLeft:number, mood:string}}
 */
export function paceAdvice({ purseLeftL = 0, squadSize = 0, minSquad = 18, maxSquad = 25, playersLeft = 0, rating = 70, budgetL = 12000 }) {
  const slotsToMin = Math.max(1, minSquad - squadSize);
  const slotsToMax = Math.max(1, maxSquad - squadSize);
  const scarce = playersLeft > 0 && slotsToMin >= playersLeft * 0.8;
  const perSlot = purseLeftL / (scarce ? slotsToMax : slotsToMin);
  const qualityLift = rating >= 90 ? 2.1 : rating >= 84 ? 1.5 : rating >= 76 ? 1.1 : 0.8;
  const ceilingL = Math.max(0, Math.round((perSlot * qualityLift) / 5) * 5);
  const spentRatio = budgetL > 0 ? 1 - purseLeftL / budgetL : 0;
  const mood = scarce ? "must-fill" : spentRatio > 0.75 && slotsToMin > 6 ? "overstretched" : spentRatio > 0.45 ? "steady" : "flush";
  return { ceilingL, slotsLeft: slotsToMin, playersLeft, mood, scarce };
}

export const PACE_COPY = {
  "must-fill": "Squad is thin — you may need to overpay to fill it.",
  overstretched: "Purse is tight. Only chase names you really need.",
  steady: "Pacing looks healthy for the slots you still need.",
  flush: "Plenty of purse left — you can afford to be picky.",
};

export const GRADE_COLOR = {
  "A+": "#22c55e", A: "#4ade80", "B+": "#a3e635", B: "#eab308",
  "C+": "#f97316", C: "#fb923c", D: "#ef4444", F: "#b91c1c",
};
