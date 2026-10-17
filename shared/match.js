// Interactive Match Simulation Engine for Cricket, Football, and Kabaddi
// Supports Mode A (Drafted squad vs AI) and Mode B (Official real-life clubs vs AI)

import { CRICKET_TEAMS, FOOTBALL_TEAMS, KABADDI_TEAMS, getTeamsForSport } from "./teams.js";
import { CRICKET_PLAYERS } from "./players.cricket.js";
import { FOOTBALL_PLAYERS } from "./players.football.js";
import { KABADDI_PLAYERS } from "./players.kabaddi.js";
import { bestXI } from "./evaluate.js";
import { shuffle } from "./format.js";

// ────────────────────────────────────────────────────────────────────────────
// Authentic Official Squads for Instant Play Mode
// ────────────────────────────────────────────────────────────────────────────

const CRICKET_MAP = new Map(CRICKET_PLAYERS.map((p) => [p.name, p]));
const FOOTBALL_MAP = new Map(FOOTBALL_PLAYERS.map((p) => [p.name, p]));
const KABADDI_MAP = new Map(KABADDI_PLAYERS.map((p) => [p.name, p]));

export const OFFICIAL_ROSTERS = {
  cricket: {
    mum: ["Rohit Sharma", "Suryakumar Yadav", "Hardik Pandya", "Jasprit Bumrah", "Tilak Varma", "Ishan Kishan", "Tim David", "Gerald Coetzee", "Piyush Chawla", "Nuwan Thushara", "Anshul Kamboj"],
    che: ["Ruturaj Gaikwad", "MS Dhoni", "Ravindra Jadeja", "Matheesha Pathirana", "Shivam Dube", "Rachin Ravindra", "Daryl Mitchell", "Shardul Thakur", "Deepak Chahar", "Tushar Deshpande", "Maheesh Theekshana"],
    blr: ["Virat Kohli", "Faf du Plessis", "Glenn Maxwell", "Rajat Patidar", "Will Jacks", "Cameron Green", "Dinesh Karthik", "Mohammed Siraj", "Lockie Ferguson", "Yash Dayal", "Karn Sharma"],
    kol: ["Sunil Narine", "Andre Russell", "Shreyas Iyer", "Rinku Singh", "Venkatesh Iyer", "Phil Salt", "Mitchell Starc", "Varun Chakaravarthy", "Harshit Rana", "Ramandeep Singh", "Vaibhav Arora"],
    del: ["Rishabh Pant", "Axar Patel", "Kuldeep Yadav", "Tristan Stubbs", "Jake Fraser-McGurk", "Abishek Porel", "Khaleel Ahmed", "Mukesh Kumar", "Anrich Nortje", "Ishant Sharma", "Rasikh Salam"],
    pun: ["Shashank Singh", "Ashutosh Sharma", "Sam Curran", "Arshdeep Singh", "Kagiso Rabada", "Harshal Patel", "Prabhsimran Singh", "Jitesh Sharma", "Liam Livingstone", "Rahul Chahar", "Harpreet Brar"],
    raj: ["Sanju Samson", "Yashasvi Jaiswal", "Jos Buttler", "Riyan Parag", "Shimron Hetmyer", "Dhruv Jurel", "Ravichandran Ashwin", "Yuzvendra Chahal", "Trent Boult", "Avesh Khan", "Sandeep Sharma"],
    hyd: ["Heinrich Klaasen", "Pat Cummins", "Travis Head", "Abhishek Sharma", "Nitish Kumar Reddy", "Abdul Samad", "Shahbaz Ahmed", "Bhuvneshwar Kumar", "T Natarajan", "Jaydev Unadkat", "Mayank Markande"],
    guj: ["Shubman Gill", "Rashid Khan", "Sai Sudharsan", "David Miller", "Rahul Tewatia", "Mohit Sharma", "Noor Ahmad", "Spencer Johnson", "Shahrukh Khan", "Umesh Yadav", "Wriddhiman Saha"],
    lko: ["KL Rahul", "Nicholas Pooran", "Marcus Stoinis", "Mayank Yadav", "Ayush Badoni", "Krunal Pandya", "Quinton de Kock", "Ravi Bishnoi", "Naveen-ul-Haq", "Mohsin Khan", "Yash Thakur"],
  },
  football: {
    rma: ["Kylian Mbappé", "Vinícius Júnior", "Jude Bellingham", "Rodrygo", "Federico Valverde", "Eduardo Camavinga", "Aurélien Tchouaméni", "Antonio Rüdiger", "Éder Militão", "Dani Carvajal", "Thibaut Courtois"],
    fcb: ["Lamine Yamal", "Robert Lewandowski", "Raphinha", "Pedri", "Gavi", "Frenkie de Jong", "Dani Olmo", "Jules Koundé", "Pau Cubarsí", "Alejandro Balde", "Marc-André ter Stegen"],
    mci: ["Erling Haaland", "Kevin De Bruyne", "Phil Foden", "Bernardo Silva", "Rodri", "Mateo Kovačić", "Joško Gvardiol", "Rúben Dias", "Manuel Akanji", "Kyle Walker", "Ederson"],
    liv: ["Mohamed Salah", "Luis Díaz", "Darwin Núñez", "Dominik Szoboszlai", "Alexis Mac Allister", "Ryan Gravenberch", "Trent Alexander-Arnold", "Virgil van Dijk", "Ibrahima Konaté", "Andrew Robertson", "Alisson"],
    ars: ["Bukayo Saka", "Kai Havertz", "Gabriel Martinelli", "Martin Ødegaard", "Declan Rice", "Thomas Partey", "Ben White", "William Saliba", "Gabriel Magalhães", "Jurriën Timber", "David Raya"],
    bay: ["Harry Kane", "Jamal Musiala", "Michael Olise", "Serge Gnabry", "Joshua Kimmich", "Aleksandar Pavlović", "Alphonso Davies", "Dayot Upamecano", "Kim Min-jae", "Raphaël Guerreiro", "Manuel Neuer"],
    psg: ["Ousmane Dembélé", "Bradley Barcola", "Randal Kolo Muani", "Vitinha", "Warren Zaïre-Emery", "Fabián Ruiz", "Achraf Hakimi", "Marquinhos", "Willian Pacho", "Nuno Mendes", "Gianluigi Donnarumma"],
    che: ["Cole Palmer", "Nicolas Jackson", "Noni Madueke", "Enzo Fernández", "Moisés Caicedo", "Roméo Lavia", "Malo Gusto", "Wesley Fofana", "Levi Colwill", "Marc Cucurella", "Robert Sánchez"],
    juv: ["Dušan Vlahović", "Kenan Yıldız", "Francisco Conceição", "Teun Koopmeiners", "Manuel Locatelli", "Khéphren Thuram", "Nicolò Savona", "Federico Gatti", "Bremer", "Andrea Cambiaso", "Michele Di Gregorio"],
    int: ["Lautaro Martínez", "Marcus Thuram", "Nicolò Barella", "Hakan Çalhanoğlu", "Henrikh Mkhitaryan", "Federico Dimarco", "Denzel Dumfries", "Alessandro Bastoni", "Francesco Acerbi", "Benjamin Pavard", "Yann Sommer"],
  },
  kabaddi: {
    pat: ["Pardeep Narwal", "Sachin Tanwar", "Manjeet Dahiya", "Mohammadreza Shadloui", "Neeraj Kumar", "Sajin C", "Sunil"],
    pun_kb: ["Aslam Inamdar", "Mohit Goyat", "Pankaj Mohite", "Mohammadreza Shadloui", "Gaurav Khatri", "Abinesh Nadarajan", "Sanket Sawant"],
    jai: ["Arjun Deshwal", "V Ajith Kumar", "Rahul Chaudhari", "Ankush Rathee", "Sahul Kumar", "Reza Mirbagheri", "Sunil Kumar"],
    del_kb: ["Naveen Kumar", "Ashu Malik", "Meet Sharma", "Yogesh Dahiya", "Ashish Malik", "Vikrant", "Mohit"],
    blr_kb: ["Pawan Sehrawat", "Bharat Hooda", "Vikash Kandola", "Saurabh Nandal", "Aman Antil", "Surjeet Singh", "Mahender Singh"],
    mum_kb: ["Guman Singh", "Amirmohammad Zafardanesh", "Jai Bhagwan", "Rinku Sharma", "Surinder Singh", "Mahender Singh", "Bittu Banwala"],
    tam: ["Narender Kandola", "Ajinkya Pawar", "Himanshu Singh", "Sagar Rathee", "Sahil Gulia", "Abhishek M", "Mohit"],
    ben: ["Maninder Singh", "Shrikant Jadhav", "Nitin Kumar", "Shubham Shinde", "Vaibhav Garje", "Jaskirat Singh", "Aditya S"],
  },
};

/**
 * Resolve squad objects for an official team
 */
export function getOfficialSquad(sport, teamId) {
  const sportMap = sport === "football" ? FOOTBALL_MAP : sport === "kabaddi" ? KABADDI_MAP : CRICKET_MAP;
  const names = OFFICIAL_ROSTERS[sport]?.[teamId] || [];
  const players = [];
  for (const name of names) {
    const p = sportMap.get(name);
    if (p) players.push(p);
  }
  // If short, backfill from pool
  if (players.length < (sport === "kabaddi" ? 7 : 11)) {
    const pool = (sport === "football" ? FOOTBALL_PLAYERS : sport === "kabaddi" ? KABADDI_PLAYERS : CRICKET_PLAYERS)
      .filter((p) => !players.some((x) => x.id === p.id));
    const extra = bestXI(pool, sport).slice(0, (sport === "kabaddi" ? 7 : 11) - players.length);
    players.push(...extra);
  }
  return players;
}

/**
 * Build balanced AI teams with equal strength to challenge the user
 */
export function buildBalancedAiTeam(sport, targetRating = 85, excludeIds = new Set()) {
  const pool = (sport === "football" ? FOOTBALL_PLAYERS : sport === "kabaddi" ? KABADDI_PLAYERS : CRICKET_PLAYERS)
    .filter((p) => !excludeIds.has(p.id));
  const targetCount = sport === "kabaddi" ? 7 : 11;
  const shuffled = shuffle(pool);
  const xi = bestXI(shuffled, sport).slice(0, targetCount);
  return xi;
}

// ────────────────────────────────────────────────────────────────────────────
// Cricket Simulation Engine (T20 match)
// ────────────────────────────────────────────────────────────────────────────

export function simulateCricketMatch(teamA, teamB, opts = {}) {
  const nameA = teamA.name || "Team A";
  const nameB = teamB.name || "Team B";
  const squadA = teamA.squad || [];
  const squadB = teamB.squad || [];

  const xiA = squadA.slice(0, 11);
  const xiB = squadB.slice(0, 11);

  const avgRatingA = xiA.length ? xiA.reduce((s, p) => s + (p.rating || 80), 0) / xiA.length : 82;
  const avgRatingB = xiB.length ? xiB.reduce((s, p) => s + (p.rating || 80), 0) / xiB.length : 82;

  // Innings 1: Team A bats
  const inn1 = simulateInnings({ battingTeam: teamA, bowlingTeam: teamB, xiBat: xiA, xiBowl: xiB, target: null, ratingDiff: avgRatingA - avgRatingB });
  // Innings 2: Team B chases
  const inn2 = simulateInnings({ battingTeam: teamB, bowlingTeam: teamA, xiBat: xiB, xiBowl: xiA, target: inn1.totalRuns + 1, ratingDiff: avgRatingB - avgRatingA });

  let winner = null;
  let margin = "";
  if (inn2.totalRuns >= inn1.totalRuns + 1) {
    winner = teamB;
    const wLeft = 10 - inn2.wickets;
    margin = `${nameB} won by ${wLeft} wicket${wLeft === 1 ? "" : "s"}`;
  } else if (inn2.totalRuns === inn1.totalRuns) {
    winner = avgRatingA >= avgRatingB ? teamA : teamB;
    margin = `Match Tied! Super Over won by ${winner.name}`;
  } else {
    winner = teamA;
    const rDiff = inn1.totalRuns - inn2.totalRuns;
    margin = `${nameA} won by ${rDiff} run${rDiff === 1 ? "" : "s"}`;
  }

  // Top performers
  const allBat = [...inn1.batters, ...inn2.batters].sort((a, b) => b.runs - a.runs);
  const allBowl = [...inn1.bowlers, ...inn2.bowlers].sort((a, b) => b.wickets * 25 - b.runs - (a.wickets * 25 - a.runs));
  const pom = allBat[0]?.runs > 60 ? allBat[0].name : allBowl[0]?.wickets >= 3 ? allBowl[0].name : allBat[0]?.name || "Pat Cummins";

  return {
    sport: "cricket",
    teamA: { ...teamA, score: `${inn1.totalRuns}/${inn1.wickets}`, overs: inn1.oversStr },
    teamB: { ...teamB, score: `${inn2.totalRuns}/${inn2.wickets}`, overs: inn2.oversStr },
    winnerId: winner.id,
    margin,
    pom,
    inn1,
    inn2,
  };
}

function simulateInnings({ battingTeam, bowlingTeam, xiBat, xiBowl, target, ratingDiff }) {
  let runs = 0;
  let wickets = 0;
  let balls = 0;
  const maxBalls = 120; // 20 overs
  const timeline = [];

  const batters = xiBat.map((p, idx) => ({
    name: p.name,
    role: p.role,
    rating: p.rating || 80,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    out: false,
    dismissal: "not out",
  }));

  const bowlingPool = xiBowl.filter((p) => p.role === "PACE" || p.role === "SPIN" || p.role === "AR");
  const bowlers = (bowlingPool.length ? bowlingPool : xiBowl.slice(5)).slice(0, 5).map((p) => ({
    name: p.name,
    role: p.role,
    rating: p.rating || 80,
    overs: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
    economy: 0,
  }));

  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatterIdx = 2;

  while (balls < maxBalls && wickets < 10) {
    if (target != null && runs >= target) break;

    const overNum = Math.floor(balls / 6);
    const ballInOver = (balls % 6) + 1;
    const bowler = bowlers[overNum % bowlers.length];
    const striker = batters[strikerIdx];

    // Probability weights influenced by player rating & phase
    const isDeath = overNum >= 16;
    const isPowerplay = overNum < 6;
    const ratingAdvantage = ((striker?.rating || 80) - (bowler?.rating || 80) + ratingDiff) / 100;

    const rand = Math.random() - ratingAdvantage * 0.15;
    let ballRun = 0;
    let isWicket = false;
    let eventText = "";

    if (rand < 0.05 + (isDeath ? 0.03 : 0)) {
      // Wicket
      isWicket = true;
      wickets++;
      striker.balls++;
      striker.out = true;
      striker.dismissal = `c & b ${bowler.name}`;
      bowler.wickets++;
      eventText = `WICKET! ${striker.name} departs!`;
      if (nextBatterIdx < batters.length) {
        strikerIdx = nextBatterIdx++;
      }
    } else if (rand < 0.16 + (isDeath ? 0.08 : 0.02)) {
      // 6 runs
      ballRun = 6;
      striker.runs += 6;
      striker.balls++;
      striker.sixes++;
      bowler.runs += 6;
      eventText = `SIX! ${striker.name} launches it into the stands!`;
    } else if (rand < 0.32 + (isPowerplay ? 0.06 : 0)) {
      // 4 runs
      ballRun = 4;
      striker.runs += 4;
      striker.balls++;
      striker.fours++;
      bowler.runs += 4;
      eventText = `FOUR! Glorious stroke through the covers by ${striker.name}!`;
    } else if (rand < 0.55) {
      // 1 or 2 runs
      const singleOrDouble = Math.random() > 0.3 ? 1 : 2;
      ballRun = singleOrDouble;
      striker.runs += singleOrDouble;
      striker.balls++;
      bowler.runs += singleOrDouble;
      if (singleOrDouble % 2 === 1) {
        // strike rotates
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }
    } else {
      // Dot ball
      striker.balls++;
    }

    runs += ballRun;
    balls++;

    if (ballInOver === 6) {
      bowler.overs++;
      // End of over: rotate strike
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      timeline.push({
        over: overNum + 1,
        runs,
        wickets,
        bowler: bowler.name,
        commentary: eventText || `End of over ${overNum + 1}: ${runs}/${wickets}`,
      });
    }
  }

  const completedOvers = Math.floor(balls / 6);
  const remBalls = balls % 6;
  const oversStr = `${completedOvers}.${remBalls}`;

  bowlers.forEach((b) => {
    b.economy = b.overs > 0 ? (b.runs / b.overs).toFixed(1) : (b.runs * 6).toFixed(1);
  });

  return {
    totalRuns: runs,
    wickets,
    balls,
    oversStr,
    batters: batters.filter((b) => b.balls > 0 || !b.out),
    bowlers,
    timeline,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Football Simulation Engine (90-minute Match)
// ────────────────────────────────────────────────────────────────────────────

export function simulateFootballMatch(teamA, teamB) {
  const nameA = teamA.name || "Home";
  const nameB = teamB.name || "Away";
  const squadA = teamA.squad || [];
  const squadB = teamB.squad || [];

  const xiA = squadA.slice(0, 11);
  const xiB = squadB.slice(0, 11);

  const ratingA = xiA.length ? xiA.reduce((s, p) => s + (p.rating || 82), 0) / xiA.length : 84;
  const ratingB = xiB.length ? xiB.reduce((s, p) => s + (p.rating || 82), 0) / xiB.length : 84;

  const events = [];
  let scoreA = 0;
  let scoreB = 0;

  // Expected goals based on rating
  const xgA = Math.max(0.4, 1.4 + (ratingA - ratingB) * 0.12);
  const xgB = Math.max(0.4, 1.3 + (ratingB - ratingA) * 0.12);

  const fwdsA = xiA.filter((p) => p.role === "FWD" || p.role === "MID");
  const fwdsB = xiB.filter((p) => p.role === "FWD" || p.role === "MID");

  for (let min = 1; min <= 90; min += 3) {
    // Chance for Team A
    if (Math.random() < (xgA / 30)) {
      scoreA++;
      const scorer = fwdsA[Math.floor(Math.random() * fwdsA.length)]?.name || "Striker";
      const assist = fwdsA[Math.floor(Math.random() * fwdsA.length)]?.name || null;
      events.push({
        minute: min,
        teamId: teamA.id,
        teamName: nameA,
        type: "goal",
        scorer,
        assist: assist !== scorer ? assist : null,
        text: `⚽ GOAL! ${scorer} strikes clinical finish into the bottom corner! (${scoreA}-${scoreB})`,
      });
    }
    // Chance for Team B
    if (Math.random() < (xgB / 30)) {
      scoreB++;
      const scorer = fwdsB[Math.floor(Math.random() * fwdsB.length)]?.name || "Striker";
      const assist = fwdsB[Math.floor(Math.random() * fwdsB.length)]?.name || null;
      events.push({
        minute: min + 1,
        teamId: teamB.id,
        teamName: nameB,
        type: "goal",
        scorer,
        assist: assist !== scorer ? assist : null,
        text: `⚽ GOAL! ${scorer} answers back with a thunderbolt! (${scoreA}-${scoreB})`,
      });
    }
    // Yellow cards
    if (Math.random() < 0.04) {
      const isTeamA = Math.random() > 0.5;
      const targetTeam = isTeamA ? teamA : teamB;
      const targetXI = isTeamA ? xiA : xiB;
      const culprit = targetXI[Math.floor(Math.random() * targetXI.length)]?.name || "Defender";
      events.push({
        minute: min,
        teamId: targetTeam.id,
        teamName: targetTeam.name,
        type: "card",
        text: `🟨 Yellow Card shown to ${culprit} for a tactical foul.`,
      });
    }
  }

  // Handle penalties if knockout tied
  let penaltyResult = null;
  let winner = null;
  if (scoreA > scoreB) winner = teamA;
  else if (scoreB > scoreA) winner = teamB;
  else {
    const penA = 4 + (Math.random() > 0.5 ? 1 : 0);
    const penB = penA === 5 ? 4 : 5;
    penaltyResult = `${penA} - ${penB} on penalties`;
    winner = penA > penB ? teamA : teamB;
    events.push({
      minute: 120,
      type: "penalties",
      text: `Full-time 120' draw. ${winner.name} wins ${penaltyResult}!`,
    });
  }

  const possA = Math.round(50 + (ratingA - ratingB) * 2 + (Math.random() * 8 - 4));
  const possB = 100 - possA;

  return {
    sport: "football",
    teamA: { ...teamA, score: scoreA },
    teamB: { ...teamB, score: scoreB },
    winnerId: winner.id,
    scoreString: `${scoreA} - ${scoreB}`,
    penaltyResult,
    stats: {
      possession: [possA, possB],
      shots: [scoreA * 3 + Math.floor(Math.random() * 5 + 4), scoreB * 3 + Math.floor(Math.random() * 5 + 4)],
      shotsOnTarget: [scoreA + Math.floor(Math.random() * 4 + 2), scoreB + Math.floor(Math.random() * 4 + 2)],
      corners: [Math.floor(Math.random() * 6 + 3), Math.floor(Math.random() * 6 + 3)],
    },
    events: events.sort((a, b) => a.minute - b.minute),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Kabaddi Simulation Engine (Pro Kabaddi PKL 40-minute Match)
// ────────────────────────────────────────────────────────────────────────────

export function simulateKabaddiMatch(teamA, teamB) {
  const nameA = teamA.name || "Raiders A";
  const nameB = teamB.name || "Warriors B";
  const squadA = teamA.squad || [];
  const squadB = teamB.squad || [];

  const startingA = squadA.slice(0, 7);
  const startingB = squadB.slice(0, 7);

  const ratingA = startingA.length ? startingA.reduce((s, p) => s + (p.rating || 82), 0) / startingA.length : 84;
  const ratingB = startingB.length ? startingB.reduce((s, p) => s + (p.rating || 82), 0) / startingB.length : 84;

  let pointsA = 0;
  let pointsB = 0;
  let allOutsA = 0;
  let allOutsB = 0;
  const events = [];

  const raidersA = startingA.filter((p) => p.role === "RAID" || p.role === "AR");
  const raidersB = startingB.filter((p) => p.role === "RAID" || p.role === "AR");
  const defsA = startingA.filter((p) => p.role === "DEF_C" || p.role === "DEF_V");
  const defsB = startingB.filter((p) => p.role === "DEF_C" || p.role === "DEF_V");

  // 40 raids total (approx 20 raids each side)
  for (let r = 1; r <= 42; r++) {
    const isTeamARaiding = r % 2 === 1;
    const raidingTeam = isTeamARaiding ? teamA : teamB;
    const defendingTeam = isTeamARaiding ? teamB : teamA;
    const raiderPool = isTeamARaiding ? (raidersA.length ? raidersA : startingA) : (raidersB.length ? raidersB : startingB);
    const defPool = isTeamARaiding ? (defsB.length ? defsB : startingB) : (defsA.length ? defsA : startingA);

    const raider = raiderPool[Math.floor(Math.random() * raiderPool.length)];
    const def = defPool[Math.floor(Math.random() * defPool.length)];

    const rAdv = ((raider?.rating || 80) - (def?.rating || 80)) / 100;
    const roll = Math.random() - rAdv * 0.15;

    if (roll < 0.12) {
      // Super Raid (3 points)
      const pts = 3;
      if (isTeamARaiding) pointsA += pts; else pointsB += pts;
      events.push({
        raid: r,
        type: "super-raid",
        teamId: raidingTeam.id,
        text: `⚡ SUPER RAID! ${raider.name} escapes 3 defenders with an explosive dubki! (+3 points)`,
      });
    } else if (roll < 0.45) {
      // Touch Point (1 point)
      if (isTeamARaiding) pointsA += 1; else pointsB += 1;
      events.push({
        raid: r,
        type: "touch",
        teamId: raidingTeam.id,
        text: `💥 Touch point! ${raider.name} gets a running hand touch on ${def.name}.`,
      });
    } else if (roll < 0.75) {
      // Super Tackle or Tackle Point
      const isSuperTackle = Math.random() < 0.2;
      const tacklePts = isSuperTackle ? 2 : 1;
      if (isTeamARaiding) pointsB += tacklePts; else pointsA += tacklePts;
      events.push({
        raid: r,
        type: isSuperTackle ? "super-tackle" : "tackle",
        teamId: defendingTeam.id,
        text: isSuperTackle
          ? `🔒 SUPER TACKLE! ${def.name} locks in an iron-grip ankle hold! (+2 points)`
          : `🛑 Tackle point! ${def.name} dashes ${raider.name} out of bounds!`,
      });
    } else {
      // Empty raid
    }

    // Check All-Out every 15 raids
    if (r === 18 || r === 36) {
      if (pointsA > pointsB + 8) {
        allOutsB++;
        pointsA += 2;
        events.push({ raid: r, type: "all-out", text: `🚨 ALL-OUT inflicted on ${nameB}! +2 Bonus points to ${nameA}!` });
      } else if (pointsB > pointsA + 8) {
        allOutsA++;
        pointsB += 2;
        events.push({ raid: r, type: "all-out", text: `🚨 ALL-OUT inflicted on ${nameA}! +2 Bonus points to ${nameB}!` });
      }
    }
  }

  const winner = pointsA >= pointsB ? teamA : teamB;
  return {
    sport: "kabaddi",
    teamA: { ...teamA, score: pointsA, allOuts: allOutsA },
    teamB: { ...teamB, score: pointsB, allOuts: allOutsB },
    winnerId: winner.id,
    scoreString: `${pointsA} - ${pointsB}`,
    margin: `${winner.name} won by ${Math.abs(pointsA - pointsB)} points`,
    events,
  };
}
