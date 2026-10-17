import { Server } from "socket.io";
import {
  rooms, createRoom, addParticipant, removeParticipant, findParticipant,
  participantPayload, liveState, listPublicRooms, getRoom, humanCount, makeToken, pickTeam, fillBots,
  seatCapacity,
} from "../game/room.js";
import {
  prepareAuction, startAuction, tickRoom, placeBid, passOnPlayer, setAutoBid,
  useRTM, pauseAuction, skipPlayer, undoLastSale, startAccelerated, replayPassed,
  finishAuction, pushChat, pushReaction, pushFeed, openPlayer, computeResults,
} from "../game/auction.js";
import { onRoomEvent } from "../game/bus.js";
import { MAX_HUMAN_PLAYERS, MAX_ROOM_PLAYERS } from "../../../shared/constants.js";
import { ALL_TEAMS } from "../../../shared/teams.js";
import { getStats } from "../stats/index.js";

const EMPTY_ROOM_TTL = 12 * 60 * 1000;

export function attachSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 15000,
    pingTimeout: 25000,
    maxHttpBufferSize: 1e6,
  });

  const dirty = new Set();

  onRoomEvent((room, event, data) => {
    dirty.add(room.code);
    switch (event) {
      case "bid": io.to(room.code).emit("bid", data); break;
      case "sold": io.to(room.code).emit("sold", data); break;
      case "unsold": io.to(room.code).emit("unsold", data); break;
      case "rtm": io.to(room.code).emit("rtm", data); break;
      case "feed": io.to(room.code).emit("feed", data); break;
      case "chat": io.to(room.code).emit("chat", data); break;
      case "reaction": io.to(room.code).emit("reaction", data); break;
      case "phase": io.to(room.code).emit("phase", data); break;
      case "player": {
        io.to(room.code).emit("player", data);
        // Asynchronously fetch stats and push to the room
        const playerRecord = room.playersMap?.get(data.playerId);
        if (playerRecord) {
          getStats(playerRecord, room.sport).then(stats => {
            io.to(room.code).emit("stats", { playerId: data.playerId, stats });
          }).catch(() => {});
        }
        break;
      }
      case "start": io.to(room.code).emit("auction-start", data); break;
      case "results": io.to(room.code).emit("results", data); break;
      case "pass": io.to(room.code).emit("pass", data); break;
      case "autobid": io.to(room.code).emit("autobid", data); break;
      case "undo": io.to(room.code).emit("undo", data); break;
      case "accelerated": io.to(room.code).emit("accelerated", data); break;
      default: break;
    }
  });

  // State sync + authoritative game clock.
  setInterval(() => {
    for (const code of dirty) {
      const room = rooms.get(code);
      if (room) io.to(code).emit("state", liveState(room));
    }
    dirty.clear();
  }, 140);

  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      try { tickRoom(room, now); } catch (err) { console.error("[tick] room", room.code, err); continue; }
      if (room.status === "live" && !room.paused && room.current && room.current.phase === "bidding") {
        io.to(room.code).emit("tick", {
          endsAt: room.current.endsAt, bidL: room.current.bidL,
          leaderId: room.current.leaderId, serverTime: now,
        });
      } else if (room.current && room.current.endsAt) {
        io.to(room.code).emit("tick", { endsAt: room.current.endsAt, phase: room.current.phase, serverTime: now });
      }
    }
  }, 100);

  // Housekeeping: drop abandoned rooms.
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      const alive = room.participants.some((p) => p.connected && !p.isBot);
      if (!alive && now - room.updatedAt > EMPTY_ROOM_TTL) {
        rooms.delete(code);
      }
    }
  }, 60000);

  const touch = (room) => { room.updatedAt = Date.now(); dirty.add(room.code); };
  const ack = (cb, payload) => { if (typeof cb === "function") cb(payload); };

  function requireRoom(socket) {
    const room = socket.data.room ? rooms.get(socket.data.room) : null;
    return room || null;
  }

  function requireHost(socket, room) {
    const p = room ? findParticipant(room, socket.data.participantId) : null;
    return p && p.id === room.hostId;
  }

  io.on("connection", (socket) => {
    socket.on("room:list", (_payload, cb) => ack(cb, { ok: true, rooms: listPublicRooms(), teams: ALL_TEAMS }));

    socket.on("room:create", (payload = {}, cb) => {
      const name = String(payload.name || "").trim().slice(0, 24);
      if (!name) return ack(cb, { ok: false, error: "Enter your name to host a table" });
      const room = createRoom({
        hostName: name,
        teamId: payload.teamId,
        sport: payload.sport === "football" ? "football" : "cricket",
        mode: ["mock", "mega", "blitz", "custom"].includes(payload.mode) ? payload.mode : "mock",
        settings: payload.settings || {},
        publicRoom: payload.public !== false,
        withBots: payload.solo ? Math.min(9, Math.max(1, Number(payload.botCount) || 9)) : 0,
      });
      prepareAuction(room);
      room.title = `${name}'s Table`;
      const host = room.participants[0];
      socket.data.room = room.code;
      socket.data.participantId = host.id;
      socket.data.token = host.token;
      socket.join(room.code);
      touch(room);
      ack(cb, { ok: true, code: room.code, participantId: host.id, token: host.token, payload: participantPayload(room) });
    });

    socket.on("room:join", (payload = {}, cb) => {
      const room = getRoom(payload.code);
      if (!room) return ack(cb, { ok: false, error: "That room code does not exist" });
      const name = String(payload.name || "").trim().slice(0, 24);
      if (!name) return ack(cb, { ok: false, error: "Enter your name" });
      const spectators = room.participants.filter((p) => p.spectator).length;
      const seats = room.participants.filter((p) => !p.spectator).length;
      if (payload.spectator) {
        if (spectators >= 40) return ack(cb, { ok: false, error: "Spectator gallery is full" });
      } else if (seats >= MAX_ROOM_PLAYERS) {
        return ack(cb, { ok: false, error: `Table is full (${MAX_ROOM_PLAYERS} franchises seated). You can still spectate.` });
      }
      if (room.status === "done") return ack(cb, { ok: false, error: "That auction has already finished" });
      const started = room.status === "live";
      if (!payload.spectator && started) {
        return ack(cb, { ok: false, error: "Auction already running — join as a spectator instead" });
      }
      const p = addParticipant(room, {
        name, teamId: payload.teamId, spectator: !!payload.spectator,
      });
      socket.data.room = room.code;
      socket.data.participantId = p.id;
      socket.data.token = p.token;
      socket.join(room.code);
      touch(room);
      pushFeed(room, "system", `${p.name} joined as ${p.spectator ? "a spectator" : room.teams[p.teamId]?.name || "an owner"}.`, { teamId: p.teamId });
      ack(cb, { ok: true, code: room.code, participantId: p.id, token: p.token, payload: participantPayload(room) });
    });

    // room:join-live — join an in-progress auction (takes over a bot slot or spectates).
    socket.on("room:join-live", (payload = {}, cb) => {
      const room = getRoom(payload.code);
      if (!room) return ack(cb, { ok: false, error: "Room not found" });
      const name = String(payload.name || "").trim().slice(0, 24);
      if (!name) return ack(cb, { ok: false, error: "Enter your name" });

      if (room.status === "done") return ack(cb, { ok: false, error: "Auction already finished" });

      // Try to find an empty bot slot to take over
      const botSlot = payload.teamId
        ? room.participants.find(p => p.isBot && p.teamId === payload.teamId)
        : room.participants.find(p => p.isBot);

      if (botSlot && !payload.spectator) {
        // Replace bot with human player
        botSlot.name = name;
        botSlot.isBot = false;
        botSlot.connected = true;
        botSlot.socketId = socket.id;
        botSlot.lastSeen = Date.now();
        socket.data.room = room.code;
        socket.data.participantId = botSlot.id;
        socket.data.token = botSlot.token;
        socket.join(room.code);
        touch(room);
        pushFeed(room, "system", `${name} took over ${room.teams[botSlot.teamId]?.name || "a franchise"} mid-auction.`, { teamId: botSlot.teamId });
        io.to(room.code).emit("participants", {
          participants: room.participants.map(x => ({ id: x.id, name: x.name, teamId: x.teamId, isHost: x.isHost, isBot: x.isBot, spectator: x.spectator, connected: x.connected }))
        });
        return ack(cb, { ok: true, code: room.code, participantId: botSlot.id, token: botSlot.token, tookOver: botSlot.teamId, payload: participantPayload(room) });
      }

      // Try to take a free franchise seat if capacity allows and not spectator
      if (!payload.spectator && seatCapacity(room)) {
        const freeTeam = pickTeam(room, payload.teamId);
        if (freeTeam) {
          const p = addParticipant(room, { name, teamId: freeTeam });
          socket.data.room = room.code;
          socket.data.participantId = p.id;
          socket.data.token = p.token;
          socket.join(room.code);
          touch(room);
          pushFeed(room, "system", `${name} joined live and took ${room.teams[freeTeam]?.name || "a franchise"}.`, { teamId: freeTeam });
          io.to(room.code).emit("participants", {
            participants: room.participants.map(x => ({ id: x.id, name: x.name, teamId: x.teamId, isHost: x.isHost, isBot: x.isBot, spectator: x.spectator, connected: x.connected }))
          });
          return ack(cb, { ok: true, code: room.code, participantId: p.id, token: p.token, tookOver: freeTeam, payload: participantPayload(room) });
        }
      }

      // No bot slot or explicitly wants spectator
      const spectators = room.participants.filter(p => p.spectator).length;
      if (spectators >= 40) return ack(cb, { ok: false, error: "Spectator gallery is full" });
      const p = addParticipant(room, { name, spectator: true });
      socket.data.room = room.code;
      socket.data.participantId = p.id;
      socket.data.token = p.token;
      socket.join(room.code);
      touch(room);
      pushFeed(room, "system", `${name} joined as a spectator.`);
      ack(cb, { ok: true, code: room.code, participantId: p.id, token: p.token, spectator: true, payload: participantPayload(room) });
    });

    socket.on("room:rejoin", (payload = {}, cb) => {
      const room = getRoom(payload.code || payload.roomId);
      if (!room) return ack(cb, { ok: false, error: "Room no longer exists" });
      const p = findParticipant(room, payload.participantId);
      if (!p || (payload.token && p.token !== payload.token)) {
        return ack(cb, { ok: false, error: "Could not restore your seat" });
      }
      p.connected = true;
      p.socketId = socket.id;
      socket.data.room = room.code;
      socket.data.participantId = p.id;
      socket.data.token = p.token;
      socket.join(room.code);
      touch(room);
      ack(cb, { ok: true, code: room.code, participantId: p.id, token: p.token, payload: participantPayload(room) });
    });

    socket.on("room:state", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false, error: "Not in a room" });
      ack(cb, { ok: true, payload: participantPayload(room) });
    });

    socket.on("room:leave", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: true });
      const p = findParticipant(room, socket.data.participantId);
      if (p) {
        if (p.isBot || p.spectator) removeParticipant(room, p.id);
        else if (room.status === "lobby") removeParticipant(room, p.id);
        else { p.connected = false; p.socketId = null; pushFeed(room, "system", `${p.name} disconnected.`); }
      }
      socket.leave(room.code);
      socket.data.room = null;
      touch(room);
      ack(cb, { ok: true });
    });

    socket.on("room:pickTeam", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false, error: "Not in a room" });
      if (room.status !== "lobby") return ack(cb, { ok: false, error: "Auction already started" });
      const p = findParticipant(room, socket.data.participantId);
      if (!p || p.spectator) return ack(cb, { ok: false, error: "Spectators cannot pick a franchise" });
      const taken = room.participants.filter((x) => !x.spectator && x.teamId && x.id !== p.id).map((x) => x.teamId);
      if (payload.teamId && taken.includes(payload.teamId)) return ack(cb, { ok: false, error: "That franchise is already taken" });
      const next = payload.teamId && !taken.includes(payload.teamId) ? payload.teamId : pickTeam(room, null);
      if (!next) return ack(cb, { ok: false, error: "No franchises left" });
      if (!room.teams[next]) {
        const extra = ALL_TEAMS.find((t) => t.id === next);
        if (!extra) return ack(cb, { ok: false, error: "Unknown franchise" });
        room.teams[next] = { id: extra.id, short: extra.short, name: extra.name, city: extra.city, glyph: extra.glyph, primary: extra.primary, secondary: extra.secondary, accent: extra.accent, ownerId: null, purseLeftL: 0, spentL: 0, squad: [], retentions: [], rtmLeft: 0 };
      }
      if (p.teamId && room.teams[p.teamId]) room.teams[p.teamId].ownerId = null;
      p.teamId = next;
      room.teams[next].ownerId = p.id;
      touch(room);
      io.to(room.code).emit("participants", { participants: room.participants.map((x) => ({ id: x.id, name: x.name, teamId: x.teamId, isHost: x.isHost, isBot: x.isBot, spectator: x.spectator, connected: x.connected })) });
      ack(cb, { ok: true, teamId: next });
    });

    socket.on("room:rename", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const team = room.teams[payload.teamId];
      if (!team) return ack(cb, { ok: false });
      team.name = String(payload.name || team.name).slice(0, 24);
      team.short = String(payload.short || team.short).slice(0, 5).toUpperCase();
      touch(room);
      io.to(room.code).emit("teams", { teams: Object.values(room.teams).map((t) => ({ id: t.id, name: t.name, short: t.short, primary: t.primary, secondary: t.secondary, accent: t.accent, glyph: t.glyph })) });
      ack(cb, { ok: true });
    });

    socket.on("room:settings", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const patch = payload.settings || {};
      const s = room.settings;
      const num = (v, d, lo, hi) => clampInt(v, d, lo, hi);
      if (patch.bidSeconds != null) s.bidSeconds = num(patch.bidSeconds, s.bidSeconds, 4, 90);
      if (patch.resetSeconds != null) s.resetSeconds = num(patch.resetSeconds, s.resetSeconds, 3, 60);
      if (patch.introSeconds != null) s.introSeconds = num(patch.introSeconds, s.introSeconds, 0, 15);
      if (patch.nextDelaySeconds != null) s.nextDelaySeconds = num(patch.nextDelaySeconds, s.nextDelaySeconds, 1, 20);
      if (patch.budgetCr != null) s.budgetCr = num(patch.budgetCr, s.budgetCr, 20, 500);
      if (patch.minSquad != null) s.minSquad = num(patch.minSquad, s.minSquad, 1, 40);
      if (patch.maxSquad != null) s.maxSquad = num(patch.maxSquad, s.maxSquad, 2, 60);
      if (patch.maxOverseas !== undefined) s.maxOverseas = patch.maxOverseas == null ? null : num(patch.maxOverseas, s.maxOverseas, 0, 30);
      if (patch.rtmCards != null) s.rtmCards = num(patch.rtmCards, s.rtmCards, 0, 5);
      if (patch.poolTop != null) s.poolTop = num(patch.poolTop, s.poolTop, 0, 900);
      if (typeof patch.autoNext === "boolean") s.autoNext = patch.autoNext;
      if (typeof patch.accelerated === "boolean") s.accelerated = patch.accelerated;
      if (typeof patch.retentions === "boolean") s.retentions = patch.retentions;
      if (typeof patch.public === "boolean") s.public = patch.public;
      if (typeof patch.sound === "boolean") s.sound = patch.sound;
      if (patch.bots) {
        s.bots = {
          enabled: !!patch.bots.enabled,
          count: num(patch.bots.count, s.bots.count, 0, 9),
          difficulty: ["easy", "normal", "insane"].includes(patch.bots.difficulty) ? patch.bots.difficulty : s.bots.difficulty,
        };
      }
      if (room.status === "lobby") prepareAuction(room);
      touch(room);
      io.to(room.code).emit("settings", { settings: s });
      ack(cb, { ok: true, settings: s });
    });

    socket.on("room:addBots", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      if (room.status !== "lobby") return ack(cb, { ok: false, error: "Bots can only join before the hammer drops" });
      const added = fillBots(room, clampInt(payload.count, 1, 0, 9));
      room.settings.bots.enabled = room.participants.some((p) => p.isBot);
      room.settings.bots.count = room.participants.filter((p) => p.isBot).length;
      prepareAuction(room);
      touch(room);
      pushFeed(room, "system", added.length ? `${added.length} AI owner${added.length > 1 ? "s" : ""} took a seat at the table.` : "No seats left for AI owners.");
      ack(cb, { ok: true, added: added.length, payload: participantPayload(room) });
    });

    socket.on("room:removeBot", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const target = findParticipant(room, payload.participantId);
      if (!target || !target.isBot) return ack(cb, { ok: false, error: "Not an AI owner" });
      removeParticipant(room, target.id);
      prepareAuction(room);
      touch(room);
      ack(cb, { ok: true, payload: participantPayload(room) });
    });

    socket.on("room:kick", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const target = findParticipant(room, payload.participantId);
      if (!target || target.id === room.hostId) return ack(cb, { ok: false, error: "Cannot remove the host" });
      if (target.socketId) io.to(target.socketId).emit("kicked", { reason: "Removed by the host" });
      removeParticipant(room, target.id);
      if (room.status === "lobby") prepareAuction(room);
      touch(room);
      ack(cb, { ok: true });
    });

    socket.on("auction:start", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const owners = room.participants.filter((p) => !p.spectator && p.teamId);
      if (owners.length < 1) return ack(cb, { ok: false, error: "Need at least one franchise owner" });
      prepareAuction(room);
      startAuction(room);
      touch(room);
      ack(cb, { ok: true });
    });

    socket.on("auction:pause", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      pauseAuction(room, payload.paused !== false);
      touch(room);
      ack(cb, { ok: true, paused: room.paused });
    });

    socket.on("auction:next", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      if (!room.current) { openPlayer(room, room.index); }
      else openPlayer(room, room.current.queueIndex + 1);
      touch(room);
      ack(cb, { ok: true });
    });

    socket.on("auction:skip", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      skipPlayer(room);
      touch(room);
      ack(cb, { ok: true });
    });

    socket.on("auction:undo", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const res = undoLastSale(room);
      touch(room);
      ack(cb, res);
    });

    socket.on("auction:accelerate", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const res = startAccelerated(room);
      touch(room);
      ack(cb, res);
    });

    socket.on("auction:replayPassed", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const res = replayPassed(room);
      touch(room);
      ack(cb, res);
    });

    socket.on("auction:finish", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room || !requireHost(socket, room)) return ack(cb, { ok: false, error: "Host only" });
      const results = finishAuction(room);
      touch(room);
      ack(cb, { ok: true, results });
    });

    socket.on("bid:place", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false, error: "Not in a room" });
      const p = findParticipant(room, socket.data.participantId);
      if (!p || p.spectator) return ack(cb, { ok: false, error: "Spectators cannot bid" });
      const res = placeBid(room, p.id, Number(payload.amount) || undefined);
      touch(room);
      ack(cb, res);
    });

    socket.on("bid:pass", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false });
      const res = passOnPlayer(room, socket.data.participantId);
      touch(room);
      ack(cb, res);
    });

    socket.on("bid:auto", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false });
      const res = setAutoBid(room, socket.data.participantId, payload.max);
      touch(room);
      ack(cb, res);
    });

    socket.on("rtm:use", (_payload, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false });
      const res = useRTM(room, socket.data.participantId);
      touch(room);
      ack(cb, res);
    });

    socket.on("chat:send", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false });
      const p = findParticipant(room, socket.data.participantId);
      const text = String(payload.text || "").trim();
      if (!text) return ack(cb, { ok: false });
      pushChat(room, p?.name || "Guest", text, { teamId: p?.teamId || null, isBot: !!p?.isBot });
      ack(cb, { ok: true });
    });

    socket.on("react:send", (payload = {}, cb) => {
      const room = requireRoom(socket);
      if (!room) return ack(cb, { ok: false });
      pushReaction(room, socket.data.participantId, String(payload.emoji || "🔥").slice(0, 4));
      ack(cb, { ok: true });
    });

    // Safety net: never let one bad payload take the whole server down.
    for (const ev of socket.eventNames().filter((e) => e !== "disconnect")) {
      const listeners = socket.listeners(ev);
      socket.removeAllListeners(ev);
      for (const fn of listeners) {
        socket.on(ev, (...args) => {
          const cb = args.find((x) => typeof x === "function");
          const payload = args.find((x) => x !== cb) ?? {};
          try {
            return fn(payload, cb);
          } catch (err) {
            console.error(`[socket:${ev}] handler error`, err);
            if (cb) cb({ ok: false, error: "Server hiccup — please retry" });
          }
        });
      }
    }

    socket.on("disconnect", () => {
      const room = requireRoom(socket);
      if (!room) return;
      const p = findParticipant(room, socket.data.participantId);
      if (!p) return;
      p.connected = false;
      p.socketId = null;
      if (p.isBot || p.isHost) {
        // bots and host keep their seat held for reconnect
      } else if (room.status === "lobby") {
        removeParticipant(room, p.id);
      } else {
        pushFeed(room, "system", `${p.name} lost connection — their seat is held.`);
      }
      touch(room);
    });
  });

  return io;
}

function clampInt(v, d, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
