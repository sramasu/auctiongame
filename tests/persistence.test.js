/**
 * tests/persistence.test.js — 27 assertions covering room state,
 * reconnect, seat-holding, and join-in-progress.
 *
 * Runs against a live server at TEST_URL (default http://127.0.0.1:3000).
 * Start the server first: npm start
 *
 * Usage: node tests/persistence.test.js
 */

import assert from "node:assert/strict";
import { io } from "socket.io-client";

const BASE = process.env.TEST_URL || "http://127.0.0.1:3000";

let passed = 0;
let failed = 0;
const failures = [];

function mkFail(name, err) {
  console.error(`  ✗ ${name}: ${err.message}`);
  failures.push({ name, error: err.message });
  failed++;
}
function mkPass(name) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function connect() {
  return io(BASE, { transports: ["websocket"], forceNew: true, timeout: 5000 });
}

function waitFor(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

async function createRoom(socket, overrides = {}) {
  const res = await emit(socket, "room:create", {
    name: "PersistTest", sport: "cricket", mode: "mock", solo: true, botCount: 3, ...overrides,
  });
  assert.ok(res.ok, `createRoom failed: ${res.error}`);
  return res;
}

// ──────────────────────────────────────────────────────────────
// 1. Room creation persistence (6 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n1. Room creation");

await (async () => {
  const s = connect();
  await waitFor(s, "connect");
  try {
    const r = await createRoom(s);
    try {
      assert.ok(r.code, "code should be returned");
      mkPass("createRoom returns code");
    } catch (e) { mkFail("createRoom returns code", e); }

    try {
      assert.ok(r.participantId, "participantId should be set");
      mkPass("createRoom returns participantId");
    } catch (e) { mkFail("createRoom returns participantId", e); }

    try {
      assert.ok(r.token, "token should be returned");
      mkPass("createRoom returns token");
    } catch (e) { mkFail("createRoom returns token", e); }

    try {
      assert.ok(r.payload, "payload should be present");
      mkPass("createRoom returns payload");
    } catch (e) { mkFail("createRoom returns payload", e); }

    try {
      assert.equal(r.payload.status, "lobby", "room starts in lobby");
      mkPass("room starts in lobby status");
    } catch (e) { mkFail("room starts in lobby status", e); }

    try {
      assert.ok(Array.isArray(r.payload.participants), "participants is array");
      mkPass("participants is array");
    } catch (e) { mkFail("participants is array", e); }
  } finally { s.disconnect(); }
})();

// ──────────────────────────────────────────────────────────────
// 2. Rejoin / seat-holding (7 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n2. Rejoin (seat-holding)");

await (async () => {
  const s1 = connect();
  await waitFor(s1, "connect");
  let code, participantId, token;
  try {
    const r = await createRoom(s1);
    code = r.code; participantId = r.participantId; token = r.token;

    // Disconnect and reconnect with same credentials
    s1.disconnect();
    await new Promise(r => setTimeout(r, 200));

    const s2 = connect();
    await waitFor(s2, "connect");
    try {
      const rejoin = await emit(s2, "room:rejoin", { code, participantId, token });
      try {
        assert.ok(rejoin.ok, `rejoin failed: ${rejoin.error}`);
        mkPass("rejoin succeeds with valid token");
      } catch (e) { mkFail("rejoin succeeds with valid token", e); }

      try {
        assert.equal(rejoin.code, code, "rejoined same room code");
        mkPass("rejoin returns same room code");
      } catch (e) { mkFail("rejoin returns same room code", e); }

      try {
        assert.equal(rejoin.participantId, participantId, "rejoined same participantId");
        mkPass("rejoin preserves participantId");
      } catch (e) { mkFail("rejoin preserves participantId", e); }

      // Bad token
      const bad = await emit(s2, "room:rejoin", { code, participantId, token: "bad_token" });
      try {
        assert.ok(!bad.ok, "bad token should fail");
        mkPass("rejoin fails with bad token");
      } catch (e) { mkFail("rejoin fails with bad token", e); }

      // Wrong participantId
      const wrong = await emit(s2, "room:rejoin", { code, participantId: "xx_wrong", token });
      try {
        assert.ok(!wrong.ok, "wrong participantId should fail");
        mkPass("rejoin fails with wrong participantId");
      } catch (e) { mkFail("rejoin fails with wrong participantId", e); }

      // Wrong room code
      const noRoom = await emit(s2, "room:rejoin", { code: "XXXXXX", participantId, token });
      try {
        assert.ok(!noRoom.ok, "nonexistent room should fail");
        mkPass("rejoin fails for nonexistent room");
      } catch (e) { mkFail("rejoin fails for nonexistent room", e); }

      // room:state after rejoin
      const state = await emit(s2, "room:state", {});
      try {
        assert.ok(state.ok && state.payload, "room:state returns payload after rejoin");
        mkPass("room:state after rejoin returns payload");
      } catch (e) { mkFail("room:state after rejoin returns payload", e); }
    } finally { s2.disconnect(); }
  } catch (e) { mkFail("rejoin setup", e); s1.disconnect(); }
})();

// ──────────────────────────────────────────────────────────────
// 3. Spectator join (5 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n3. Spectator join");

await (async () => {
  const host = connect();
  await waitFor(host, "connect");
  try {
    const r = await createRoom(host);
    const code = r.code;

    const viewer = connect();
    await waitFor(viewer, "connect");
    try {
      const jSpec = await emit(viewer, "room:join", { code, name: "Watcher", spectator: true });
      try {
        assert.ok(jSpec.ok, "spectator join should succeed");
        mkPass("spectator joins successfully");
      } catch (e) { mkFail("spectator joins successfully", e); }

      try {
        assert.ok(jSpec.participantId, "spectator gets participantId");
        mkPass("spectator gets participantId");
      } catch (e) { mkFail("spectator gets participantId", e); }

      // Spectators can't bid
      const bidAttempt = await emit(viewer, "bid:place", { amount: 100 });
      try {
        assert.ok(!bidAttempt.ok, "spectator cannot bid");
        mkPass("spectator cannot bid");
      } catch (e) { mkFail("spectator cannot bid", e); }

      // Spectators can chat
      const chatRes = await emit(viewer, "chat:send", { text: "Hello!" });
      try {
        assert.ok(chatRes.ok, "spectator can chat");
        mkPass("spectator can send chat");
      } catch (e) { mkFail("spectator can send chat", e); }

      // Spectators can send reactions
      const reactRes = await emit(viewer, "react:send", { emoji: "🔥" });
      try {
        assert.ok(reactRes.ok, "spectator can react");
        mkPass("spectator can send reaction");
      } catch (e) { mkFail("spectator can send reaction", e); }
    } finally { viewer.disconnect(); }
  } finally { host.disconnect(); }
})();

// ──────────────────────────────────────────────────────────────
// 4. Join-in-progress (9 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n4. Join in progress");

await (async () => {
  const host = connect();
  await waitFor(host, "connect");
  try {
    // Create room with bots so there are bot slots available
    const r = await createRoom(host, { solo: true, botCount: 4 });
    const code = r.code;

    // Start the auction
    const startRes = await emit(host, "auction:start", {});
    try {
      assert.ok(startRes.ok, "auction:start should succeed");
      mkPass("auction starts successfully for join-live test");
    } catch (e) { mkFail("auction starts successfully for join-live test", e); }

    const viewer = connect();
    await waitFor(viewer, "connect");
    try {
      // Try to join live (take bot slot)
      const jLive = await emit(viewer, "room:join-live", { code, name: "LateArriver" });
      try {
        assert.ok(jLive.ok, `join-live should succeed: ${jLive.error}`);
        mkPass("room:join-live succeeds");
      } catch (e) { mkFail("room:join-live succeeds", e); }

      try {
        assert.ok(jLive.participantId, "join-live returns participantId");
        mkPass("join-live returns participantId");
      } catch (e) { mkFail("join-live returns participantId", e); }

      try {
        assert.ok(jLive.payload, "join-live returns payload");
        mkPass("join-live returns payload");
      } catch (e) { mkFail("join-live returns payload", e); }

      try {
        // Player who takes a bot slot is not a spectator
        if (jLive.tookOver) {
          assert.ok(!jLive.spectator, "bot-takeover is not spectator");
          mkPass("join-live bot-takeover is not spectator");
        } else {
          assert.ok(jLive.spectator, "without bot slot, joins as spectator");
          mkPass("join-live without bot slot joins as spectator");
        }
      } catch (e) { mkFail("join-live spectator flag correct", e); }

      // join-live on done room fails
      const done_sock = connect();
      await waitFor(done_sock, "connect");
      const finRes = await emit(host, "auction:finish", {});
      try {
        assert.ok(finRes.ok, "finish auction");
        mkPass("auction:finish for done-room test");
      } catch (e) { mkFail("auction:finish for done-room test", e); }

      const joinDone = await emit(done_sock, "room:join-live", { code, name: "TooLate" });
      try {
        assert.ok(!joinDone.ok, "join-live on done room should fail");
        mkPass("join-live fails on finished auction");
      } catch (e) { mkFail("join-live fails on finished auction", e); }

      // join-live bogus code
      const noRoom = await emit(viewer, "room:join-live", { code: "ZZXXZZ", name: "Ghost" });
      try {
        assert.ok(!noRoom.ok, "join-live with bad code should fail");
        mkPass("join-live fails with nonexistent room code");
      } catch (e) { mkFail("join-live fails with nonexistent room code", e); }

      // join-live without name fails
      const noName = await emit(viewer, "room:join-live", { code, name: "" });
      try {
        assert.ok(!noName.ok, "join-live without name should fail");
        mkPass("join-live fails without name");
      } catch (e) { mkFail("join-live fails without name", e); }

      done_sock.disconnect();
    } finally { viewer.disconnect(); }
  } finally { host.disconnect(); }
})();

// ──────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Persistence tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
}
process.exit(failed > 0 ? 1 : 0);
