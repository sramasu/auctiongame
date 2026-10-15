import { io } from "socket.io-client";

let socket = null;

const inJsDom = typeof window !== "undefined" && /jsdom/i.test(window.navigator?.userAgent || "");

export function getSocket() {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      transports: inJsDom ? ["polling"] : ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 600,
      reconnectionDelayMax: 3000,
      timeout: 12000,
    });
  }
  return socket;
}

export function emit(event, payload = {}) {
  return new Promise((resolve) => {
    const s = getSocket();
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done({ ok: false, error: "No response from server" }), 12000);
    try {
      s.timeout(11000).emit(event, payload ?? {}, (err, res) => {
        clearTimeout(timer);
        if (err) return done({ ok: false, error: "Connection trouble — retrying" });
        done(res || { ok: true });
      });
    } catch (e) {
      clearTimeout(timer);
      done({ ok: false, error: String(e?.message || e) });
    }
  });
}

export const SESSION_KEY = "auction-arena:session";
export const PREFS_KEY = "auction-arena:prefs";

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
