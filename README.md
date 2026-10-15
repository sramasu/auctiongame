# 🔨 Auction Arena

A real-time, multiplayer **franchise auction game** you can play in any browser. Ten owners sit at one
table, a pool of ~500 names comes up in ordered sets, and the gavel decides who builds the strongest squad.

Play against friends across the world, spectate a public table, or take on **nine AI owners** with distinct
bidding personalities when nobody else is around.

No sign-up. No install. Mobile-first. Works on a phone in one hand.

---

## Quick start

```bash
npm install          # server + client dependencies
npm run build        # build the React client into client/dist
npm start            # serve the game + realtime API on http://localhost:3000
```

For development with hot reload:

```bash
npm run dev          # node --watch server + vite dev server (proxies /socket.io and /api)
```

Run the test suites (a server must be listening on :3000):

```bash
npm test             # 51 socket/engine assertions: rooms, bidding, bots, RTM, results, reconnects
npm run test:ui      # 31 jsdom assertions: renders and plays Home → Lobby → Auction → Results
```

| Script | What it does |
| --- | --- |
| `npm start` | Serves the built client and the realtime engine on one port (`PORT`, `HOST` env vars) |
| `npm run build` | Vite production build |
| `npm run dev` | Server with `--watch` + Vite dev server in parallel |
| `npm test` | Engine + protocol smoke test (`tests/smoke.js`) |
| `npm run test:ui` | UI integration test (`tests/ui.test.jsx`, bundled with esbuild into jsdom) |

---

## Game modes

| Mode | Pool | Retentions | Purse | RTM cards | Feel |
| --- | --- | --- | --- | --- | --- |
| **Mock Auction** | Full pool (496 cricket names) | Yes — retained squads with illustrative salaries | ₹120 Cr minus retentions | 2 | Authentic season build |
| **Mega Auction** | Top 300 names | No | ₹120 Cr for everyone | 0 | Clean-slate draft |
| **Blitz Draft** | Top 120 names | No | ₹100 Cr | 1 | Fast, 10-second clocks |
| **Custom Table** | Any slice of the pool | Host choice | ₹40–300 Cr | 0–5 | Your house rules |

Both sports ship with a full pool: **cricket (496 names)** and **football (575 names)**.

## Rules engine

* **Bid ladder** — ₹5 L below ₹1 Cr, ₹10 L to ₹2 Cr, ₹25 L to ₹5 Cr, ₹50 L above. Jump bids are allowed up to your purse.
* **Server-authoritative clock** — timers live on the server, so every seat sees the same countdown. A bid inside the
  reset window pushes the clock back out (anti-snipe), and the window **tapers** as a war drags on so contests always converge.
* **Hard validations** — you cannot bid more than your purse, exceed the squad cap, or break the overseas limit.
  Rejected bids return a human-readable reason that the UI shows inline.
* **Phases per name** — `intro → bidding → hammer → (rtm) → sold | unsold`, then auto-advance.
* **Right-To-Match** — a short window after the gavel lets an eligible owner match the final price and take the player.
* **Accelerated round** — re-lists every unsold name at the end with faster clocks.
* **Undo** — the host can reverse the last sale; purse, squad and ledger are restored.

## AI owners

Nine bot franchises, each with a personality (`aggressive`, `shrewd`, `frugal`, `collector`, `balanced`) and a private
wish-list. They value a player from rating, base price, **role need** (their squad's gaps), **urgency** (slots left versus
names left), purse ratio and difficulty (`easy` / `normal` / `insane`). They time their bids to their temperament —
shrewd bots wait for the last seconds — and they back off as the price approaches what they think a player is worth,
which is why names genuinely go unsold.

## Scoring: how a table is graded

`shared/evaluate.js` builds the strongest plausible **best XI** (respecting the overseas-in-XI cap), then blends:

```
strength = XI average (62%) + bench quality (16%) + role balance (12) + squad depth (8)
```

Grades run A+ → F. The results screen also computes awards: biggest splash, steal of the auction,
best value (strength per crore), most active paddle, purse master, and RTM usage.

---

## Feature list

**Table & rooms**

* Six-character room codes, public room browser with live progress, spectator gallery
* Up to 12 franchise seats (10 default cities + 2 extra), host-controlled renaming
* Seat-holding reconnects: refresh or drop and your franchise is waiting when you return
* Host migration if the auctioneer leaves; abandoned rooms are garbage collected

**Bidding**

* Big one-tap bid button with jump multipliers, keyboard shortcuts, and proxy **auto-bidding** with a ceiling slider
* Live bid trail, leader highlight, last-call heartbeat, "GOING…" hammer phase
* Pass on a name, Right-To-Match steals, host pause / next / skip / undo / close-the-book

**Planning & insight**

* **Scouting board** — search and filter the whole pool by role, tier, country; sort by queue order, rating, base or value
* **Target list** — star names; you get an alert the moment one of them reaches the podium (persisted per room)
* **Pacing advisor** — tells you whether you are flush, steady, overstretched or must-fill, with a fair ceiling for the current name
* Live squad strength, role composition, overseas counter, and rule warnings that update after every sale
* Estimated value on each player card, plus an attribute profile modal

**Atmosphere**

* Procedural WebAudio sound design — gavel, bid pings, outbid sting, sold fanfare, ticking last-five seconds (no audio files)
* Confetti bursts, SOLD / UNSOLD stamp animation, floating emoji reactions from the whole table
* Auctioneer commentary feed (wars, steals, splashes), scrolling sales ticker, table chat

**After the hammer**

* Podium, full standings, per-team squad sheets with the best XI highlighted
* Copy a text report, download signings as CSV, or export the whole result set as JSON
* Rematch: the host can re-run the auction with the same table

**Platform**

* PWA manifest + icon, mobile-first layout with a bottom tab bar, safe-area aware
* Dark stadium-night design system, reduced-motion support, accessible labels and tooltips

---

## Architecture

```
server/src/
  index.js            express + compression + static client + /api routes
  net/socket.js       socket.io protocol: rooms, bids, host controls, chat, reconnects
  game/room.js        room store, seats, franchises, serialisation
  game/auction.js     the engine: phases, bidding, RTM, bots, results
  game/pool.js        queue + set builder, retention maths
  game/bus.js         engine → transport pub/sub (keeps the engine pure)
shared/
  constants.js        modes, sports, increments, commentary banks
  teams.js            city franchises, colours, role labels
  players.cricket.js  496-name pool   players.football.js  575-name pool
  retentions.js       illustrative retained squads + purses
  evaluate.js         best XI, strength, grades, pacing advice (shared with the client)
client/src/
  store.jsx           socket wiring + derived game state (single context)
  screens/            Home, Lobby, Auction, Results
  components/         ui kit, effects (sound/confetti/reactions), scouting board
tests/
  smoke.js            engine + protocol suite    ui.test.jsx  jsdom play-through
```

The server owns the clock and every rule; clients render state and send intents. State is pushed as a compact
`state` snapshot (throttled to ~7 Hz) plus discrete events (`bid`, `sold`, `rtm`, `phase`, `feed`, `chat`,
`reaction`) so effects like sound and confetti fire exactly once.

### Protocol

| Client → server | Server → client |
| --- | --- |
| `room:create` `room:join` `room:rejoin` `room:leave` `room:list` | `state` `tick` `player` `phase` |
| `room:pickTeam` `room:rename` `room:settings` | `bid` `pass` `autobid` `sold` `unsold` `rtm` |
| `room:addBots` `room:removeBot` `room:kick` | `feed` `chat` `reaction` `undo` `accelerated` |
| `auction:start` `pause` `next` `skip` `undo` `accelerate` `replayPassed` `finish` | `results` `settings` `participants` `teams` `kicked` |
| `bid:place` `bid:pass` `bid:auto` `rtm:use` `chat:send` `react:send` | |

Every request is acknowledged; failures come back as `{ ok: false, error }` and surface as a toast.

### HTTP

* `GET /api/health` — liveness, room count, uptime
* `GET /api/rooms` — public room directory
* `GET /api/pool?sport=cricket&limit=60` — sample of the player pool

---

## Keyboard shortcuts (auction screen)

| Key | Action |
| --- | --- |
| `Space` / `Enter` | Place the highlighted bid |
| `1` `2` `3` `5` | Set the jump multiplier |
| `P` | Pass on the current player |
| `A` | Proxy auto-bid ceiling |
| `R` | Send a reaction |
| `S` | Scouting board |
| `M` | Mute / unmute |
| `?` | Shortcut help |

## Configuration

| Env | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP + socket port |
| `HOST` | `0.0.0.0` | Bind address |
| `TEST_URL` | `http://127.0.0.1:3000` | Target for `npm test` |

## Notes on the data

Franchise seats are **city-based** (Mumbai, Chennai, Bengaluru, …) and fully renamable by the host, so a table can
brand itself however it likes. Player names are used as factual references; ratings, base prices, retained salaries
and attribute profiles are **illustrative values tuned for gameplay balance**, not real contract data.

## License

MIT — see `LICENSE`.
