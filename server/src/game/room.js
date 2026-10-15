import { TEAMS, TEAM_BY_ID, ALL_TEAMS } from "../../../shared/teams.js";
import {
  DEFAULT_SETTINGS, MODES, SPORTS, MAX_HUMAN_PLAYERS, MAX_ROOM_PLAYERS,
} from "../../../shared/constants.js";
import { buildAuctionList, buildRetentions, getPool } from "./pool.js";
import { clamp } from "../../../shared/format.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const rooms = new Map();

export function makeCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

export function uniqueCode() {
  let code = makeCode();
  let guard = 0;
  while (rooms.has(code) && guard++ < 50) code = makeCode();
  return code;
}

export function makeId(prefix = "p") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function teamShell(t) {
  return {
    id: t.id, short: t.short, name: t.name, city: t.city, glyph: t.glyph,
    primary: t.primary, secondary: t.secondary, accent: t.accent,
    ownerId: null, purseLeftL: 0, spentL: 0, squad: [], retentions: [], rtmLeft: 0,
  };
}

export function createRoom({ hostName, teamId, sport = "cricket", mode = "mock", settings = {}, publicRoom = true, withBots = 0 }) {
  const code = uniqueCode();
  const sportCfg = SPORTS[sport] ? sport : "cricket";
  const modeCfg = MODES[mode] ? mode : "mock";
  const merged = {
    ...DEFAULT_SETTINGS,
    sport: sportCfg,
    mode: modeCfg,
    ...SPORTS[sportCfg].defaults,
    ...MODES[modeCfg],
    ...settings,
  };
  merged.sport = sportCfg;
  merged.mode = modeCfg;
  merged.budgetCr = clamp(Number(merged.budgetCr) || 120, 20, 500);
  merged.bidSeconds = clamp(Number(merged.bidSeconds) || 20, 4, 90);
  merged.resetSeconds = clamp(Number(merged.resetSeconds) || 10, 3, 60);
  merged.introSeconds = clamp(Number(merged.introSeconds ?? 3), 0, 15);
  merged.hammerSeconds = clamp(Number(merged.hammerSeconds ?? 3), 1, 10);
  merged.rtmWindowSeconds = clamp(Number(merged.rtmWindowSeconds ?? 8), 3, 30);
  merged.nextDelaySeconds = clamp(Number(merged.nextDelaySeconds ?? 4), 1, 20);
  merged.public = publicRoom !== false;

  const hostId = makeId("host");
  const room = {
    id: code,
    code,
    title: `${hostName}'s Table`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hostId,
    status: "lobby",
    settings: merged,
    sport: sportCfg,
    mode: modeCfg,
    participants: [],
    teams: {},
    queue: [],
    sets: [],
    index: 0,
    current: null,
    sold: [],
    unsold: [],
    passed: [],
    feed: [],
    chat: [],
    reactions: [],
    results: null,
    history: [],
    playersMap: new Map(),
    playersList: [],
    botPlans: {},
    paused: false,
    pauseEndsAt: null,
  };

  for (const t of TEAMS) room.teams[t.id] = teamShell(t);

  const host = addParticipant(room, { name: hostName, teamId, isHost: true });
  room.hostId = host.id; // the room's host is the participant, not a separate id
  if (!host.teamId) {
    const fallback = pickTeam(room, TEAMS[0].id) || TEAMS[0].id;
    host.teamId = fallback;
    if (room.teams[fallback]) room.teams[fallback].ownerId = host.id;
  }

  if (withBots > 0) fillBots(room, withBots);

  rooms.set(code, room);
  return room;
}

export function addParticipant(room, { name, teamId, isHost = false, isBot = false, spectator = false, token = makeToken(), style = null }) {
  const id = makeId(isBot ? "bot" : "p");
  const p = {
    id,
    name: String(name || "Owner").slice(0, 24),
    teamId: null,
    isHost,
    isBot,
    spectator,
    connected: true,
    socketId: null,
    token,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    style,
    passed: false,
  };
  if (!spectator) {
    const t = pickTeam(room, teamId);
    if (t && room.teams[t]) {
      p.teamId = t;
      room.teams[t].ownerId = id;
    }
  }
  room.participants.push(p);
  room.updatedAt = Date.now();
  return p;
}

export function seatCapacity(room) {
  return room.participants.filter((p) => !p.spectator).length < MAX_ROOM_PLAYERS;
}

export function ensureTeam(room, teamId) {
  if (room.teams[teamId]) return room.teams[teamId];
  const meta = ALL_TEAMS.find((t) => t.id === teamId);
  if (!meta) return null;
  room.teams[teamId] = teamShell(meta);
  return room.teams[teamId];
}

export function pickTeam(room, teamId) {
  if (!seatCapacity(room)) return null;
  const taken = new Set(room.participants.filter((p) => !p.spectator && p.teamId).map((p) => p.teamId));
  const order = [
    ...TEAMS.map((t) => t.id),
    ...ALL_TEAMS.filter((t) => !TEAMS.some((x) => x.id === t.id)).map((t) => t.id),
  ];
  if (teamId && !taken.has(teamId)) {
    const made = ensureTeam(room, teamId);
    if (made) return teamId;
  }
  const free = order.find((id) => !taken.has(id) && ensureTeam(room, id));
  return free || null;
}

export function fillBots(room, count) {
  const names = ["Ace Owner", "Sultan", "Moneyball", "The Shark", "Silent Bidder", "Hawk Eye", "Deep Pockets", "Sniper", "The Gambler", "Iron Purse", "Wildcard", "Maverick"];
  const styles = ["aggressive", "shrewd", "frugal", "collector", "balanced"];
  const added = [];
  for (let i = 0; i < count; i++) {
    const humans = room.participants.filter((p) => !p.spectator).length;
    if (humans >= MAX_ROOM_PLAYERS) break;
    const usedNames = new Set(room.participants.map((p) => p.name));
    const name = names.find((n) => !usedNames.has(n)) || `Bot ${i + 1}`;
    const bot = addParticipant(room, { name, isBot: true, style: styles[i % styles.length] });
    added.push(bot);
  }
  return added;
}

export function removeParticipant(room, participantId) {
  const idx = room.participants.findIndex((p) => p.id === participantId);
  if (idx < 0) return null;
  const [p] = room.participants.splice(idx, 1);
  if (p.teamId && room.teams[p.teamId]) room.teams[p.teamId].ownerId = null;
  if (room.hostId === p.id) {
    const nextHost = room.participants.find((x) => !x.isBot && !x.spectator) || room.participants.find((x) => !x.spectator);
    if (nextHost) {
      room.hostId = nextHost.id;
      nextHost.isHost = true;
    }
  }
  return p;
}

export function humanCount(room) {
  return room.participants.filter((p) => !p.isBot && !p.spectator).length;
}

export function activeOwners(room) {
  return room.participants.filter((p) => !p.spectator && p.teamId);
}

export function roomSummary(room) {
  return {
    code: room.code,
    title: room.title,
    sport: room.sport,
    mode: room.mode,
    status: room.status,
    humans: humanCount(room),
    bots: room.participants.filter((p) => p.isBot).length,
    spectators: room.participants.filter((p) => p.spectator).length,
    maxPlayers: MAX_HUMAN_PLAYERS,
    sold: room.sold.length,
    total: room.queue.length,
    index: room.index,
    currentPlayer: room.current ? room.playersMap.get(room.current.playerId)?.name || null : null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    teams: activeOwners(room).map((p) => ({ teamId: p.teamId, name: p.name, short: room.teams[p.teamId]?.short })),
  };
}

export function listPublicRooms() {
  return [...rooms.values()]
    .filter((r) => r.settings.public && (r.status === "lobby" || r.status === "live"))
    .sort((a, b) => (a.status === b.status ? b.updatedAt - a.updatedAt : a.status === "live" ? -1 : 1))
    .slice(0, 40)
    .map(roomSummary);
}

export function participantPayload(room) {
  return {
    id: room.code,
    code: room.code,
    title: room.title,
    status: room.status,
    hostId: room.hostId,
    sport: room.sport,
    mode: room.mode,
    createdAt: room.createdAt,
    settings: room.settings,
    participants: room.participants.map((p) => ({
      id: p.id, name: p.name, teamId: p.teamId, isHost: p.isHost, isBot: p.isBot,
      spectator: p.spectator, connected: p.connected, style: p.style, joinedAt: p.joinedAt,
    })),
    teams: Object.values(room.teams)
      .filter((t) => t.ownerId || t.squad.length || t.retentions.length)
      .map((t) => ({
        id: t.id, short: t.short, name: t.name, city: t.city, glyph: t.glyph,
        primary: t.primary, secondary: t.secondary, accent: t.accent,
        ownerId: t.ownerId, purseLeftL: t.purseLeftL, spentL: t.spentL,
        squad: t.squad.slice(), rtmLeft: t.rtmLeft,
        retentions: t.retentions.map((r) => ({ playerId: r.playerId, name: r.name, salaryL: r.salaryL, role: r.role, rating: r.rating, overseas: r.overseas, country: r.country, style: r.style, id: r.id })),
      })),
    players: room.playersList,
    sets: room.sets.map((s) => ({ id: s.id, index: s.index, name: s.name, count: s.ids.length })),
    queue: room.queue,
    index: room.index,
    current: room.current,
    sold: room.sold,
    unsold: room.unsold,
    feed: room.feed.slice(-60),
    chat: room.chat.slice(-60),
    results: room.results,
    paused: room.paused,
    serverTime: Date.now(),
  };
}

export function liveState(room) {
  return {
    status: room.status,
    index: room.index,
    total: room.queue.length,
    current: room.current,
    paused: room.paused,
    serverTime: Date.now(),
    teams: Object.fromEntries(
      Object.values(room.teams)
        .filter((t) => t.ownerId || t.squad.length || t.retentions.length)
        .map((t) => [t.id, { purseLeftL: t.purseLeftL, spentL: t.spentL, squad: t.squad, rtmLeft: t.rtmLeft, ownerId: t.ownerId }]),
    ),
    participants: room.participants.map((p) => ({ id: p.id, connected: p.connected, name: p.name, teamId: p.teamId, spectator: p.spectator, isBot: p.isBot })),
    soldCount: room.sold.length,
    unsoldCount: room.unsold.length,
    sold: room.sold.slice(-30),
    feed: room.feed.slice(-12),
    results: room.results ? { at: room.results.at } : null,
  };
}

export function getRoom(code) {
  return rooms.get(String(code || "").toUpperCase().trim());
}

export function findParticipant(room, id) {
  return room.participants.find((p) => p.id === id) || null;
}

export function teamOf(room, participantId) {
  const p = findParticipant(room, participantId);
  return p && p.teamId ? room.teams[p.teamId] : null;
}

export { getPool };
