// Per-room target list ("watchlist") kept in the browser so each owner can plan
// their shopping list without the server tracking it.
const KEY = "auction-arena:watchlist";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch { return {}; }
}

export function getWatchlist(roomCode) {
  if (!roomCode) return [];
  return readAll()[roomCode] || [];
}

export function toggleWatch(roomCode, playerId) {
  if (!roomCode) return [];
  const all = readAll();
  const list = all[roomCode] || [];
  const next = list.includes(playerId) ? list.filter((id) => id !== playerId) : [...list, playerId];
  all[roomCode] = next;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return next;
}

export function clearWatch(roomCode) {
  const all = readAll();
  delete all[roomCode];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return [];
}

export const SHORTCUTS = [
  { keys: ["Space", "Enter"], action: "Place the highlighted bid" },
  { keys: ["1", "2", "3", "5"], action: "Set the bid jump multiplier" },
  { keys: ["P"], action: "Pass on the current player" },
  { keys: ["A"], action: "Open proxy auto-bidding" },
  { keys: ["R"], action: "Send a reaction to the table" },
  { keys: ["S"], action: "Open scouting / target list" },
  { keys: ["M"], action: "Mute or unmute sound" },
  { keys: ["?"], action: "Show this help" },
];
