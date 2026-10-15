export const LAKH_PER_CR = 100;

export const SPORTS = {
  cricket: {
    id: "cricket",
    label: "Cricket",
    icon: "🏏",
    roles: ["BAT", "WK", "AR", "PACE", "SPIN"],
    domestic: "IN",
    defaults: { minSquad: 18, maxSquad: 25, maxOverseas: 8, overseasInXI: 4 },
  },
  football: {
    id: "football",
    label: "Football",
    icon: "⚽",
    roles: ["GK", "DEF", "MID", "FWD"],
    domestic: null,
    defaults: { minSquad: 20, maxSquad: 28, maxOverseas: null, overseasInXI: null },
  },
};

export const MODES = {
  mock: {
    id: "mock",
    label: "Mock Auction",
    tag: "Most popular",
    blurb: "Full pool with retained squads, tighter purses and Right-To-Match cards.",
    retentions: true,
    rtmCards: 2,
    poolTop: 0, // 0 = whole pool
    budgetCr: 120,
  },
  mega: {
    id: "mega",
    label: "Mega Auction",
    tag: "Full experience",
    blurb: "No retentions. Every team starts with a full ₹120 Cr purse and a clean slate.",
    retentions: false,
    rtmCards: 0,
    poolTop: 300,
    budgetCr: 120,
  },
  blitz: {
    id: "blitz",
    label: "Blitz Draft",
    tag: "Fast & furious",
    blurb: "Only the top 120 names, rapid timers, ₹100 Cr purse. A 15-minute auction.",
    retentions: false,
    rtmCards: 1,
    poolTop: 120,
    budgetCr: 100,
    bidSeconds: 10,
    resetSeconds: 5,
  },
  custom: {
    id: "custom",
    label: "Custom Table",
    tag: "House rules",
    blurb: "You control the purse, timers, squad limits and pool size.",
    retentions: false,
    rtmCards: 0,
    poolTop: 0,
    budgetCr: 120,
  },
};

export const DEFAULT_SETTINGS = {
  sport: "cricket",
  mode: "mock",
  budgetCr: 120,
  bidSeconds: 20,
  resetSeconds: 10,
  introSeconds: 3,
  hammerSeconds: 3,
  rtmWindowSeconds: 8,
  minSquad: 18,
  maxSquad: 25,
  maxOverseas: 8,
  overseasInXI: 4,
  rtmCards: 2,
  retentions: true,
  poolTop: 0,
  accelerated: true,
  autoNext: true,
  nextDelaySeconds: 4,
  public: true,
  bots: { enabled: false, count: 5, difficulty: "normal" },
  sound: true,
};

// Auction ladder: increment depends on where the current bid sits.
export function incrementFor(amountL) {
  if (amountL < 100) return 5; // below ₹1 Cr
  if (amountL < 200) return 10; // ₹1 Cr – ₹2 Cr
  if (amountL < 500) return 25; // ₹2 Cr – ₹5 Cr
  return 50; // above ₹5 Cr
}

export function nextBid(amountL) {
  return amountL + incrementFor(amountL);
}

export function normalizeBid(amountL) {
  return Math.round(amountL / 5) * 5;
}

export const TIER_ORDER = ["MARQUEE", "ELITE", "CORE", "SUPPORT", "EMERGING"];

export const TIER_LABEL = {
  MARQUEE: "Marquee",
  ELITE: "Elite",
  CORE: "Core",
  SUPPORT: "Support",
  EMERGING: "Emerging",
};

export const ROLE_SET_ORDER = {
  cricket: ["BAT", "WK", "AR", "PACE", "SPIN"],
  football: ["FWD", "MID", "DEF", "GK"],
};

export const ROLE_SET_NAME = {
  BAT: "Batters",
  WK: "Wicket-keepers",
  AR: "All-rounders",
  PACE: "Pace Attack",
  SPIN: "Spin Department",
  FWD: "Forwards",
  MID: "Midfielders",
  DEF: "Defenders",
  GK: "Goalkeepers",
};

export const MAX_HUMAN_PLAYERS = 10;
export const MAX_ROOM_PLAYERS = 12;

export const BOT_NAMES = [
  "Ace Owner", "Sultan", "Moneyball", "The Shark", "Silent Bidder", "Hawk Eye",
  "Deep Pockets", "Sniper", "The Gambler", "Iron Purse", "Wildcard", "Maverick",
  "The Accountant", "Blitzkrieg", "Last Laugh",
];

export const BOT_STYLES = ["aggressive", "shrewd", "frugal", "collector", "balanced"];

export const REACTIONS = ["🔥", "😱", "👏", "💸", "😂", "🤯", "👀", "🏆", "💀", "🫡"];

export const COMMENTARY = {
  open: [
    "{name} walks up. Base price {base}. Who wants him?",
    "Next on the block: {name}, {style}. Starts at {base}.",
    "{name} — {country} — {role}. The table opens at {base}.",
  ],
  bid: [
    "{team} jumps in at {amount}!",
    "{team} counters with {amount}.",
    "{amount} from {team}. The room stirs.",
    "{team} refuses to let go — {amount}.",
  ],
  war: [
    "It is a straight fight between {t1} and {t2} for {name}.",
    "Egos are on the table now. {t1} vs {t2}.",
    "{name} is triggering a bidding war — {t1} and {t2} keep raising.",
  ],
  sold: [
    "SOLD! {name} goes to {team} for {amount}.",
    "The gavel falls — {team} gets {name} at {amount}.",
    "{amount} and {name} is a {team} player.",
  ],
  unsold: [
    "No bids. {name} goes UNSOLD.",
    "{name} is UNSOLD — the table stays quiet.",
    "Silence in the room. {name} goes unsold at {base}.",
  ],
  steal: ["{team} just picked up {name} at {amount} — that looks like a steal.", "Absolute bargain. {name} to {team} for only {amount}."],
  splash: ["{team} blows {amount} on {name}. Statement signing!", "Big money: {name} to {team} for {amount}."],
  rtm: ["{team} plays RIGHT TO MATCH and steals {name} back for {amount}!", "RTM card used! {name} returns to {team} at {amount}."],
};
