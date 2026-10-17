import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import compression from "compression";
import { attachSockets } from "./net/socket.js";
import { listPublicRooms, rooms } from "./game/room.js";
import { CRICKET_PLAYERS } from "../../shared/players.cricket.js";
import { FOOTBALL_PLAYERS } from "../../shared/players.football.js";
import { probeAll, getProviderStatus, diagnose, getStats } from "./stats/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIST = path.join(ROOT, "client/dist");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.use(compression());
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() }));
app.get("/api/rooms", (_req, res) => res.json({ ok: true, rooms: listPublicRooms() }));
app.get("/api/pool", (req, res) => {
  const sport = req.query.sport === "football" ? "football" : "cricket";
  const list = sport === "football" ? FOOTBALL_PLAYERS : CRICKET_PLAYERS;
  res.json({ ok: true, sport, count: list.length, players: list.slice(0, Number(req.query.limit || 60)) });
});

// ── Stats API ────────────────────────────────────────────────────────────────
app.get("/api/stats/status", (_req, res) => {
  res.json({ ok: true, providers: getProviderStatus() });
});

app.get("/api/stats/diagnose", async (req, res) => {
  const name  = String(req.query.name  || "").trim();
  const sport = String(req.query.sport || "cricket").trim();
  if (!name) return res.status(400).json({ ok: false, error: "?name= is required" });
  try {
    const result = await diagnose(name, sport);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/stats/player", async (req, res) => {
  let name  = String(req.query.name  || "").trim();
  const id  = String(req.query.id    || "").trim();
  const sport = String(req.query.sport || "cricket").trim();
  if (!name && id) {
    const pool = sport === "football" ? FOOTBALL_PLAYERS : CRICKET_PLAYERS;
    const p = pool.find((x) => x.id === id);
    if (p) name = p.name;
    else return res.status(404).json({ ok: false, error: "Player not found" });
  }
  if (!name) return res.status(400).json({ ok: false, error: "?name= or ?id= is required" });
  try {
    const stats = await getStats({ id, name, sport }, sport);
    res.json({ ok: true, stats, player: { id, name, sport } });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Static client is served when present; checked per request so a rebuild
// never needs a server restart.
app.use(express.static(DIST, { maxAge: "1h", index: false, fallthrough: true }));
app.get("*", (_req, res) => {
  const indexHtml = path.join(DIST, "index.html");
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  res.status(503).type("html").send(
    "<h1>Auction Arena</h1><p>Client build missing. Run <code>npm run build</code> then refresh.</p>");
});

const server = http.createServer(app);
attachSockets(server);

process.on("uncaughtException", (err) => console.error("[fatal-guard] uncaughtException", err));
process.on("unhandledRejection", (err) => console.error("[fatal-guard] unhandledRejection", err));

server.listen(PORT, HOST, () => {
  console.log(`Auction Arena server listening on http://${HOST}:${PORT}`);
  console.log(`Pool: ${CRICKET_PLAYERS.length} cricket / ${FOOTBALL_PLAYERS.length} football names`);
  // Non-blocking: probe stats providers and log results
  probeAll().then(() => {
    const s = getProviderStatus();
    const up = Object.values(s).filter(p => p && p.healthy).map(p => p.name).filter(Boolean);
    console.log(`Stats providers UP: ${up.length ? up.join(", ") : "none (mock fallback active)"}`);
  }).catch(() => {});
});

