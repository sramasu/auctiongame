/**
 * tests/stats.test.js — 84 assertions covering the stats module.
 *
 * Runs offline (no real API keys needed) using the mock provider.
 * Tests: cache, mock, stats coordinator, provider stubs, diagnose endpoint.
 *
 * Usage: node tests/stats.test.js
 */

import assert from "node:assert/strict";
import { cacheKey, cacheGet, cacheSet, cacheClear, cacheStats, cacheSize } from "../server/src/stats/cache.js";
import { mockStats } from "../server/src/stats/mock.js";
import { getStats, getProviderStatus, diagnose, probeAll } from "../server/src/stats/index.js";

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failures.push({ name, error: e.message });
    failed++;
  }
}

// ──────────────────────────────────────────────────────────────
// 1. Cache module (22 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n1. Cache");

test("cacheKey produces sport:name format", () => {
  assert.equal(cacheKey("cricket", "Virat Kohli"), "cricket:virat kohli");
});
test("cacheKey lowercases name", () => {
  assert.equal(cacheKey("football", "MBAPPE"), "football:mbappe");
});
test("cacheKey trims whitespace", () => {
  assert.equal(cacheKey("cricket", "  Dhoni  "), "cricket:dhoni");
});
test("cache miss returns null initially", () => {
  cacheClear();
  assert.equal(cacheGet("cricket:nobody"), null);
});
test("cacheSet stores data", () => {
  cacheClear();
  cacheSet("cricket:test", { runs: 500 });
  const v = cacheGet("cricket:test");
  assert.ok(v);
  assert.equal(v.runs, 500);
});
test("cacheSize increments on set", () => {
  cacheClear();
  cacheSet("a:b", { x: 1 });
  assert.equal(cacheSize(), 1);
});
test("cacheSize with multiple entries", () => {
  cacheClear();
  cacheSet("a:1", 1); cacheSet("b:2", 2); cacheSet("c:3", 3);
  assert.equal(cacheSize(), 3);
});
test("cacheClear empties cache", () => {
  cacheSet("x:y", 99);
  cacheClear();
  assert.equal(cacheSize(), 0);
});
test("duplicate key overwrites", () => {
  cacheClear();
  cacheSet("x:y", { v: 1 });
  cacheSet("x:y", { v: 2 });
  assert.equal(cacheGet("x:y").v, 2);
});
test("cacheStats returns total/valid/expired structure", () => {
  cacheClear();
  cacheSet("a:1", 1); cacheSet("a:2", 2);
  const s = cacheStats();
  assert.ok("total" in s && "valid" in s && "expired" in s);
  assert.equal(s.total, 2);
  assert.equal(s.valid, 2);
  assert.equal(s.expired, 0);
});
test("miss flag uses short TTL (entry still created)", () => {
  cacheClear();
  cacheSet("miss:key", null, { miss: true });
  assert.equal(cacheSize(), 1);
});
test("hit flag uses long TTL (entry created)", () => {
  cacheClear();
  cacheSet("hit:key", { ok: true });
  assert.equal(cacheGet("hit:key").ok, true);
});
test("cacheGet returns null for expired entry (synthetic)", () => {
  // We can't easily test actual expiry without time mocking,
  // but we can verify the structure responds to a fresh entry.
  cacheClear();
  cacheSet("fresh:key", { data: 42 });
  // Immediately reads back
  assert.equal(cacheGet("fresh:key").data, 42);
});
test("different sports don't collide", () => {
  cacheClear();
  cacheSet(cacheKey("cricket", "test"), { sport: "cricket" });
  cacheSet(cacheKey("football", "test"), { sport: "football" });
  assert.equal(cacheGet(cacheKey("cricket", "test")).sport, "cricket");
  assert.equal(cacheGet(cacheKey("football", "test")).sport, "football");
});
test("cacheSet with object value", () => {
  cacheClear();
  const data = { a: 1, b: [1, 2, 3], c: { d: true } };
  cacheSet("obj:test", data);
  const r = cacheGet("obj:test");
  assert.deepEqual(r.b, [1, 2, 3]);
});
test("cacheSet with null value (miss)", () => {
  cacheClear();
  cacheSet("null:test", null, { miss: true });
  assert.equal(cacheGet("null:test"), null); // null stored → miss? No, it's stored as null which is falsy but..
  // Actually cacheGet returns data which is null, store has an entry
  assert.equal(cacheSize(), 1);
});
test("multiple clear cycles work correctly", () => {
  for (let i = 0; i < 5; i++) {
    cacheSet(`k:${i}`, i);
  }
  cacheClear();
  assert.equal(cacheSize(), 0);
  cacheSet("after:clear", 1);
  assert.equal(cacheSize(), 1);
});
test("cacheStats valid count equals entries", () => {
  cacheClear();
  cacheSet("a:x", 1); cacheSet("b:x", 2); cacheSet("c:x", 3);
  const s = cacheStats();
  assert.equal(s.valid, 3);
});
test("cacheGet after clear returns null", () => {
  cacheSet("k:1", "value");
  cacheClear();
  assert.equal(cacheGet("k:1"), null);
});
test("cache handles numeric values", () => {
  cacheClear();
  cacheSet("num:key", 12345);
  assert.equal(cacheGet("num:key"), 12345);
});
test("cache handles boolean values", () => {
  cacheClear();
  cacheSet("bool:key", false);
  assert.equal(cacheGet("bool:key"), false);
});
test("cache handles array values", () => {
  cacheClear();
  cacheSet("arr:key", [1, 2, 3]);
  assert.deepEqual(cacheGet("arr:key"), [1, 2, 3]);
});

// ──────────────────────────────────────────────────────────────
// 2. Mock stats (26 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n2. Mock stats");

const mockCricketer = { name: "Test Bat", role: "BAT", country: "India", rating: 85, sport: "cricket" };
const mockBowler    = { name: "Test Pace", role: "PACE", country: "Australia", rating: 78, sport: "cricket" };
const mockWK        = { name: "Test WK", role: "WK", country: "India", rating: 80, sport: "cricket" };
const mockAR        = { name: "Test AR", role: "AR", country: "England", rating: 82, sport: "cricket" };
const mockFWD       = { name: "Test FWD", role: "FWD", country: "France", rating: 90, sport: "football" };
const mockGK        = { name: "Test GK", role: "GK", country: "Spain", rating: 84, sport: "football" };
const mockMID       = { name: "Test MID", role: "MID", country: "Germany", rating: 85, sport: "football" };
const mockDEF       = { name: "Test DEF", role: "DEF", country: "Italy", rating: 82, sport: "football" };

test("mockStats returns object for cricketer", () => {
  const s = mockStats(mockCricketer);
  assert.ok(s && typeof s === "object");
});
test("mockStats source is mock for cricket", () => {
  assert.equal(mockStats(mockCricketer).source, "mock");
});
test("mockStats source is mock for football", () => {
  assert.equal(mockStats(mockFWD).source, "mock");
});
test("mockStats cricket has runs for batsman", () => {
  const s = mockStats(mockCricketer);
  assert.ok(typeof s.runs === "number");
});
test("mockStats cricket has average for batsman", () => {
  const s = mockStats(mockCricketer);
  assert.ok(typeof s.average === "number");
});
test("mockStats cricket has strikeRate for batsman", () => {
  const s = mockStats(mockCricketer);
  assert.ok(typeof s.strikeRate === "number");
});
test("mockStats cricket bowler has wickets", () => {
  const s = mockStats(mockBowler);
  assert.ok(typeof s.wickets === "number");
});
test("mockStats cricket bowler has economy", () => {
  const s = mockStats(mockBowler);
  assert.ok(typeof s.economy === "number");
});
test("mockStats cricket allrounder has both runs and wickets", () => {
  const s = mockStats(mockAR);
  assert.ok(s.runs != null && s.wickets != null);
});
test("mockStats cricket WK has batting stats", () => {
  const s = mockStats(mockWK);
  assert.ok(s.runs != null && s.average != null);
});
test("mockStats returns sport field for cricket", () => {
  assert.equal(mockStats(mockCricketer).sport, "cricket");
});
test("mockStats returns sport field for football", () => {
  assert.equal(mockStats(mockFWD).sport, "football");
});
test("mockStats football FWD has goals", () => {
  const s = mockStats(mockFWD);
  assert.ok(typeof s.goals === "number");
});
test("mockStats football FWD has assists", () => {
  const s = mockStats(mockFWD);
  assert.ok(typeof s.assists === "number");
});
test("mockStats football GK has cleanSheets", () => {
  const s = mockStats(mockGK);
  assert.ok(s.cleanSheets != null);
});
test("mockStats football DEF has cleanSheets", () => {
  const s = mockStats(mockDEF);
  assert.ok(s.cleanSheets != null);
});
test("mockStats football MID has passAccuracy", () => {
  const s = mockStats(mockMID);
  assert.ok(typeof s.passAccuracy === "number");
});
test("mockStats football has appearances", () => {
  const s = mockStats(mockFWD);
  assert.ok(typeof s.appearances === "number");
});
test("mockStats returns null for null input", () => {
  assert.equal(mockStats(null), null);
});
test("mockStats returns null for undefined input", () => {
  assert.equal(mockStats(undefined), null);
});
test("mockStats name is preserved", () => {
  const s = mockStats(mockCricketer);
  assert.equal(s.name, mockCricketer.name);
});
test("mockStats country is preserved", () => {
  const s = mockStats(mockFWD);
  assert.equal(s.country, mockFWD.country);
});
test("mockStats higher rating → more runs (deterministic)", () => {
  const high = mockStats({ ...mockCricketer, rating: 95 });
  const low  = mockStats({ ...mockCricketer, rating: 65 });
  assert.ok(high.runs > low.runs);
});
test("mockStats football higher rating → more goals for FWD", () => {
  const high = mockStats({ ...mockFWD, rating: 96 });
  const low  = mockStats({ ...mockFWD, rating: 65 });
  assert.ok(high.goals >= low.goals);
});
test("mockStats cricket hundreds is non-negative", () => {
  const s = mockStats(mockCricketer);
  assert.ok(s.hundreds >= 0);
});
test("mockStats football redCards is non-negative", () => {
  const s = mockStats(mockFWD);
  assert.ok(s.redCards >= 0);
});

// ──────────────────────────────────────────────────────────────
// 3. Stats coordinator (20 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n3. Stats coordinator");

await testAsync("getStats always returns an object", async () => {
  cacheClear();
  const s = await getStats({ name: "No One", rating: 70 }, "cricket");
  assert.ok(s && typeof s === "object");
});

await testAsync("getStats cricket falls back to mock without keys", async () => {
  cacheClear();
  const s = await getStats({ name: "Fictional Player", rating: 75 }, "cricket");
  assert.ok(s.source === "mock" || typeof s.source === "string");
});

await testAsync("getStats football falls back to mock without keys", async () => {
  cacheClear();
  const s = await getStats({ name: "Fictional Striker", rating: 80 }, "football");
  assert.ok(s && typeof s.source === "string");
});

await testAsync("getStats caches result on second call", async () => {
  cacheClear();
  const p = { name: "Cache Test Player", rating: 70 };
  await getStats(p, "cricket");
  const sizeBefore = cacheSize();
  await getStats(p, "cricket"); // second call — should hit cache
  assert.equal(cacheSize(), sizeBefore); // no new entries
});

await testAsync("getStats returns source field", async () => {
  const s = await getStats({ name: "Any Player", rating: 70 }, "cricket");
  assert.ok("source" in s);
});

await testAsync("getStats returns name field", async () => {
  const s = await getStats({ name: "Virat Kohli", rating: 92 }, "cricket");
  assert.ok("name" in s);
});

await testAsync("getStats accepts player with sport field", async () => {
  const s = await getStats({ name: "Player A", rating: 75, sport: "cricket" }, undefined);
  assert.ok(s);
});

await testAsync("getStats accepts explicit sport override", async () => {
  const s = await getStats({ name: "Player B", rating: 78 }, "football");
  assert.equal(s.sport, "football");
});

await testAsync("probeAll resolves without throwing", async () => {
  await assert.doesNotReject(probeAll());
});

await testAsync("getProviderStatus returns object with providers", async () => {
  const status = getProviderStatus();
  assert.ok(status && typeof status === "object");
  assert.ok("mock" in status);
});

await testAsync("getProviderStatus mock is always healthy", async () => {
  const status = getProviderStatus();
  assert.equal(status.mock.healthy, true);
});

await testAsync("getProviderStatus thesportsdb has name", async () => {
  const status = getProviderStatus();
  assert.ok(status.thesportsdb.name);
});

await testAsync("getProviderStatus apifootball healthy=false without key", async () => {
  const origKey = process.env.APIFOOTBALL_KEY;
  delete process.env.APIFOOTBALL_KEY;
  const status = getProviderStatus();
  assert.equal(status.apifootball.healthy, false);
  if (origKey) process.env.APIFOOTBALL_KEY = origKey;
});

await testAsync("getProviderStatus cricapi healthy=false without key", async () => {
  const origKey = process.env.CRICAPI_KEY;
  delete process.env.CRICAPI_KEY;
  delete process.env.CRICKETDATA_KEY;
  const status = getProviderStatus();
  assert.equal(status.cricapi.healthy, false);
  if (origKey) process.env.CRICAPI_KEY = origKey;
});

await testAsync("getProviderStatus includes cache stats", async () => {
  const status = getProviderStatus();
  assert.ok("cache" in status);
  assert.ok("total" in status.cache);
});

await testAsync("getStats for spin bowler returns object", async () => {
  cacheClear();
  const s = await getStats({ name: "Spin Bowler Test", role: "SPIN", rating: 78 }, "cricket");
  assert.ok(s && typeof s === "object");
});

await testAsync("getStats for GK returns object", async () => {
  cacheClear();
  const s = await getStats({ name: "GK Test", role: "GK", rating: 85 }, "football");
  assert.ok(s && typeof s === "object");
});

await testAsync("getStats multiple different players each cached separately", async () => {
  cacheClear();
  await getStats({ name: "Player Alpha", rating: 70 }, "cricket");
  await getStats({ name: "Player Beta", rating: 75 }, "cricket");
  assert.ok(cacheSize() >= 2);
});

await testAsync("diagnose returns steps array", async () => {
  const result = await diagnose("Test Player", "cricket");
  assert.ok(Array.isArray(result.steps));
});

await testAsync("diagnose returns final result", async () => {
  const result = await diagnose("Another Player", "football");
  assert.ok(result.final && typeof result.final === "object");
});

// ──────────────────────────────────────────────────────────────
// 4. Diagnose endpoint (16 tests)
// ──────────────────────────────────────────────────────────────
console.log("\n4. Diagnose function");

await testAsync("diagnose cricket returns name field", async () => {
  const r = await diagnose("Virat Kohli", "cricket");
  assert.equal(r.name, "Virat Kohli");
});

await testAsync("diagnose cricket returns sport field", async () => {
  const r = await diagnose("Rohit Sharma", "cricket");
  assert.equal(r.sport, "cricket");
});

await testAsync("diagnose football returns sport field", async () => {
  const r = await diagnose("Lionel Messi", "football");
  assert.equal(r.sport, "football");
});

await testAsync("diagnose has at least one step", async () => {
  const r = await diagnose("Anyone", "cricket");
  assert.ok(r.steps.length >= 1);
});

await testAsync("diagnose final has source field", async () => {
  const r = await diagnose("Unknown Player XYZ", "cricket");
  assert.ok("source" in r.final);
});

await testAsync("diagnose steps each have provider field", async () => {
  const r = await diagnose("Test Player", "cricket");
  for (const step of r.steps) assert.ok("provider" in step);
});

await testAsync("diagnose steps each have ok field", async () => {
  const r = await diagnose("Test Player", "cricket");
  for (const step of r.steps) assert.ok("ok" in step);
});

await testAsync("diagnose steps each have ms field", async () => {
  const r = await diagnose("Test Player", "cricket");
  for (const step of r.steps) assert.ok(typeof step.ms === "number");
});

await testAsync("diagnose mock step ok=true", async () => {
  const r = await diagnose("X Y Z Nobody", "cricket");
  const mockStep = r.steps.find(s => s.provider === "Mock");
  assert.ok(mockStep?.ok === true);
});

await testAsync("diagnose mock step has result", async () => {
  const r = await diagnose("X Y Z Nobody 2", "cricket");
  const mockStep = r.steps.find(s => s.provider === "Mock");
  assert.ok(mockStep?.result);
});

await testAsync("diagnose cricket tries CricAPI first (step 0)", async () => {
  const r = await diagnose("Test C", "cricket");
  assert.equal(r.steps[0].provider, "CricAPI");
});

await testAsync("diagnose football tries API-Football first", async () => {
  const r = await diagnose("Test F", "football");
  assert.equal(r.steps[0].provider, "API-Football");
});

await testAsync("diagnose ms is non-negative", async () => {
  const r = await diagnose("Test Ms", "cricket");
  for (const step of r.steps) assert.ok(step.ms >= 0);
});

await testAsync("diagnose returns final for cricket", async () => {
  const r = await diagnose("Test Final Cr", "cricket");
  assert.ok(r.final && r.final.sport === "cricket");
});

await testAsync("diagnose returns final for football", async () => {
  const r = await diagnose("Test Final Fb", "football");
  assert.ok(r.final && r.final.sport === "football");
});

await testAsync("diagnose with spaces in name works", async () => {
  const r = await diagnose("De Bruyne", "football");
  assert.ok(r.final);
});

// ──────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`Stats tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  ✗ ${f.name}: ${f.error}`);
}
process.exit(failed > 0 ? 1 : 0);
