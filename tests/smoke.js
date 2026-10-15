// End-to-end smoke test against a running server (default http://localhost:3000).
// Exercises: room creation, solo AI table, bidding, RTM, undo, pause, chat,
// reactions, spectator join, accelerated round and final results.
import { io } from "socket.io-client";

const URL = process.env.TEST_URL || "http://127.0.0.1:3000";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
};

function client(name) {
  const s = io(URL, { transports: ["websocket"], reconnection: false });
  const events = [];
  ["state", "bid", "sold", "unsold", "rtm", "feed", "chat", "reaction", "phase", "player", "results", "pass", "auction-start", "accelerated"].forEach((e) => {
    s.on(e, (d) => events.push({ e, d, at: Date.now() }));
  });
  s.events = events;
  s.name = name;
  return new Promise((resolve, reject) => {
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error(`${name} connect timeout`)), 8000);
  });
}

const send = (s, ev, data) => new Promise((resolve) => {
  s.timeout(8000).emit(ev, data || {}, (err, res) => resolve(err ? { ok: false, error: String(err?.message || err) } : res));
});

const lastOf = (s, ev) => [...s.events].reverse().find((x) => x.e === ev)?.d;

async function main() {
  console.log(`\nAuction Arena smoke test → ${URL}\n`);

  const host = await client("host");
  const create = await send(host, "room:create", {
    name: "TestHost", teamId: "mum", sport: "cricket", mode: "mock", public: false, solo: true, botCount: 9,
    settings: { bidSeconds: 4, resetSeconds: 3, introSeconds: 0, hammerSeconds: 1, nextDelaySeconds: 1, rtmWindowSeconds: 3, rtmCards: 2, poolTop: 22, autoNext: true },
  });
  ok("room created", create.ok && create.code, JSON.stringify(create).slice(0, 120));
  const code = create.code;
  const payload = create.payload;
  ok("10 franchises seated", payload.participants.filter((p) => !p.spectator).length === 10, `got ${payload.participants.length}`);
  ok("queue built from the trimmed pool", payload.queue.length > 0 && payload.queue.length <= 30, `len=${payload.queue.length}`);
  ok("sets organised", payload.sets.length >= 3, `sets=${payload.sets.length}`);
  const mum = payload.teams.find((t) => t.id === "mum");
  ok("retentions applied to host team", mum.retentions.length > 0 && mum.purseLeftL < 12000, `purse=${mum.purseLeftL} ret=${mum.retentions.length}`);
  ok("RTM cards granted", payload.teams.every((t) => t.rtmLeft === 2));
  ok("player payloads sent", payload.players.length > 20, `players=${payload.players.length}`);

  // spectator join
  const spec = await client("spec");
  const joinSpec = await send(spec, "room:join", { code, name: "Watcher", spectator: true });
  ok("spectator joined", joinSpec.ok && joinSpec.payload.participants.some((p) => p.spectator));

  // extra seats up to the 12-franchise cap, then rejection
  const extras = [];
  for (let i = 0; i < 2; i++) {
    const c = await client(`extra${i}`);
    const r = await send(c, "room:join", { code, name: `Late${i}` });
    extras.push({ c, r });
  }
  ok("extra franchises can join up to the 12-seat cap", extras[0].r.ok && extras[1].r.ok,
    JSON.stringify(extras.map((e) => e.r.ok)).slice(0, 80));
  const overflow = await client("overflow");
  const joinFull = await send(overflow, "room:join", { code, name: "TooLate" });
  ok("13th seat is rejected with a helpful message", joinFull.ok === false, JSON.stringify(joinFull).slice(0, 90));
  overflow.close();
  extras.forEach((e) => e.c.close());

  // start
  const start = await send(host, "auction:start");
  ok("auction started", start.ok, JSON.stringify(start));
  await wait(700);
  ok("first player announced", !!lastOf(host, "player"), JSON.stringify(lastOf(host,"player")));
  ok("host is bidder-visible state", !!lastOf(host, "state"));

  // human bid
  let st = lastOf(host, "state");
  if (!st?.current) { console.log("no current player, aborting"); process.exit(1); }
  const firstBid = await send(host, "bid:place", { amount: st.current.bidL + 5 });
  ok("human bid accepted", firstBid.ok, JSON.stringify(firstBid));
  ok("bid broadcast", !!lastOf(host, "bid"));

  // illegal bid (below current)
  st = lastOf(host, "state");
  const lowBid = await send(host, "bid:place", { amount: 5 });
  ok("low bid rejected", lowBid.ok === false, JSON.stringify(lowBid));

  // auto-bid
  const auto = await send(host, "bid:auto", { max: 400 });
  ok("auto-bid ceiling set", auto.ok && auto.maxL > 0, JSON.stringify(auto));

  // chat + reaction
  const chat = await send(host, "chat:send", { text: "gl hf" });
  await wait(350);
  ok("chat delivered", chat.ok && !!lastOf(spec, "chat"));
  await send(host, "react:send", { emoji: "🔥" });
  await wait(350);
  ok("reaction delivered", !!lastOf(spec, "reaction"));

  // pause / resume
  const paused = await send(host, "auction:pause", { paused: true });
  await wait(400);
  ok("pause works", paused.ok && lastOf(host, "state")?.paused === true, JSON.stringify(lastOf(host, "state")?.paused));
  await send(host, "auction:pause", { paused: false });
  await wait(300);

  // let bots run the auction to completion
  console.log("\n  …running the full auction with 9 AI owners (fast timers)…");
  const deadline = Date.now() + 150000;
  let results = null;
  let lastLog = 0;
  while (Date.now() < deadline) {
    results = lastOf(host, "results");
    if (results) break;
    const s2 = lastOf(host, "state");
    if (Date.now() - lastLog > 10000) {
      lastLog = Date.now();
      console.log(`    progress: ${s2?.index}/${s2?.total} • sold ${s2?.soldCount ?? 0} • unsold ${s2?.unsoldCount ?? 0} • phase ${s2?.current?.phase}`);
    }
    await wait(500);
  }
  ok("auction completed with results", !!results);
  if (results) {
    ok("standings for all 10 tables", results.standings.length === 10, `n=${results.standings.length}`);
    const sales = results.totals.sold;
    ok("players were sold", sales > 0, `sold=${sales}`);
    ok("grades computed", results.standings.every((t) => t.grade && t.strength >= 0));
    ok("best XI computed", results.standings.every((t) => Array.isArray(t.xi) && t.xi.length > 0));
    ok("awards present", !!results.awards.champion);
    const purseCheck = results.standings.every((t) => t.purseLeftL >= 0);
    ok("no negative purses", purseCheck);
    const overSeasOk = results.standings.every((t) => t.overseas <= 8);
    ok("overseas cap respected", overSeasOk, results.standings.map((t) => `${t.short}:${t.overseas}`).join(" "));
    const squadOk = results.standings.every((t) => t.size <= 25);
    ok("max squad respected", squadOk);
    console.log(`    sold=${results.totals.sold} unsold=${results.totals.unsold} spend=₹${(results.totals.spendL / 100).toFixed(1)}Cr champion=${results.awards.champion?.name} (${results.awards.champion?.grade})`);
  }

  // undo last sale
  const undo = await send(host, "auction:undo");
  ok("undo last sale", undo.ok, JSON.stringify(undo).slice(0, 100));

  // accelerated round over unsold names
  const accel = await send(host, "auction:accelerate");
  ok("accelerated round handled", accel.ok || /No unsold/.test(accel.error || accel.reason || ""), JSON.stringify(accel).slice(0, 100));

  // RTM is rejected outside its window
  const rtm = await send(host, "rtm:use");
  ok("RTM rejected outside the window", rtm.ok === false, JSON.stringify(rtm).slice(0, 90));

  // reconnection restores the seat
  const session = { code, participantId: create.participantId, token: create.token };
  host.close();
  await wait(300);
  const host2 = await client("host2");
  const rejoin = await send(host2, "room:rejoin", session);
  ok("rejoin restores session", rejoin.ok && rejoin.payload.code === code);

  // public room listing
  const pubHost = await client("pub");
  const pub = await send(pubHost, "room:create", { name: "PublicTable", teamId: "che", sport: "football", mode: "blitz", public: true, settings: { bidSeconds: 6 } });
  ok("football blitz room created", pub.ok);
  const list = await send(pubHost, "room:list", {});
  ok("public room listed", list.ok && list.rooms.some((r) => r.code === pub.code));
  ok("football pool used", pub.payload.players.length > 100, `players=${pub.payload.players.length}`);
  const fbStart = await send(pubHost, "auction:start");
  ok("football auction starts", fbStart.ok);
  await wait(600);
  const fbState = lastOf(pubHost, "state");
  ok("football queue running", fbState?.total > 0, `total=${fbState?.total}`);

  // ── scenario 2: single owner, no bots → everything goes unsold, then accelerated round
  console.log("\n  …scenario 2: solo table with no AI, unsold flow…");
  const solo = await client("solo");
  const soloCreate = await send(solo, "room:create", {
    name: "SoloOwner", teamId: "che", sport: "cricket", mode: "mega", public: false,
    settings: { bidSeconds: 2, resetSeconds: 2, introSeconds: 0, hammerSeconds: 1, nextDelaySeconds: 1, poolTop: 14 },
  });
  ok("solo table created (no bots)", soloCreate.ok && soloCreate.payload.participants.length === 1);
  ok("mega mode has no retentions", soloCreate.payload.teams.every((t) => (t.retentions || []).length === 0));
  ok("mega mode full purse", soloCreate.payload.teams[0].purseLeftL === 12000, `purse=${soloCreate.payload.teams[0].purseLeftL}`);
  await send(solo, "auction:start");
  const soloDeadline = Date.now() + 130000;
  let soloResults = null;
  while (Date.now() < soloDeadline) {
    soloResults = lastOf(solo, "results");
    if (soloResults) break;
    await wait(400);
  }
  ok("solo auction finished with no bids", !!soloResults);
  ok("every name went unsold", soloResults?.totals?.unsold > 0 && soloResults?.totals?.sold === 0,
    JSON.stringify(soloResults?.totals));
  ok("unsold events were broadcast", solo.events.some((x) => x.e === "unsold"));
  const accel2 = await send(solo, "auction:accelerate");
  ok("accelerated round re-lists unsold names", accel2.ok && accel2.count > 0, JSON.stringify(accel2).slice(0, 100));
  await wait(500);
  const accelState = lastOf(solo, "state");
  ok("accelerated round is live", accelState?.status === "live" && accelState?.total > 0, JSON.stringify({ s: accelState?.status, t: accelState?.total }));
  solo.close();

  // ── perf probe: full 496-name pool, 10 seats, default timers
  const perf = await client("perf");
  const t0 = Date.now();
  const big = await send(perf, "room:create", { name: "Perf", teamId: "guj", sport: "cricket", mode: "mock", public: false, solo: true, botCount: 9 });
  const tCreate = Date.now() - t0;
  ok(`full pool room built in ${tCreate}ms (<2500ms)`, tCreate < 2500 && big.ok, `ms=${tCreate}`);
  ok("full pool queue length", big.payload.queue.length > 380, `queue=${big.payload.queue.length}`);
  ok("sets count in the 40s", big.payload.sets.length >= 30 && big.payload.sets.length <= 60, `sets=${big.payload.sets.length}`);
  const t1 = Date.now();
  await send(perf, "auction:start");
  const tStart = Date.now() - t1;
  ok(`start on the full pool in ${tStart}ms (<1500ms)`, tStart < 1500, `ms=${tStart}`);
  await wait(1200);
  const perfState = lastOf(perf, "state");
  ok("full pool auction is running", ["intro", "bidding"].includes(perfState?.current?.phase), JSON.stringify(perfState?.current?.phase));
  perf.close();

  [spec, host2, pubHost].forEach((c) => c.close());
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("SMOKE TEST CRASH:", e); process.exit(1); });
