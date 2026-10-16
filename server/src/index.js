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
});
