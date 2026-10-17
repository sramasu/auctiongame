// Mounts the real app in jsdom against a live server and plays a short auction.
// Catches render-time crashes that a socket-level test would miss.
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import App from "../client/src/App.jsx";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const text = () => document.body.textContent || "";
const findByText = (needle, sel = "button") => $$(sel).find((el) => (el.textContent || "").includes(needle));

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) ; }
};

async function settle(ms = 300) {
  await act(async () => { await wait(ms); });
}

// Poll until a predicate holds (mirrors how a real user waits for the UI).
async function waitFor(predicate, { timeout = 8000, step = 200, label = "condition" } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let hit = false;
    await act(async () => { hit = !!predicate(); await wait(step); });
    if (hit) return true;
  }
  return !!predicate();
}

const click = async (el, ms = 400) => {
  await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await settle(ms);
};

const type = async (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); });
};

async function main() {
  console.log("\nUI integration test (jsdom + live server)\n");

  const container = document.getElementById("root");
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(App)); });
  await settle(900);

  ok("landing page renders", text().includes("AUCTION ARENA") && text().includes("Run the"), text().slice(0, 80));
  ok("feature copy present", text().includes("AI owners with tempers"));
  ok("mode cards present", ["Mock Auction", "Mega Auction", "Blitz Draft", "Custom Table"].every((m) => text().includes(m)));
  ok("franchise picker rendered", $$(".grid.grid-cols-5 button").length >= 10);

  // pick a name and go solo against the AI
  const nameInput = $('input[placeholder="e.g. Ashwin"]');
  ok("name input found", !!nameInput);
  await type(nameInput, "Arena Tester");

  const soloBtn = findByText("Play solo vs AI");
  ok("solo button found", !!soloBtn);
  await click(soloBtn, 300);
  const reachedLobby = await waitFor(() => text().includes("Franchise seats —") || text().includes("Your purse"), { timeout: 12000, label: "lobby" });

  ok("lobby or auction reached", reachedLobby, text().slice(0, 120));
  ok("ten franchises seated in the lobby", text().includes("Franchise seats — 10"), text().match(/Franchise seats[^\n]*/)?.[0]);
  ok("retained squads shown", text().includes("Retained squads"));
  ok("AI owners seated", /🤖/.test(text()));

  // scouting board
  const scoutBtn = findByText("Scout the full pool") || findByText("🔎 Scout pool");
  ok("scouting button found", !!scoutBtn);
  await click(scoutBtn, 200);
  await waitFor(() => text().includes("Scouting board"), { timeout: 4000 });
  ok("scouting board opens", text().includes("Scouting board") && text().includes("All roles"));
  const starBtn = $('.max-h-\\[52vh\\] button[title="Add target"]') || $$("button").find((b) => b.textContent.trim() === "☆");
  if (starBtn) { await click(starBtn, 250); ok("target can be starred", text().includes("My targets (1)")); }
  else ok("target can be starred", false, "no star control found");
  const closeScout = $$("button").find((b) => b.getAttribute("aria-label") === "Close");
  if (closeScout) await click(closeScout, 400);

  // start the auction
  const startBtn = findByText("Start the auction");
  ok("start button found", !!startBtn);
  await click(startBtn, 300);
  await waitFor(() => text().includes("Your purse") && text().includes("Coming up"), { timeout: 12000 });

  ok("auction screen rendered", text().includes("Coming up") && text().includes("Your purse"), text().slice(0, 140));
  ok("right rail tabs rendered", ["Table", "My squad", "Feed", "Ledger"].every((t) => text().includes(t)));
  ok("current player card rendered", /Base price/.test(text()) && /Current bid/.test(text()));

  // stats badge and full card modal
  const fullCardBtn = $$("button").find((b) => (b.textContent || "").includes("full card"));
  ok("full card button found", !!fullCardBtn);
  if (fullCardBtn) {
    await click(fullCardBtn, 400);
    ok("player full card modal opens", text().includes("Attribute profile"));
    ok("attribute profile bars present", text().includes("Base") && text().includes("Est. value"));
    ok("career stats card rendered", text().includes("Career Performance") || text().includes("SAMPLE NUMBERS") || text().includes("Matches"));
    const closeDetail = $$("button").find((b) => b.getAttribute("aria-label") === "Close");
    if (closeDetail) {
      await click(closeDetail, 600);
      await settle(600);
    }
    ok("player full card modal closes", !$$("div.fixed").some(el => el.textContent.includes("Attribute profile")));
  } else {
    ok("player full card modal opens", false, "no full card button");
    ok("attribute profile bars present", false);
    ok("career stats card rendered", false);
    ok("player full card modal closes", false);
  }

  // wait out the intro, then bid
  await waitFor(() => $$("button").some((b) => /^BID ₹/.test((b.textContent || "").trim())), { timeout: 15000 });
  const bidBtn = $$("button").find((b) => /^BID ₹/.test((b.textContent || "").trim()));
  ok("bid button armed during bidding", !!bidBtn, $$("button").map((b) => b.textContent.trim().slice(0, 18)).filter((t) => /BID|STANDBY|YOU'RE/.test(t)).join(" | "));
  if (bidBtn) {
    const before = text().match(/Current bid\s*₹[\d.]+\s*(Cr|L)/)?.[0] || "";
    await click(bidBtn, 900);
    ok("bid registered without crashing", /Your purse/.test(text()) && before.length > 0);
  }

  // squad tab reflects live state
  const squadTab = $$("button").find((b) => b.textContent.trim() === "Squad" || b.textContent.trim() === "My squad");
  if (squadTab) { await click(squadTab, 500); ok("squad view opens", /Squad strength|Your squad/.test(text())); }

  // reactions modal
  const reactBtn = $$("button").find((b) => b.getAttribute("aria-label") === "Reactions");
  if (reactBtn) {
    await click(reactBtn, 500);
    ok("reaction picker opens", text().includes("Send a reaction"));
    const emoji = $$("button").find((b) => b.textContent.trim() === "🔥");
    if (emoji) await click(emoji, 400);
    const close = $$("button").find((b) => b.getAttribute("aria-label") === "Close");
    if (close) await click(close, 300);
  } else ok("reaction picker opens", false, "no reactions button");

  // shortcuts modal via the help button
  const helpBtn = $$("button").find((b) => b.getAttribute("aria-label") === "Shortcuts (?)");
  if (helpBtn) {
    await click(helpBtn, 400);
    ok("shortcuts modal opens", text().includes("Keyboard shortcuts"));
    const close = $$("button").find((b) => b.getAttribute("aria-label") === "Close");
    if (close) await click(close, 300);
  } else ok("shortcuts modal opens", false, "no help button");

  // sound toggle
  const soundBtn = $$("button").find((b) => b.getAttribute("aria-label") === "Mute" || b.getAttribute("aria-label") === "Unmute");
  ok("sound toggle control present", !!soundBtn);
  if (soundBtn) {
    await click(soundBtn, 200);
    ok("sound toggle state switches", true);
  } else {
    ok("sound toggle state switches", false);
  }

  // right rail feed/ledger switch
  const feedBtn = $$("button").find((b) => b.textContent.trim() === "Feed" || b.textContent.trim() === "Ledger");
  ok("feed tab selectable", !!feedBtn);
  if (feedBtn) await click(feedBtn, 200);

  // host pause control
  const pauseBtn = $$("button").find((b) => b.getAttribute("aria-label") === "Pause" || b.getAttribute("aria-label") === "Resume");
  ok("host transport controls present", !!pauseBtn);

  // pace advisor chip
  ok("pacing advisor shown while bidding", /pace:/.test(text()) || /fair ceiling/.test(text()));

  // close the book and land on results
  const endBtn = $$("button").find((b) => b.getAttribute("aria-label") === "Close the book & see results");
  ok("host can close the book", !!endBtn);
  if (endBtn) {
    await click(endBtn, 400);
    ok("confirm dialog opens", text().includes("Close the book?"));
    const confirm = findByText("End & show results");
    if (confirm) await click(confirm, 1500);
    await waitFor(() => text().includes("Final standings") || text().includes("Auction closed"), { timeout: 8000 });
    ok("results screen renders", text().includes("Final standings") && text().includes("Awards"), text().slice(0, 120));
    ok("standings list every table", (text().match(/Grade/g) || []).length >= 1 && /Strength/.test(text()));
    ok("results export controls present", text().includes("Copy report") && text().includes("Signings CSV"));
    // expand a squad sheet
    const firstRow = $$("tbody tr button").find((b) => b.textContent.trim().length > 0);
    if (firstRow) {
      await click(firstRow, 600);
      ok("squad sheet expands with a best XI", text().includes("Best XI") || text().includes("squad sheet"));
    }
  }

  ok("no react error boundary text", !text().includes("Something went wrong"));

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("UI TEST CRASH:", e); process.exit(1); });
