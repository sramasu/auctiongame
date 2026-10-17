# Auction Arena — Complete Project Blueprint & Specification

> **A real-time multiplayer franchise auction game with live sports stats, bot AI personalities, and anti-snipe bidding.**
> Inspired by the thrill of the IPL Mega Auction and European transfer deadline day.

---

## 1. Executive Summary & Pitch

Auction Arena is a high-fidelity, real-time multiplayer web application where 1 to 12 players (humans or automated AI personalities) bid for real-world cricket and football athletes under authentic salary cap, squad size, and foreign player constraints. It features dynamic bid ladders, anti-snipe clock resets, Right-To-Match (RTM) mechanics, automated evaluation formulas grading squad strength, live player statistics integration with multi-tier caching and deterministic mock fallbacks, and join-in-progress room management.

---

## 2. Base Inspirations & Attribution

| Base / Reference | Link | Core Concepts Adopted |
| :--- | :--- | :--- |
| **Play Auction Game** | [playauctiongame.com](https://www.playauctiongame.com/) | Real-time room bidding loop, team purses, basic squad limits |
| **Official Rules & Ladders** | [playauctiongame.com/how-to-play](https://www.playauctiongame.com/how-to-play) | Bid increment ladders, countdown clock standards, pool sizes |
| **IPL Auction Regulations** | BCCI IPL Governing Council Guidelines | ₹120 Cr purse, 18–25 squad caps, 8 overseas limit, RTM cards, retention deductions |
| **European Football Fair Play** | UEFA Club Licensing & Financial Sustainability | Squad composition, wage bill balance, positional requirements |

---

## 3. Product Specification & Game Mechanics

### 3.1 Financials & Purses
- **Starting Purse**: ₹120 Crore (12,000 Lakhs) in standard/mega modes; customizable ₹20 Cr – ₹500 Cr.
- **Bid Increments Ladder**:
  - Below ₹1 Cr: **+₹5 Lakhs**
  - ₹1 Cr to ₹2 Cr: **+₹10 Lakhs**
  - ₹2 Cr to ₹5 Cr: **+₹25 Lakhs**
  - Above ₹5 Cr: **+₹50 Lakhs**
- **Purse Compliance**: A bid is strictly rejected if `currentBid + nextIncrement > purseLeft` or if remaining purse cannot fulfill the minimum squad size at base price.

### 3.2 Timers & Anti-Snipe Phase Machine
- **Phase Flow**: `intro` (3s) → `bidding` (20s) → `hammer` (3s x 3 calls) → `rtm` (8s if contested) → `sold` / `unsold` (4s delay) → next player.
- **Anti-Snipe Reset**: When a bid is submitted with less than `resetSeconds` remaining, clock extends back to `resetSeconds`.
- **Anti-Snipe Tapering**: To avoid infinite loops, extensions taper down after 6 consecutive bids and cap strictly at `MAX_EXTENSIONS = 14`.

### 3.3 Squad Composition Constraints
- **Cricket (IPL Style)**:
  - Squad Size: Minimum 18, Maximum 25 players.
  - Overseas Limit: Maximum 8 overseas players per franchise; exactly 4 in the Best XI.
  - Mandatory Roles: At least 1 Wicketkeeper (WK), 3 Batters (BAT), 2 All-Rounders (AR), 3 Pace Bowlers (PACE), 2 Spinners (SPIN).
- **Football (European Style)**:
  - Squad Size: Minimum 20, Maximum 28 players.
  - Mandatory Roles: At least 2 Goalkeepers (GK), 6 Defenders (DEF), 6 Midfielders (MID), 4 Forwards (FWD).

### 3.4 Right-To-Match (RTM) Engine
- Eligible previous franchises holding remaining RTM cards can match the highest hammer bid within an 8-second window to retain the athlete.

### 3.5 AI Franchise Personalities & Bot Ceiling Formula
Each AI owner is assigned an archetype with distinct bidding behavior:
- `moneyball` (value-driven, strict ceiling at 1.1x valuation)
- `galactico` (marquee hunter, bids up to 1.45x for 88+ rated players)
- `hoarder` (depth-first, bids aggressively on emerging domestic talents)
- `tactician` (role-need optimizer, bids up to 1.3x when filling positional deficits)
- `bully` (counter-bids rival human owners to inflate table prices)

$$\text{Ceiling} = \text{BaseValuation} \times \text{RatingMultiplier} \times \text{NeedMultiplier} \times \text{StyleMultiplier} \times \text{TableUrgency}$$

### 3.6 Squad Evaluation Formula
At the close of auction, squads are evaluated and ranked:
- **Best XI Selection**: Solves optimal lineup satisfying all positional and overseas constraints.
- **Squad Strength Score**: Weighted average of Best XI player ratings (80%) + bench depth rating (20%).
- **Grade Assignment**: `A+` (≥87), `A` (≥82), `B+` (≥77), `B` (≥72), `C` (≥67), `D` (<67).
- **Awards Generated**: Champion, Best Value Buy, Steal of the Auction, Overpay of the Night, Most Balanced Squad.

---

## 4. Data Specification & Stats Providers

### 4.1 Player Pools
- **Cricket Pool**: 496 players across 5 sets (Marquee, Elite, Core, Support, Emerging).
- **Football Pool**: 575 players across 5 sets.

### 4.2 Verified Stats Providers & Priority Chain
When a player is brought to the podium, statistics are fetched asynchronously via a resilient fallback chain:
1. **Primary Sports APIs**:
   - **Cricket**: CricAPI / CricketData (`CRICAPI_KEY` or `CRICKETDATA_KEY`).
   - **Football**: API-Football (`APIFOOTBALL_KEY`).
2. **Secondary Enrichment**:
   - **TheSportsDB**: Public test key `123` provides player profiles, cutouts, DOB, and bio information for both cricket and football. (Note: Retired key `3` is not used).
3. **Deterministic Mock Fallback**:
   - Synthesizes realistic career performance numbers derived from player ratings, roles, and caps when third-party APIs are unconfigured or rate-limited.
4. **In-Memory TTL Caching**:
   - 60-minute TTL for successful provider responses.
   - 5-minute TTL for errors / misses to prevent rapid quota depletion.

---

## 5. System Architecture

```
                  ┌───────────────────────────────┐
                  │       Client (React + Vite)    │
                  │  Framer Motion, Tailwind CSS  │
                  └──────────────┬────────────────┘
                                 │ HTTP / WebSockets
                                 ▼
                  ┌───────────────────────────────┐
                  │     Server (Node + Express)   │
                  │   Socket.IO Connection Layer  │
                  └──────┬─────────────────┬──────┘
                         │                 │
          ┌──────────────┴──────┐   ┌──────┴──────────────┐
          │  Auction Engine     │   │  Stats Coordinator  │
          │  Room / Bot Logic   │   │  TTL Cache + Fetch  │
          └─────────────────────┘   └──────────┬──────────┘
                                               │
                        ┌──────────────────────┼──────────────────────┐
                        ▼                      ▼                      ▼
               TheSportsDB (123)     API-Football (Key)      Mock Fallback
```

### 5.1 Single-Origin Topology
The Express server serves static client production bundles from `client/dist` while mounting REST endpoints and Socket.IO on the same port (`PORT=3000`).

### 5.2 Real-Time Socket Protocol
- **Client to Server**:
  - `room:create`, `room:join`, `room:join-live`, `room:rejoin`, `room:leave`, `room:list`, `room:state`
  - `auction:start`, `auction:pause`, `auction:next`, `auction:skip`, `auction:undo`, `auction:accelerate`, `auction:finish`
  - `bid:place`, `bid:pass`, `bid:auto`, `rtm:use`
  - `chat:send`, `react:send`
- **Server to Client Broadcasts**:
  - `state`, `player`, `bid`, `hammer`, `rtm`, `sold`, `unsold`, `pass`, `feed`, `chat`, `reaction`, `results`, `stats`

---

## 6. Verification & Test Strategy (224 Assertions)

The testing pyramid is divided across four suites totaling 224 green assertions:

1. **Smoke Test Suite (`tests/smoke.js`) — 74 Assertions**:
   - Room lifecycle, franchise seat allocation, 12-seat cap enforcement.
   - Live bidding, anti-snipe tapering, auto-bid ceilings, undo sales, accelerated rounds.
   - REST stats API verification (`/api/stats/status`, `/api/stats/diagnose`, `/api/stats/player`).
   - Join-in-progress room takeovers and transport controls.
2. **Stats Module Suite (`tests/stats.test.js`) — 84 Assertions**:
   - TTL cache key normalization, hit/miss expirations, eviction policies.
   - Deterministic mock generation for both sports.
   - Provider adapters (TheSportsDB, API-Football, CricAPI) and fallback coordinator.
3. **Persistence Suite (`tests/persistence.test.js`) — 27 Assertions**:
   - Room creation persistence, seat-holding on disconnect, token-based rejoining.
   - Spectator restrictions and mid-match live takeover validation.
4. **UI Integration Suite (`tests/ui.test.jsx`) — 39 Assertions**:
   - jsdom headless rendering against live running server.
   - Landing page, franchise selection, scouting board, live bidding interaction.
   - Player card attribute bars, live stats badges, reactions, keyboard shortcuts modal, and final standings export.

---

## 7. Milestone Build Order & Roadmap

1. **Milestone 1**: Core Data & Constants (496 Cricket / 575 Football players, teams, evaluate).
2. **Milestone 2**: Auction Phase Engine & Room Model (timings, bid ladder, anti-snipe).
3. **Milestone 3**: Bot AI Personalities (ceilings, bidding urgency, RTM).
4. **Milestone 4**: WebSockets & Protocol (rooms, reconnects, join-live).
5. **Milestone 5**: Live Stats Coordinator & TTL Cache (TheSportsDB, CricAPI, Mock).
6. **Milestone 6**: React Frontend & Animations (glassmorphism UI, timer ring, sound effects).
7. **Milestone 7**: Client Stats Display & Scouting Drawer.
8. **Milestone 8**: Full End-to-End Test Suite (224 assertions verified).

---

## 8. Hard-Won Pitfalls & Implementation Notes

1. **Route Ordering**: Ensure `/api/stats/*` and API routes precede the Express static fallback `app.use("*", ...)`.
2. **TDZ & Cyclic Dependencies**: Keep evaluator pure and detached from socket broadcasting.
3. **Flat Stats Payload**: Third-party providers nest stats under unpredictable schemas; normalize them into a uniform flat dictionary before sending to the client.
4. **TheSportsDB API Key**: The public key is `123`; the deprecated free key `3` returns HTTP 403.
5. **CricAPI Pagination**: CricAPI limits results to 5 per page; handle offset pagination to ensure exact name matching.
6. **Anti-Snipe Clock Bounding**: Clamp clock resets to prevent infinite ping-pong wars between automated bots.
7. **Seat Holding in Lobby**: Preserve host token on browser refresh while freeing non-host guests who disconnect before game start.

---

## 9. License

MIT License — Copyright (c) 2026 Auction Arena contributors.
Images and sports data referenced under Fair Use / Creative Commons attribution.
