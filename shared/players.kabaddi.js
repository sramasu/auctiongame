// Pro Kabaddi League (PKL) auction pool.
// Row format: [name, country, role, basePriceLakhs, rating, style, isLegend]
// Roles: RAID (Raider), DEF_C (Corner Defender), DEF_V (Cover Defender), AR (All-Rounder)

const R = [
  // ── All-Time PKL Legends ──────────────────────────────────────────────────
  ["Anup Kumar", "IN", "RAID", 30, 97, "Bonus point maestro • Captain Cool • Master of toe touch", true],
  ["Ajay Thakur", "IN", "RAID", 30, 96, "World Cup hero • Frog jump & extended reach reach-hand touches", true],
  ["Rahul Chaudhari", "IN", "RAID", 30, 95, "Showman • First PKL raid machine • Running hand touch", true],
  ["Manjeet Chhillar", "IN", "AR", 30, 97, "One-man army • Lethal thigh holds, dashes & clutch raids", true],
  ["Dharmaraj Cheralathan", "IN", "DEF_C", 30, 95, "Anna • 40+ age warrior • Iron ankle holds & leadership", true],
  ["Rakesh Kumar", "IN", "AR", 30, 95, "Arjuna Awardee • Lion jumps & impenetrable cover defense", true],
  ["Kashiling Adake", "IN", "RAID", 30, 92, "High jump escapes & explosive multi-point raids", true],
  ["Jasvir Singh", "IN", "RAID", 30, 92, "Scorpion kicks & psychological warfare on the mat", true],
  ["Mohit Chhillar", "IN", "DEF_C", 30, 93, "Right corner lockdown • Diving ankle holds", true],
  ["Shabeer Bapu", "IN", "RAID", 30, 91, "Do-or-die raid specialist • High flying leaps", true],
  ["Rishank Devadiga", "IN", "RAID", 30, 91, "Super raid hunter • Dubki and side escape", true],
  ["Jang Kun Lee", "KOR_K", "RAID", 30, 90, "Korean kicking sensation • Unpredictable body feints", true],

  // ── Category A / Marquee Superstars ───────────────────────────────────────
  ["Pardeep Narwal", "IN", "RAID", 30, 98, "The Dubki King • Record 8-point raid • PKL all-time top scorer"],
  ["Pawan Sehrawat", "IN", "RAID", 30, 97, "Hi-Flyer • 39 points in a single match • Sky-walking jumps"],
  ["Naveen Kumar", "IN", "RAID", 30, 96, "The Naveen Express • Lightning fast speed & continuous Super 10s"],
  ["Fazel Atrachali", "IRN", "DEF_C", 30, 97, "The Sultan • Most successful overseas captain • Unstoppable ankle holds"],
  ["Arjun Deshwal", "IN", "RAID", 30, 96, "Raid Machine • Consistent top-raider • Sharp turn & escape"],
  ["Mohammadreza Shadloui", "IRN", "AR", 30, 97, "Chiyaney • Record 16 tackle points in a game • Ferocious ankle holds"],
  ["Maninder Singh", "IN", "RAID", 30, 95, "Mighty Mani • Pure power, dragging 4 defenders across the midline"],
  ["Sunil Kumar", "IN", "DEF_V", 30, 94, "Captain of champions • Right cover block coordination"],
  ["Surjeet Singh", "IN", "DEF_V", 30, 94, "Cover wall • Aggressive dashes & textbook thigh holds"],
  ["Ashu Malik", "IN", "RAID", 30, 95, "Clutch raider • Speedy bonus specialist & match-winner"],
  ["Sachin Tanwar", "IN", "RAID", 30, 94, "Do-or-Die raid king • Hand touch precision & agility"],
  ["Bharat Hooda", "IN", "RAID", 30, 93, "Tall reach • Heavy power raider with deep penetration"],
  ["Aslam Inamdar", "IN", "AR", 30, 94, "All-round captain • Fast raids, bonus points & corner backup"],
  ["Nitesh Kumar", "IN", "DEF_C", 30, 93, "First defender with 100 tackle points in a season • Right corner hold"],
  ["Saurabh Nandal", "IN", "DEF_C", 30, 93, "Right corner rock • Low body blocks and chain tackles"],
  ["Ankush", "IN", "DEF_C", 30, 93, "Best debut defender award • Left corner trap specialist"],

  // ── Category B / Elite Players ────────────────────────────────────────────
  ["Guman Singh", "IN", "RAID", 20, 89, "Speedy left-raider • Sharp side-step and toe touch"],
  ["Vikash Kandola", "IN", "RAID", 20, 88, "Running hand touch master • Nimble footwork"],
  ["Siddharth Desai", "IN", "RAID", 20, 88, "Baahubali • Heavy muscle raider • Demolishing blocks"],
  ["Jaideep Dahiya", "IN", "DEF_V", 20, 89, "Left cover enforcer • Devastating dashes across the mat"],
  ["Mahender Singh", "IN", "DEF_V", 20, 87, "The Bulldozer • Mid-mat flat-out blocks"],
  ["Parvesh Bhainswal", "IN", "DEF_V", 20, 88, "Cover coordination duo • Chain tackling perfection"],
  ["Vishal Bhardwaj", "IN", "DEF_C", 20, 88, "Left corner tiger • Aggressive ankle holds and waist locks"],
  ["Sandeep Narwal", "IN", "AR", 20, 89, "Power defender and explosive raider • Iron physique"],
  ["Deepak Niwas Hooda", "IN", "AR", 20, 88, "Former Indian team captain • 1000+ PKL points veteran"],
  ["Mohit Goyat", "IN", "RAID", 20, 88, "Technically gifted raider • Toe touches and sharp turnarounds"],
  ["Prateek Dahiya", "IN", "RAID", 20, 87, "Multi-point raid threat • Tall frame and reach"],
  ["Neeraj Kumar", "IN", "DEF_V", 20, 86, "Experienced right cover defender • Timed blocks"],
  ["Rinku", "IN", "DEF_C", 20, 88, "Right corner specialist • Super tackle hero"],
  ["Shubham Shinde", "IN", "DEF_C", 20, 88, "Persistent right corner • Strong waist hold grip"],
  ["Krishan Dhull", "IN", "DEF_C", 20, 88, "Top tackle scorer • Fearless diving ankle holds"],
  ["Amirmohammad Zafardanesh", "IRN", "AR", 20, 89, "Iranian prodigy • Reverse turnarounds and corner tackles"],

  // ── Category C / Core Players ─────────────────────────────────────────────
  ["Ajinkya Pawar", "IN", "RAID", 15, 84, "Super sub • Explosive 5-point raids in closing minutes"],
  ["Shivam Patare", "IN", "RAID", 15, 83, "Emerging talent • High work-rate raiding"],
  ["Jai Bhagwan", "IN", "RAID", 15, 82, "Unorthodox angles • Deceptive bonus point snatcher"],
  ["Nitin Kumar", "IN", "RAID", 15, 84, "Reliable points scorer • Quick touches"],
  ["Yogesh", "IN", "DEF_C", 15, 85, "Emerging right corner • High 5 machine"],
  ["Mohit", "IN", "DEF_V", 15, 83, "Cover defender • Coordinated chain supports"],
  ["Nitin Rawal", "IN", "AR", 15, 84, "Versatile utility all-rounder • Defense stability"],
  ["Arkam Shaikh", "IN", "DEF_V", 15, 82, "Left cover blocker • Physical resistance"],
  ["Vaibhav Garje", "IN", "DEF_V", 15, 83, "Right cover wall • Well-timed dives"],
  ["Sumit", "IN", "DEF_C", 15, 85, "Left corner anchor • Clean ankle holds and super tackles"],
  ["Rahul Sethpal", "IN", "DEF_C", 15, 84, "Right corner enforcer • Multi-tackle performer"],
  ["Ashish", "IN", "AR", 15, 82, "Support raider & cover defender • Tactical discipline"],
  ["Rohit Gulia", "IN", "AR", 15, 83, "Left raider & reliable third raider in pressure moments"],
  ["Sombir", "IN", "DEF_C", 15, 84, "Corner specialist • High percentage ankle holds"],

  // ── Category D / Support Players ──────────────────────────────────────────
  ["Monu Goyat", "IN", "RAID", 10, 80, "Senior tactician • Classical toe touches & bonus points"],
  ["Abhishek Singh", "IN", "RAID", 10, 81, "Solid secondary raider • Good hand touch speed"],
  ["Meetu Sharma", "IN", "RAID", 10, 79, "Aggressive pursuit raider • Running touch attempts"],
  ["Vijay Malik", "IN", "AR", 10, 81, "Do-or-die raid specialist • Match-winning pressure nerve"],
  ["Chandran Ranjit", "IN", "RAID", 10, 79, "Veteran left raider • Safe touches and rotation"],
  ["Rohit Kumar", "IN", "RAID", 10, 79, "Former MVP captain • Frog jumps and cool temperament"],
  ["Manjeet", "IN", "RAID", 10, 81, "Tall frame raider • Deep bonus threat and ankle holds"],
  ["V Ajith Kumar", "IN", "RAID", 10, 80, "Speedster from Tamil Nadu • Lightning raids"],
  ["Reza Mirbagheri", "IRN", "DEF_V", 10, 82, "Iranian enforcer • Diving body blocks"],
  ["Heidarali Ekrami", "IRN", "RAID", 10, 78, "Fast-stepping Iranian raider"],
  ["Harendra Kumar", "IN", "DEF_V", 10, 77, "Left cover presence • Physical block"],
  ["Bhavani Rajput", "IN", "RAID", 10, 78, "Tall raider • Effective hand touches"],
  ["Sonu Jaglan", "IN", "RAID", 10, 80, "Super sub • Multi-point raids off the bench"],

  // ── Category E / New Young Players (Emerging) ─────────────────────────────
  ["Ayan Lohchab", "IN", "RAID", 6, 76, "Young dynamic raider • Fast turnarounds"],
  ["Devank Dalal", "IN", "RAID", 6, 78, "Breakout star • Incredible strike rate & multi-points"],
  ["Ali Reza", "IRN", "RAID", 6, 75, "Young Iranian talent • Quick footwork"],
  ["Himanshu Singh", "IN", "RAID", 6, 74, "Young raider • Deep penetration reach"],
  ["Parteek Dahiya-style Sagar", "IN", "DEF_C", 6, 76, "Fearless corner tackling"],
  ["Ashish Malik", "IN", "DEF_V", 6, 73, "Youthful left cover defender"],
  ["Rohit Raghav", "IN", "AR", 6, 75, "All-round prospect • Quick raids & agile defense"],
  ["Gaurav Khatri", "IN", "DEF_C", 6, 77, "Right corner prodigy • Sharp timing on holds"],
  ["Abhinesh Nadarajan", "IN", "DEF_V", 6, 76, "Right cover powerhouse • Clean dashes"],
  ["Sanket Sawant", "IN", "DEF_V", 6, 75, "Left cover specialist • Agile dashes"],
];

const seen = new Set();
const clean = [];
for (const row of R) {
  let name = String(row[0]).trim();
  if (name.includes("-style")) name = name.split("-style").pop().trim();
  if (seen.has(name)) continue;
  seen.add(name);
  clean.push([name, ...row.slice(1)]);
}

export const KABADDI_PLAYERS = clean.map((row, i) => {
  const [name, country, role, _rawBase, rating, style, isLegend] = row;
  const overseas = country !== "IN";
  const tier = isLegend ? "LEGENDS" : rating >= 93 ? "MARQUEE" : rating >= 86 ? "ELITE" : rating >= 82 ? "CORE" : rating >= 77 ? "SUPPORT" : "EMERGING";
  // Strict uniform base price by set tier in ₹ Lakhs (Kabaddi standard scale)
  const base = tier === "LEGENDS" || tier === "MARQUEE" ? 30 : tier === "ELITE" ? 20 : tier === "CORE" ? 15 : tier === "SUPPORT" ? 10 : 6;
  return {
    id: `k${i + 1}`,
    name,
    country,
    role,
    base,
    rating,
    style,
    overseas,
    isLegend: !!isLegend,
    tier,
    setKey: `${isLegend ? "LEGEND" : overseas ? "OS" : "IN"}-${role}-${tier}`,
  };
});

export const KABADDI_POOL_SIZE = KABADDI_PLAYERS.length;
