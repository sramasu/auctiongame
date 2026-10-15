// Franchise slots for the auction table. Names are city-based and fully
// editable by the room host, so every table can brand itself however it likes.
export const TEAMS = [
  { id: "mum", short: "MUM", name: "Mumbai", city: "Mumbai", primary: "#1d4ed8", secondary: "#d1171b", accent: "#f8fafc", glyph: "🌊" },
  { id: "che", short: "CHE", name: "Chennai", city: "Chennai", primary: "#f6c90e", secondary: "#0f3d7a", accent: "#111827", glyph: "🦁" },
  { id: "blr", short: "BLR", name: "Bengaluru", city: "Bengaluru", primary: "#dc2626", secondary: "#0b0b0b", accent: "#f8fafc", glyph: "🔴" },
  { id: "kol", short: "KOL", name: "Kolkata", city: "Kolkata", primary: "#7c3aed", secondary: "#f2c14e", accent: "#f8fafc", glyph: "⚡" },
  { id: "del", short: "DEL", name: "Delhi", city: "Delhi", primary: "#2563eb", secondary: "#dc2626", accent: "#f8fafc", glyph: "🏛️" },
  { id: "pun", short: "PUN", name: "Punjab", city: "Mullanpur", primary: "#dc2626", secondary: "#94a3b8", accent: "#f8fafc", glyph: "🦅" },
  { id: "raj", short: "RAJ", name: "Rajasthan", city: "Jaipur", primary: "#ec4899", secondary: "#1d4ed8", accent: "#f8fafc", glyph: "👑" },
  { id: "hyd", short: "HYD", name: "Hyderabad", city: "Hyderabad", primary: "#f97316", secondary: "#0f172a", accent: "#f8fafc", glyph: "🌇" },
  { id: "guj", short: "GUJ", name: "Gujarat", city: "Ahmedabad", primary: "#0ea5e9", secondary: "#facc15", accent: "#0f172a", glyph: "🛡️" },
  { id: "lko", short: "LKO", name: "Lucknow", city: "Lucknow", primary: "#06b6d4", secondary: "#f59e0b", accent: "#0f172a", glyph: "🐎" },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

// Extra slots so a table can go beyond 10 franchises in custom games.
export const EXTRA_TEAMS = [
  { id: "kok", short: "KOK", name: "Kochi", city: "Kochi", primary: "#f97316", secondary: "#111827", accent: "#f8fafc", glyph: "🌴" },
  { id: "pune", short: "PUN2", name: "Pune", city: "Pune", primary: "#a855f7", secondary: "#f8fafc", accent: "#111827", glyph: "🏔️" },
];

export const ALL_TEAMS = [...TEAMS, ...EXTRA_TEAMS];

export const ROLE_LABEL = {
  BAT: "Batter",
  WK: "Wicket-keeper",
  AR: "All-rounder",
  PACE: "Pace bowler",
  SPIN: "Spin bowler",
  // football roles
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export const ROLE_SHORT = {
  BAT: "BAT",
  WK: "WK",
  AR: "AR",
  PACE: "PAC",
  SPIN: "SPN",
  GK: "GK",
  DEF: "DEF",
  MID: "MID",
  FWD: "FWD",
};

export const CRICKET_ROLES = ["BAT", "WK", "AR", "PACE", "SPIN"];
export const FOOTBALL_ROLES = ["GK", "DEF", "MID", "FWD"];

export const COUNTRY_FLAG = {
  IN: "🇮🇳", AU: "🇦🇺", ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", SA: "🇿🇦", NZ: "🇳🇿", WI: "🏝️", SL: "🇱🇰",
  BAN: "🇧🇩", AFG: "🇦🇫", PAK: "🇵🇰", IRE: "🇮🇪", ZIM: "🇿🇼", NED: "🇳🇱", SCO: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA: "🇺🇸", NAM: "🇳🇦", UAE: "🇦🇪", NEP: "🇳🇵",
  BRA: "🇧🇷", ARG: "🇦🇷", FRA: "🇫🇷", ESP: "🇪🇸", GER: "🇩🇪", POR: "🇵🇹", ITA: "🇮🇹",
  NED2: "🇳🇱", BEL: "🇧🇪", CRO: "🇭🇷", URU: "🇺🇾", COL: "🇨🇴", MEX: "🇲🇽", JPN: "🇯🇵",
  KOR: "🇰🇷", SEN: "🇸🇳", MAR: "🇲🇦", GHA: "🇬🇭", NGA: "🇳🇬", EGY: "🇪🇬", POL: "🇵🇱",
  SRB: "🇷🇸", SUI: "🇨🇭", DEN: "🇩🇰", SWE: "🇸🇪", NOR: "🇳🇴", AUT: "🇦🇹", TUR: "🇹🇷",
  CZE: "🇨🇿", UKR: "🇺🇦", ALG: "🇩🇿", AUS2: "🇦🇺", CHI: "🇨🇱", ECU: "🇪🇨", PER: "🇵🇪",
  CAN: "🇨🇦", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", SVK: "🇸🇰", HUN: "🇭🇺", GRE: "🇬🇷", RSA: "🇿🇦",
  AUSF: "🇦🇺", ENGF: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", SCOF: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", IREF: "🇮🇪",
};
