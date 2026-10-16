import { buildAuctionList, buildRetentions } from "./pool.js";
import { emitRoom } from "./bus.js";
import { evaluateSquad, roleCounts } from "../../../shared/evaluate.js";
import {
  incrementFor, nextBid, normalizeBid, COMMENTARY, SPORTS, TIER_ORDER,
} from "../../../shared/constants.js";
import { clamp, pickOne, shuffle } from "../../../shared/format.js";

let feedSeq = 1;

// After this many bids the auctioneer stops extending the clock.
export const MAX_EXTENSIONS = 14;

export function pushFeed(room, type, text, extra = {}) {
  const item = { id: feedSeq++, type, text, at: Date.now(), ...extra };
  room.feed.push(item);
  if (room.feed.length > 200) room.feed.splice(0, room.feed.length - 200);
  emitRoom(room, "feed", item);
  return item;
}

export function pushChat(room, from, text, meta = {}) {
  const item = { id: feedSeq++, from, text: String(text).slice(0, 300), at: Date.now(), ...meta };
  room.chat.push(item);
  if (room.chat.length > 200) room.chat.splice(0, room.chat.length - 200);
  emitRoom(room, "chat", item);
  return item;
}

export function pushReaction(room, participantId, emoji) {
  const p = room.participants.find((x) => x.id === participantId);
  const item = { id: feedSeq++, emoji, from: p?.name || "Guest", teamId: p?.teamId || null, at: Date.now() };
  room.reactions.push(item);
  if (room.reactions.length > 40) room.reactions.shift();
  emitRoom(room, "reaction", item);
  return item;
}

// ────────────────────────────────────────────────────────────────────────────
// Auction preparation
// ────────────────────────────────────────────────────────────────────────────

export function prepareAuction(room) {
  const s = room.settings;
  const built = buildAuctionList({ sport: s.sport, mode: s.mode, poolTop: Number(s.poolTop) || 0 });
  room.playersMap = new Map(built.players);
  room.sets = built.sets;

  const ownerTeams = Object.values(room.teams).filter((t) => t.ownerId);
  const useRetentions = !!s.retentions && s.sport === "cricket";
  const retentionData = useRetentions
    ? buildRetentions(ownerTeams.map((t) => t.id), room.playersMap)
    : { retentions: {}, reservedIds: new Set() };

  // Retained players stay visible to clients but leave the bidding queue.
  for (const [, info] of Object.entries(retentionData.retentions)) {
    for (const entry of info.entries) {
      if (!room.playersMap.has(entry.playerId)) room.playersMap.set(entry.playerId, entry);
    }
  }

  const budgetL = Math.round(s.budgetCr * 100);
  for (const t of Object.values(room.teams)) {
    const info = retentionData.retentions[t.id];
    t.retentions = info ? info.entries : [];
    t.purseLeftL = useRetentions && info ? info.purseLeftL : budgetL;
    t.spentL = 0;
    t.squad = info ? info.entries.map((e) => e.playerId) : [];
    t.rtmLeft = Number(s.rtmCards) || 0;
    t.autoBidL = null;
    t.passed = false;
    t.bids = 0;
    t.wins = 0;
  }

  room.queue = built.queue.filter((id) => !retentionData.reservedIds.has(id));
  room.playersList = [...room.playersMap.values()];
  room.index = 0;
  room.sold = [];
  room.unsold = [];
  room.passed = [];
  room.history = [];
  room.results = null;
  room.botPlans = {};
  room.current = null;

  // Build bot wish-lists so different owners chase different players.
  for (const p of room.participants.filter((x) => x.isBot && x.teamId)) {
    const list = shuffle(room.queue).slice(0, Math.max(18, Math.round(room.queue.length * 0.12)));
    p.wishlist = new Set(list);
    p.botSeed = Math.random();
  }
  return room;
}

export function startAuction(room) {
  if (!room.queue.length) prepareAuction(room);
  room.status = "live";
  room.paused = false;
  room.index = 0;
  pushFeed(room, "system", `The auction is live — ${room.queue.length} names across ${room.sets.length} sets. Purse ${room.settings.budgetCr} Cr per table.`);
  emitRoom(room, "start", {});
  openPlayer(room, 0);
}

// ────────────────────────────────────────────────────────────────────────────
// Player flow
// ────────────────────────────────────────────────────────────────────────────

function setForIndex(room, idx) {
  const playerId = room.queue[idx];
  const set = room.sets.find((s) => s.ids.includes(playerId));
  return set || null;
}

export function openPlayer(room, idx) {
  if (idx >= room.queue.length) {
    room.index = room.queue.length;
    room.current = null;
    emitRoom(room, "queue-end", {});
    finishIfDone(room);
    return;
  }
  room.index = idx;
  const playerId = room.queue[idx];
  const player = room.playersMap.get(playerId);
  const set = setForIndex(room, idx);
  if (!player) return openPlayer(room, idx + 1);

  for (const t of Object.values(room.teams)) t.passed = false;

  room.current = {
    playerId,
    setName: set ? set.name : "Auction",
    setId: set ? set.id : null,
    setIndex: set ? set.index : null,
    queueIndex: idx,
    phase: room.settings.introSeconds > 0 ? "intro" : "open",
    bidL: player.base,
    leaderId: null,
    history: [],
    passes: [],
    startedAt: Date.now(),
    openedAt: null,
    endsAt: Date.now() + room.settings.introSeconds * 1000,
    rtmDeadline: null,
    rtmBy: null,
    result: null,
    bidCount: 0,
  };
  room.botPlans = {};
  emitRoom(room, "player", { playerId, setName: room.current.setName, index: idx, total: room.queue.length });
  if (room.current.phase === "open") openBidding(room);
}

function openBidding(room) {
  const cur = room.current;
  if (!cur) return;
  const player = room.playersMap.get(cur.playerId);
  cur.phase = "bidding";
  cur.openedAt = Date.now();
  cur.endsAt = Date.now() + room.settings.bidSeconds * 1000;
  pushFeed(room, "open", fill(COMMENTARY.open, {
    name: player.name, base: money(player.base), style: player.style, country: player.country, role: player.role,
  }), { playerId: cur.playerId });
  planBots(room);
  emitRoom(room, "phase", { phase: cur.phase, endsAt: cur.endsAt });
}

export function money(l) {
  if (l == null) return "—";
  return l >= 100 ? `₹${(l / 100).toFixed(2).replace(/\.?0+$/, "")} Cr` : `₹${l} L`;
}

function fill(tpl, vars) {
  return pickOne(tpl).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// ────────────────────────────────────────────────────────────────────────────
// Bidding
// ────────────────────────────────────────────────────────────────────────────

export function canBid(room, team, player, amountL) {
  const cur = room.current;
  if (!cur || cur.phase !== "bidding") return { ok: false, reason: "Not open for bidding" };
  if (!team) return { ok: false, reason: "Pick a franchise first" };
  if (team.ownerId == null) return { ok: false, reason: "This franchise has no owner" };
  if (cur.leaderId === team.id) return { ok: false, reason: "You are already the highest bidder" };
  if (team.passed) return { ok: false, reason: "You passed on this player" };
  if (amountL <= cur.bidL) return { ok: false, reason: `Bid must beat ${money(cur.bidL)}` };
  if (amountL > team.purseLeftL) return { ok: false, reason: "Not enough purse left" };
  const s = room.settings;
  if (team.squad.length >= s.maxSquad) return { ok: false, reason: `Squad is full (${s.maxSquad})` };
  const maxOs = s.maxOverseas;
  if (maxOs != null && player.overseas) {
    const osCount = countOverseas(room, team);
    if (osCount >= maxOs) return { ok: false, reason: `Overseas limit reached (${maxOs})` };
  }
  return { ok: true };
}

export function countOverseas(room, team) {
  const ids = team.squad;
  let n = 0;
  for (const id of ids) {
    const p = room.playersMap.get(id);
    if (p?.overseas) n++;
  }
  for (const r of team.retentions || []) if (r.overseas) n++;
  return n;
}

export function placeBid(room, participantId, requestedAmount, opts = {}) {
  const p = room.participants.find((x) => x.id === participantId);
  if (!p || !p.teamId) return { ok: false, reason: "No franchise" };
  const team = room.teams[p.teamId];
  const cur = room.current;
  if (!cur) return { ok: false, reason: "No player up" };
  const player = room.playersMap.get(cur.playerId);
  const min = nextBid(cur.bidL);
  const amount = normalizeBid(Math.max(requestedAmount ?? min, min));
  const check = canBid(room, team, player, amount);
  if (!check.ok) return check;

  cur.bidL = amount;
  cur.leaderId = team.id;
  cur.bidCount++;
  cur.history.push({ teamId: team.id, amountL: amount, at: Date.now(), by: opts.byBot ? "bot" : "human" });
  team.bids = (team.bids || 0) + 1;

  // Anti-snipe: give the table a fair window to respond, but taper it so a
  // long war always converges instead of resetting forever.
  const now = Date.now();
  const base = room.settings.resetSeconds * 1000;
  const taper = Math.max(0.45, 1 - (cur.bidCount - 1) * 0.055);
  const resetMs = cur.bidCount >= MAX_EXTENSIONS ? 0 : Math.max(2000, base * taper);
  if (resetMs > 0 && cur.endsAt - now < resetMs) cur.endsAt = now + resetMs;
  else if (resetMs === 0 && cur.endsAt - now > 2500) cur.endsAt = now + 2500; // final call

  pushFeed(room, "bid", fill(cur.bidCount > 6 ? COMMENTARY.war : COMMENTARY.bid, {
    team: team.name, amount: money(amount), name: player.name,
    t1: team.name, t2: rivalName(room, cur),
  }), { teamId: team.id, amountL: amount, playerId: cur.playerId });

  emitRoom(room, "bid", {
    teamId: team.id, amountL: amount, playerId: cur.playerId, leaderId: team.id,
    endsAt: cur.endsAt, bidCount: cur.bidCount, name: p.name, byBot: !!opts.byBot,
  });
  return { ok: true, amount, teamId: team.id };
}

function rivalName(room, cur) {
  const rivals = [...new Set(cur.history.map((h) => h.teamId))].filter((t) => t !== cur.leaderId);
  return room.teams[rivals[rivals.length - 1]]?.name || "the table";
}

export function passOnPlayer(room, participantId) {
  const p = room.participants.find((x) => x.id === participantId);
  if (!p || !p.teamId) return { ok: false };
  const team = room.teams[p.teamId];
  if (room.current?.phase !== "bidding") return { ok: false };
  team.passed = true;
  room.current.passes.push(team.id);
  emitRoom(room, "pass", { teamId: team.id, playerId: room.current.playerId });
  return { ok: true };
}

export function setAutoBid(room, participantId, maxL) {
  const p = room.participants.find((x) => x.id === participantId);
  if (!p || !p.teamId) return { ok: false };
  const team = room.teams[p.teamId];
  const v = Number(maxL);
  team.autoBidL = !v || v <= 0 || Number.isNaN(v) ? null : Math.min(normalizeBid(v), team.purseLeftL);
  emitRoom(room, "autobid", { teamId: team.id, maxL: team.autoBidL });
  return { ok: true, maxL: team.autoBidL };
}

// ────────────────────────────────────────────────────────────────────────────
// Timer / phases
// ────────────────────────────────────────────────────────────────────────────

export function tickRoom(room, now) {
  if (room.status !== "live" || room.paused) return;
  const cur = room.current;
  if (!cur) return;

  if (cur.phase === "bidding") {
    botAct(room, now);
    autoBidAct(room, now);
    if (now >= cur.endsAt) {
      cur.phase = "hammer";
      cur.endsAt = now + room.settings.hammerSeconds * 1000;
      cur.hammerStart = now;
      pushFeed(room, "hammer", cur.leaderId
        ? `Going once at ${money(cur.bidL)} to ${room.teams[cur.leaderId].name}...`
        : `Last call for ${room.playersMap.get(cur.playerId).name} at ${money(cur.bidL)}...`);
      emitRoom(room, "phase", { phase: "hammer", endsAt: cur.endsAt, leaderId: cur.leaderId, bidL: cur.bidL });
    }
    return;
  }

  if (cur.phase === "intro" && now >= cur.endsAt) {
    openBidding(room);
    return;
  }

  if (cur.phase === "hammer" && now >= cur.endsAt) {
    resolveHammer(room);
    return;
  }

  if (cur.phase === "rtm" && now >= cur.endsAt) {
    finalizeSale(room, cur.leaderId, cur.bidL, null);
    return;
  }

  if ((cur.phase === "sold" || cur.phase === "unsold") && now >= cur.endsAt) {
    const nextIdx = cur.queueIndex + 1;
    if (room.settings.autoNext) openPlayer(room, nextIdx);
    else { room.current = null; emitRoom(room, "phase", { phase: "waiting" }); }
  }
}

function resolveHammer(room) {
  const cur = room.current;
  const player = room.playersMap.get(cur.playerId);
  if (!cur.leaderId) {
    cur.phase = "unsold";
    cur.endsAt = Date.now() + room.settings.nextDelaySeconds * 1000;
    room.unsold.push(cur.playerId);
    pushFeed(room, "unsold", fill(COMMENTARY.unsold, { name: player.name, base: money(player.base) }), { playerId: cur.playerId });
    emitRoom(room, "unsold", { playerId: cur.playerId, player: publicPlayer(player) });
    return;
  }

  // Right-To-Match window: other owners with cards left can steal him back.
  if (room.settings.rtmCards > 0) {
    const eligible = Object.values(room.teams).filter((t) =>
      t.id !== cur.leaderId && t.rtmLeft > 0 && t.squad.length < room.settings.maxSquad &&
      t.purseLeftL >= cur.bidL && !blockedByOverseas(room, t, player));
    if (eligible.length) {
      cur.phase = "rtm";
      cur.rtmDeadline = Date.now() + room.settings.rtmWindowSeconds * 1000;
      cur.endsAt = cur.rtmDeadline;
      cur.rtmEligible = eligible.map((t) => t.id);
      pushFeed(room, "rtm-window", `Right-To-Match window open — ${eligible.map((t) => t.name).join(", ")} can match ${money(cur.bidL)}.`, { playerId: cur.playerId });
      emitRoom(room, "phase", { phase: "rtm", endsAt: cur.endsAt, rtmEligible: cur.rtmEligible, bidL: cur.bidL });
      // bots sometimes use RTM
      scheduleBotRtm(room, eligible, player);
      return;
    }
  }
  finalizeSale(room, cur.leaderId, cur.bidL, null);
}

function blockedByOverseas(room, team, player) {
  const maxOs = room.settings.maxOverseas;
  if (maxOs == null || !player.overseas) return false;
  return countOverseas(room, team) >= maxOs;
}

function scheduleBotRtm(room, eligible, player) {
  const cur = room.current;
  cur.rtmBotPlanned = [];
  for (const team of eligible) {
    const owner = room.participants.find((p) => p.teamId === team.id);
    if (!owner?.isBot) continue;
    const ceiling = botCeiling(room, owner, team, player);
    const want = ceiling >= cur.bidL * 1.02 && Math.random() < (owner.style === "collector" ? 0.55 : 0.3);
    if (want) cur.rtmBotPlanned.push({ teamId: team.id, at: Date.now() + 1200 + Math.random() * (room.settings.rtmWindowSeconds * 700) });
  }
}

export function useRTM(room, participantId) {
  const cur = room.current;
  if (!cur || cur.phase !== "rtm") return { ok: false, reason: "No RTM window open" };
  const p = room.participants.find((x) => x.id === participantId);
  if (!p || !p.teamId) return { ok: false, reason: "No franchise" };
  return applyRTM(room, p.teamId);
}

export function applyRTM(room, teamId) {
  const cur = room.current;
  const team = room.teams[teamId];
  const player = room.playersMap.get(cur.playerId);
  if (!team || !player) return { ok: false };
  if (team.id === cur.leaderId) return { ok: false, reason: "You already won the bid" };
  if ((team.rtmLeft || 0) <= 0) return { ok: false, reason: "No RTM cards left" };
  if (team.purseLeftL < cur.bidL) return { ok: false, reason: "Not enough purse" };
  if (team.squad.length >= room.settings.maxSquad) return { ok: false, reason: "Squad full" };
  if (blockedByOverseas(room, team, player)) return { ok: false, reason: "Overseas limit" };

  const previousLeader = cur.leaderId;
  team.rtmLeft -= 1;
  cur.rtmBy = team.id;
  cur.leaderId = team.id;
  pushFeed(room, "rtm", fill(COMMENTARY.rtm, { team: team.name, name: player.name, amount: money(cur.bidL) }), { teamId: team.id, playerId: cur.playerId, amountL: cur.bidL });
  emitRoom(room, "rtm", { teamId: team.id, previousLeader, playerId: cur.playerId, amountL: cur.bidL, rtmLeft: team.rtmLeft });
  finalizeSale(room, team.id, cur.bidL, { rtm: true, previousLeader });
  return { ok: true };
}

function finalizeSale(room, teamId, amountL, meta) {
  const cur = room.current;
  const player = room.playersMap.get(cur.playerId);
  const team = room.teams[teamId];
  if (!team || !player) return;

  team.purseLeftL -= amountL;
  team.spentL += amountL;
  team.squad.push(player.id);
  team.wins = (team.wins || 0) + 1;
  if (meta?.previousLeader) {
    // refund the out-bid winner's commitment (nothing was deducted yet) - no-op, kept for clarity
  }

  const record = {
    playerId: player.id, teamId: team.id, amountL, at: Date.now(),
    setName: cur.setName, base: player.base, rating: player.rating, role: player.role,
    name: player.name, overseas: player.overseas, country: player.country,
    rtm: !!meta?.rtm, bidCount: cur.bidCount, queueIndex: cur.queueIndex,
  };
  room.sold.push(record);
  room.history.push({ type: "sale", record });

  const fair = player.base * (0.9 + clamp((player.rating - 58) / 38, 0, 1) * 5.5);
  let kind = "sold";
  if (amountL <= fair * 0.6) { kind = "steal"; pushFeed(room, "steal", fill(COMMENTARY.steal, { team: team.name, name: player.name, amount: money(amountL) }), { teamId: team.id, playerId: player.id, amountL }); }
  else if (amountL >= fair * 1.45) { kind = "splash"; pushFeed(room, "splash", fill(COMMENTARY.splash, { team: team.name, name: player.name, amount: money(amountL) }), { teamId: team.id, playerId: player.id, amountL }); }
  else pushFeed(room, "sold", fill(COMMENTARY.sold, { team: team.name, name: player.name, amount: money(amountL) }), { teamId: team.id, playerId: player.id, amountL });

  cur.phase = "sold";
  cur.result = { teamId, amountL, at: Date.now(), rtm: !!meta?.rtm };
  cur.endsAt = Date.now() + room.settings.nextDelaySeconds * 1000;
  emitRoom(room, "sold", { record, kind, player: publicPlayer(player), teamName: team.name, nextAt: cur.endsAt });
}

export function publicPlayer(p) {
  if (!p) return null;
  return { id: p.id, name: p.name, country: p.country, role: p.role, base: p.base, rating: p.rating, style: p.style, overseas: p.overseas, tier: p.tier };
}

// ────────────────────────────────────────────────────────────────────────────
// Host controls
// ────────────────────────────────────────────────────────────────────────────

export function pauseAuction(room, paused) {
  room.paused = !!paused;
  if (!paused && room.current && room.current.phase === "bidding") {
    room.current.endsAt = Date.now() + Math.max(3000, room.current.endsAt - (room.pauseEndsAt || Date.now()));
  }
  if (paused) room.pauseStart = Date.now(); else room.pauseEndsAt = Date.now();
  pushFeed(room, "system", paused ? "Auction paused by the host." : "Auction resumed.");
  emitRoom(room, "phase", { phase: room.current?.phase, paused: room.paused });
}

export function skipPlayer(room) {
  const cur = room.current;
  if (!cur) return;
  if (cur.phase !== "sold" && cur.phase !== "unsold") {
    if (cur.playerId && !room.unsold.includes(cur.playerId) && !room.sold.some((s) => s.playerId === cur.playerId)) {
      room.passed.push(cur.playerId);
      pushFeed(room, "system", `${room.playersMap.get(cur.playerId)?.name} moved to the passed list.`);
    }
  }
  openPlayer(room, cur.queueIndex + 1);
}

export function undoLastSale(room) {
  const last = [...room.history].reverse().find((h) => h.type === "sale");
  if (!last) return { ok: false, reason: "Nothing to undo" };
  const { record } = last;
  const team = room.teams[record.teamId];
  if (team) {
    team.purseLeftL += record.amountL;
    team.spentL -= record.amountL;
    team.squad = team.squad.filter((id) => id !== record.playerId);
    team.wins = Math.max(0, (team.wins || 1) - 1);
  }
  room.sold = room.sold.filter((s) => s !== record);
  room.history = room.history.filter((h) => h !== last);
  pushFeed(room, "system", `Undo: ${record.name} returned to the pool (${money(record.amountL)} back to ${team?.name || "team"}).`);
  emitRoom(room, "undo", { playerId: record.playerId });
  return { ok: true, record };
}

export function startAccelerated(room) {
  if (!room.unsold.length) return { ok: false, reason: "No unsold players" };
  const list = shuffle(room.unsold.slice());
  room.unsold = [];
  room.queue = list;
  room.sets = [{ id: "accelerated", index: 1, name: "Accelerated Round", ids: list, tier: "ACCEL", role: "ALL", overseas: false }];
  room.settings.bidSeconds = Math.max(6, Math.round(room.settings.bidSeconds * 0.6));
  room.settings.resetSeconds = Math.max(4, Math.round(room.settings.resetSeconds * 0.6));
  room.settings.autoNext = true;
  room.status = "live";
  room.results = null;
  pushFeed(room, "system", `Accelerated round: ${list.length} unsold names, faster timers.`);
  emitRoom(room, "accelerated", { count: list.length });
  openPlayer(room, 0);
  return { ok: true, count: list.length };
}

export function replayPassed(room) {
  if (!room.passed.length) return { ok: false };
  const list = room.passed.slice();
  room.passed = [];
  room.queue = [...room.queue.slice(room.index + 1), ...list];
  pushFeed(room, "system", `${list.length} passed names added back to the queue.`);
  emitRoom(room, "queue-updated", { total: room.queue.length });
  return { ok: true, count: list.length };
}

export function finishIfDone(room) {
  if (room.index < room.queue.length) return;
  if (room.current) return;
  room.results = computeResults(room);
  room.status = "done";
  pushFeed(room, "system", "That is a wrap — the auctioneer closes the book.");
  emitRoom(room, "results", room.results);
}

export function finishAuction(room) {
  room.current = null;
  room.index = room.queue.length;
  room.results = computeResults(room);
  room.status = "done";
  emitRoom(room, "results", room.results);
  return room.results;
}

// ────────────────────────────────────────────────────────────────────────────
// Bots
// ────────────────────────────────────────────────────────────────────────────

const STYLE_DELAY = {
  aggressive: [250, 900],
  collector: [400, 1400],
  balanced: [700, 2200],
  shrewd: [1200, 3000],
  frugal: [1500, 3800],
};

const IDEAL_MIX = {
  cricket: { WK: 2, BAT: 7, AR: 5, PACE: 6, SPIN: 4 },
  football: { GK: 3, DEF: 8, MID: 8, FWD: 6 },
};

function fullSquad(room, team) {
  const players = [];
  for (const id of team.squad) {
    const p = room.playersMap.get(id);
    if (p) players.push(p);
  }
  for (const r of team.retentions || []) players.push(r);
  return players;
}

function roleNeed(room, team, role) {
  const squad = fullSquad(room, team);
  const counts = roleCounts(squad);
  const ideal = IDEAL_MIX[room.sport] || IDEAL_MIX.cricket;
  let have = counts[role] || 0;
  if (room.sport === "cricket") {
    if (role === "BAT") have += (counts.AR || 0) * 0.5 + (counts.WK || 0) * 0.6;
    if (role === "PACE" || role === "SPIN") have += (counts.AR || 0) * 0.35;
    if (role === "AR") have += Math.min(counts.BAT || 0, 2) * 0.15;
  } else if (role === "MID") have += (counts.FWD || 0) * 0.2;
  const target = ideal[role] || 4;
  return clamp(1 + ((target - have) / target) * 0.85, 0.45, 1.7);
}

function urgency(room, team) {
  const remaining = Math.max(1, room.queue.length - room.index);
  const slotsLeft = Math.max(0, room.settings.maxSquad - fullSquad(room, team).length);
  const minLeft = Math.max(0, room.settings.minSquad - fullSquad(room, team).length);
  if (minLeft >= remaining) return 1.85;
  if (slotsLeft >= remaining * 0.8) return 1.4;
  if (minLeft > remaining * 0.5) return 1.25;
  return 1;
}

export function botCeiling(room, bot, team, player) {
  const s = room.settings;
  const diff = s.bots?.difficulty === "easy" ? 0.78 : s.bots?.difficulty === "insane" ? 1.3 : 1;
  const quality = clamp((player.rating - 58) / 38, 0, 1);
  const fair = player.base * (0.9 + quality * 5.5);
  const styleMul = { aggressive: 1.35, collector: 1.28, balanced: 1.0, shrewd: 0.94, frugal: 0.72 }[bot.style || "balanced"] ?? 1;
  const wish = bot.wishlist?.has(player.id) ? 1.45 : 1;
  const need = roleNeed(room, team, player.role);
  const urg = urgency(room, team);
  let ceiling = fair * need * styleMul * wish * diff * urg;
  const capRatio = player.rating >= 90 ? 0.6 : player.rating >= 84 ? 0.45 : 0.32;
  ceiling = Math.min(ceiling, team.purseLeftL * capRatio + player.base * 1.2);
  ceiling = Math.min(ceiling, team.purseLeftL);
  return Math.max(player.base, Math.floor(ceiling / 5) * 5);
}

function planBots(room) {
  const cur = room.current;
  if (!cur) return;
  const player = room.playersMap.get(cur.playerId);
  const now = Date.now();
  room.botPlans = {};
  for (const bot of room.participants.filter((p) => p.isBot && p.teamId)) {
    const team = room.teams[bot.teamId];
    if (!team || team.purseLeftL < player.base) continue;
    if (blockedByOverseas(room, team, player)) continue;
    if (team.squad.length >= room.settings.maxSquad) continue;
    const ceiling = botCeiling(room, bot, team, player);
    if (ceiling < nextBid(player.base)) continue;
    const appeal = clamp((ceiling - player.base) / Math.max(1, ceiling) + (bot.wishlist?.has(player.id) ? 0.25 : 0), 0, 1);
    const engageChance = bot.style === "frugal" ? 0.45 : bot.style === "aggressive" ? 0.85 : 0.65;
    if (Math.random() > appeal * engageChance + 0.06) continue;
    const [lo, hi] = STYLE_DELAY[bot.style] || STYLE_DELAY.balanced;
    const delay = lo + Math.random() * (hi - lo);
    const shrewdWait = bot.style === "shrewd" ? Math.max(delay, room.settings.bidSeconds * 1000 - 2600 - Math.random() * 900) : delay;
    room.botPlans[bot.id] = { ceiling, nextAt: now + shrewdWait, engaged: false, style: bot.style };
  }
}

function botAct(room, now) {
  const cur = room.current;
  if (!cur || cur.phase !== "bidding") return;
  for (const bot of room.participants.filter((p) => p.isBot && p.teamId)) {
    const plan = room.botPlans[bot.id];
    if (!plan) continue;
    if (now < plan.nextAt) continue;
    const team = room.teams[bot.teamId];
    const player = room.playersMap.get(cur.playerId);
    if (cur.leaderId === team.id) { delete room.botPlans[bot.id]; continue; }
    if (team.passed) { delete room.botPlans[bot.id]; continue; }
    const amount = nextBid(cur.bidL);
    const remaining = cur.endsAt - now;
    const headroom = amount / Math.max(1, plan.ceiling);
    if (amount > plan.ceiling || amount > team.purseLeftL) { delete room.botPlans[bot.id]; continue; }
    // Cold feet as the price closes in on what the bot thinks he is worth.
    if (headroom > 0.82 && Math.random() < (headroom - 0.82) * 2.6) { delete room.botPlans[bot.id]; continue; }
    const pressure = remaining < 2500 ? 1 : remaining < 6000 ? 0.8 : 0.6;
    if (Math.random() > pressure * (plan.engaged ? 0.94 : 0.86)) {
      const [lo, hi] = STYLE_DELAY[plan.style] || STYLE_DELAY.balanced;
      const think = plan.style === "shrewd"
        ? Math.max(400, remaining * (0.35 + Math.random() * 0.4))
        : lo + Math.random() * (hi - lo);
      plan.nextAt = Math.min(now + think, cur.endsAt - 120);
      continue;
    }
    plan.engaged = true;
    const res = placeBid(room, bot.id, amount, { byBot: true });
    const [lo, hi] = STYLE_DELAY[plan.style] || STYLE_DELAY.balanced;
    plan.nextAt = now + lo + Math.random() * (hi - lo);
    if (!res.ok) delete room.botPlans[bot.id];
  }

  // Bot RTM usage
  if (cur.rtmBotPlanned?.length) {
    for (const plan of cur.rtmBotPlanned) {
      if (plan.done) continue;
      if (now >= plan.at) {
        plan.done = true;
        applyRTM(room, plan.teamId);
        return;
      }
    }
  }
}

function autoBidAct(room, now) {
  const cur = room.current;
  if (!cur || cur.phase !== "bidding") return;
  for (const team of Object.values(room.teams)) {
    if (!team.autoBidL || !team.ownerId) continue;
    if (cur.leaderId === team.id) continue;
    if (team.passed) continue;
    const amount = nextBid(cur.bidL);
    if (amount > team.autoBidL || amount > team.purseLeftL) { team.autoBidL = null; continue; }
    if (team.autoNextAt == null) team.autoNextAt = now + 600 + Math.random() * 900;
    if (now < team.autoNextAt) continue;
    const player = room.playersMap.get(cur.playerId);
    const res = placeBid(room, team.ownerId, amount, { byBot: false, auto: true });
    team.autoNextAt = now + 900 + Math.random() * 700;
    if (!res.ok) team.autoBidL = null;
    if (player && res.ok && res.amount > team.autoBidL) team.autoBidL = null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Results
// ────────────────────────────────────────────────────────────────────────────

export function computeResults(room) {
  const teams = Object.values(room.teams)
    .filter((t) => t.ownerId)
    .map((t) => {
      const owner = room.participants.find((p) => p.id === t.ownerId);
      const squad = fullSquad(room, t);
      const report = evaluateSquad(squad, {
        sport: room.sport,
        settings: room.settings,
        purseLeftL: t.purseLeftL,
        spentL: t.spentL + (t.retentions || []).reduce((a, r) => a + r.salaryL, 0),
      });
      return {
        teamId: t.id,
        name: t.name,
        short: t.short,
        glyph: t.glyph,
        primary: t.primary,
        secondary: t.secondary,
        accent: t.accent,
        owner: owner ? { id: owner.id, name: owner.name, isBot: owner.isBot } : null,
        purseLeftL: t.purseLeftL,
        spentL: t.spentL,
        retentionL: (t.retentions || []).reduce((a, r) => a + r.salaryL, 0),
        size: squad.length,
        purchases: room.sold.filter((s) => s.teamId === t.id),
        squad: squad.map((p) => ({ id: p.id, name: p.name, role: p.role, rating: p.rating, overseas: p.overseas, country: p.country, style: p.style, base: p.base })),
        xi: report.xi.map((p) => ({ id: p.id, name: p.name, role: p.role, rating: p.rating, overseas: p.overseas, country: p.country })),
        strength: report.strength,
        grade: report.grade,
        value: report.value,
        balance: report.balance,
        counts: report.counts,
        overseas: report.overseas,
        rtmUsed: (Number(room.settings.rtmCards) || 0) - (t.rtmLeft || 0),
        issues: [],
      };
    })
    .sort((a, b) => b.strength - a.strength);

  const allSales = room.sold.slice().sort((a, b) => b.amountL - a.amountL);
  const biggest = allSales[0] || null;
  const steals = room.sold
    .map((s) => {
      const p = room.playersMap.get(s.playerId);
      const fair = p ? p.base * (0.9 + clamp((p.rating - 58) / 38, 0, 1) * 5.5) : s.amountL;
      return { ...s, margin: fair - s.amountL, fair };
    })
    .sort((a, b) => b.margin - a.margin);
  const mostActive = teams.slice().sort((a, b) => b.purchases.length - a.purchases.length)[0] || null;
  const purseMaster = teams.filter((t) => t.size >= room.settings.minSquad).sort((a, b) => b.purseLeftL - a.purseLeftL)[0] || null;
  const totalSpend = room.sold.reduce((a, s) => a + s.amountL, 0);

  return {
    at: Date.now(),
    sport: room.sport,
    mode: room.mode,
    standings: teams,
    awards: {
      champion: teams[0] || null,
      biggestSplash: biggest ? { ...biggest, playerName: room.playersMap.get(biggest.playerId)?.name } : null,
      steal: steals[0] ? { ...steals[0], playerName: room.playersMap.get(steals[0].playerId)?.name, teamName: room.teams[steals[0].teamId]?.name } : null,
      mostActive: mostActive ? { teamId: mostActive.teamId, name: mostActive.name, count: mostActive.purchases.length } : null,
      purseMaster: purseMaster ? { teamId: purseMaster.teamId, name: purseMaster.name, purseLeftL: purseMaster.purseLeftL } : null,
      valueKing: teams.slice().sort((a, b) => b.value - a.value)[0] || null,
    },
    totals: {
      sold: room.sold.length,
      unsold: room.unsold.length,
      spendL: totalSpend,
      avgL: room.sold.length ? Math.round(totalSpend / room.sold.length) : 0,
      highestL: biggest ? biggest.amountL : 0,
    },
  };
}
