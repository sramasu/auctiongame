// Coaches database across Cricket, Football, and Kabaddi
// Categories: Head Coach, Batting/Offense, Bowling/Defense, Fielding/Fitness

export const COACH_TYPES = {
  cricket: [
    { type: "head", title: "Head Coach", icon: "📋" },
    { type: "bat", title: "Batting Coach", icon: "🏏" },
    { type: "bowl", title: "Bowling Coach", icon: "🎯" },
    { type: "field", title: "Fielding Coach", icon: "🧤" },
  ],
  football: [
    { type: "head", title: "Manager / Head Coach", icon: "📋" },
    { type: "attack", title: "Attacking Coach", icon: "⚽" },
    { type: "defense", title: "Defensive Coach", icon: "🛡️" },
    { type: "gk", title: "Goalkeeping Coach", icon: "🧤" },
  ],
  kabaddi: [
    { type: "head", title: "Head Coach", icon: "📋" },
    { type: "raid", title: "Raiding Coach", icon: "⚡" },
    { type: "def", title: "Defensive Coach", icon: "🔒" },
    { type: "fitness", title: "Fitness & Agility", icon: "💪" },
  ],
};

export const COACHES = {
  cricket: [
    // Head Coaches
    { id: "c_ck_h1", name: "Stephen Fleming", type: "head", sport: "cricket", rating: 96, specialty: "Tactical calm & tournament winning pedigree", basePriceL: 100 },
    { id: "c_ck_h2", name: "Ricky Ponting", type: "head", sport: "cricket", rating: 95, specialty: "Aggressive intent & dressing room leadership", basePriceL: 100 },
    { id: "c_ck_h3", name: "Gary Kirsten", type: "head", sport: "cricket", rating: 94, specialty: "World Cup winning man-manager", basePriceL: 100 },
    { id: "c_ck_h4", name: "Andy Flower", type: "head", sport: "cricket", rating: 93, specialty: "Modern T20 data-driven blueprints", basePriceL: 100 },
    { id: "c_ck_h5", name: "Brendon McCullum", type: "head", sport: "cricket", rating: 94, specialty: "High-tempo ultra-attacking philosophy", basePriceL: 100 },
    { id: "c_ck_h6", name: "Ashish Nehra", type: "head", sport: "cricket", rating: 91, specialty: "Paper-napkin clarity & death bowling acumen", basePriceL: 80 },
    { id: "c_ck_h7", name: "Trevor Bayliss", type: "head", sport: "cricket", rating: 90, specialty: "White-ball trophy collector", basePriceL: 80 },
    { id: "c_ck_h8", name: "Daniel Vettori", type: "head", sport: "cricket", rating: 90, specialty: "Spin nuance and match matchups", basePriceL: 80 },

    // Batting Coaches
    { id: "c_ck_b1", name: "Michael Hussey", type: "bat", sport: "cricket", rating: 95, specialty: "Mr. Cricket • Pressure chasing master", basePriceL: 80 },
    { id: "c_ck_b2", name: "Brian Lara", type: "bat", sport: "cricket", rating: 96, specialty: "High elbow technique & power execution", basePriceL: 80 },
    { id: "c_ck_b3", name: "Kieron Pollard", type: "bat", sport: "cricket", rating: 93, specialty: "Death-overs boundary striking specialist", basePriceL: 75 },
    { id: "c_ck_b4", name: "Jacques Kallis", type: "bat", sport: "cricket", rating: 94, specialty: "Pace/spin balance & anchor foundation", basePriceL: 75 },
    { id: "c_ck_b5", name: "Shane Watson", type: "bat", sport: "cricket", rating: 90, specialty: "Powerplay boundary hitting and mindset", basePriceL: 60 },
    { id: "c_ck_b6", name: "Marcus Trescothick", type: "bat", sport: "cricket", rating: 89, specialty: "Clean ball striker coach", basePriceL: 60 },

    // Bowling Coaches
    { id: "c_ck_w1", name: "Dale Steyn", type: "bowl", sport: "cricket", rating: 96, specialty: "Raw pace, outswing & wicket aggression", basePriceL: 80 },
    { id: "c_ck_w2", name: "Lasith Malinga", type: "bowl", sport: "cricket", rating: 97, specialty: "Yorker precision & slower-ball dip", basePriceL: 80 },
    { id: "c_ck_w3", name: "Zaheer Khan", type: "bowl", sport: "cricket", rating: 94, specialty: "Left-arm angles, knuckleballs & reverse", basePriceL: 75 },
    { id: "c_ck_w4", name: "Brett Lee", type: "bowl", sport: "cricket", rating: 93, specialty: "Hostile bouncer management & fitness", basePriceL: 75 },
    { id: "c_ck_w5", name: "Muttiah Muralitharan", type: "bowl", sport: "cricket", rating: 96, specialty: "Mystery spin variation & trajectory control", basePriceL: 80 },
    { id: "c_ck_w6", name: "Morne Morkel", type: "bowl", sport: "cricket", rating: 89, specialty: "Steep bounce and back-of-length discipline", basePriceL: 60 },

    // Fielding Coaches
    { id: "c_ck_f1", name: "Jonty Rhodes", type: "field", sport: "cricket", rating: 98, specialty: "The ultimate fielding icon • Inner-ring brilliance", basePriceL: 80 },
    { id: "c_ck_f2", name: "Paul Collingwood", type: "field", sport: "cricket", rating: 91, specialty: "Backward-point reflex training & catching", basePriceL: 60 },
    { id: "c_ck_f3", name: "T Dilshan", type: "field", sport: "cricket", rating: 89, specialty: "Direct-hit accuracy & boundary patrolling", basePriceL: 50 },
    { id: "c_ck_f4", name: "Ramakrishnan Sridhar", type: "field", sport: "cricket", rating: 90, specialty: "Slip cordon and high-catch drills", basePriceL: 60 },
  ],

  football: [
    // Managers
    { id: "c_fb_h1", name: "Pep Guardiola", type: "head", sport: "football", rating: 98, specialty: "Positional play, inverted fullbacks & tactical domination", basePriceL: 150 },
    { id: "c_fb_h2", name: "Carlo Ancelotti", type: "head", sport: "football", rating: 97, specialty: "Champion pedigree & locker-room equilibrium", basePriceL: 140 },
    { id: "c_fb_h3", name: "Jurgen Klopp", type: "head", sport: "football", rating: 96, specialty: "Heavy-metal gegenpressing & relentless energy", basePriceL: 140 },
    { id: "c_fb_h4", name: "Zinedine Zidane", type: "head", sport: "football", rating: 95, specialty: "Big-match intuition & Galactico authority", basePriceL: 130 },
    { id: "c_fb_h5", name: "Mikel Arteta", type: "head", sport: "football", rating: 93, specialty: "Set-piece excellence & modern spatial pressing", basePriceL: 110 },
    { id: "c_fb_h6", name: "Jose Mourinho", type: "head", sport: "football", rating: 94, specialty: "Low-block resilience & transition counter-strike", basePriceL: 120 },

    // Attack
    { id: "c_fb_a1", name: "Thierry Henry", type: "attack", sport: "football", rating: 96, specialty: "Channel runs, clinical finishing & dribbling arcs", basePriceL: 100 },
    { id: "c_fb_a2", name: "Ruud van Nistelrooy", type: "attack", sport: "football", rating: 93, specialty: "Six-yard box poaching & penalty perfection", basePriceL: 90 },
    { id: "c_fb_a3", name: "Dennis Bergkamp", type: "attack", sport: "football", rating: 95, specialty: "First-touch elegance & through-ball vision", basePriceL: 100 },

    // Defense
    { id: "c_fb_d1", name: "Paolo Maldini", type: "defense", sport: "football", rating: 98, specialty: "Anticipation, slide tackle mastery & 1v1 containment", basePriceL: 100 },
    { id: "c_fb_d2", name: "Carles Puyol", type: "defense", sport: "football", rating: 94, specialty: "Lionheart aerial clearances & goal-line defense", basePriceL: 90 },
    { id: "c_fb_d3", name: "Nemanja Vidic", type: "defense", sport: "football", rating: 93, specialty: "Physical imposition & set-piece heading", basePriceL: 80 },

    // Goalkeeping
    { id: "c_fb_g1", name: "Gianluigi Buffon", type: "gk", sport: "football", rating: 97, specialty: "Positioning master & reflex command", basePriceL: 90 },
    { id: "c_fb_g2", name: "Iker Casillas", type: "gk", sport: "football", rating: 95, specialty: "Miracle 1v1 saves & penalty shootout nerve", basePriceL: 90 },
  ],

  kabaddi: [
    // Head Coaches
    { id: "c_kb_h1", name: "BC Ramesh", type: "head", sport: "kabaddi", rating: 97, specialty: "Championship architect with multiple franchises", basePriceL: 30 },
    { id: "c_kb_h2", name: "Randhir Singh Sehrawat", type: "head", sport: "kabaddi", rating: 96, specialty: "Long-standing tactician & high-flyer mentor", basePriceL: 30 },
    { id: "c_kb_h3", name: "Sanjeev Baliyan", type: "head", sport: "kabaddi", rating: 95, specialty: "Defensive wall coordinator & clutch coaching", basePriceL: 25 },
    { id: "c_kb_h4", name: "Manpreet Singh", type: "head", sport: "kabaddi", rating: 94, specialty: "High octane motivation & aggressive cover shifts", basePriceL: 25 },
    { id: "c_kb_h5", name: "Ram Mehar Singh", type: "head", sport: "kabaddi", rating: 93, specialty: "Three-time champion strategist", basePriceL: 25 },

    // Raiding Coaches
    { id: "c_kb_r1", name: "Anup Kumar", type: "raid", sport: "kabaddi", rating: 98, specialty: "Captain Cool • Toe touch & bonus line genius", basePriceL: 25 },
    { id: "c_kb_r2", name: "Ajay Thakur", type: "raid", sport: "kabaddi", rating: 95, specialty: "Frog jump & multi-point clutch raids", basePriceL: 20 },
    { id: "c_kb_r3", name: "Rahul Chaudhari", type: "raid", sport: "kabaddi", rating: 94, specialty: "Running hand touch & explosive turn", basePriceL: 20 },

    // Defensive Coaches
    { id: "c_kb_d1", name: "Dharmaraj Cheralathan", type: "def", sport: "kabaddi", rating: 96, specialty: "Anna • Corner ankle hold & chain tackles", basePriceL: 25 },
    { id: "c_kb_d2", name: "Manjeet Chhillar", type: "def", sport: "kabaddi", rating: 97, specialty: "The Beast • Block, dash & intimidating holds", basePriceL: 25 },
    { id: "c_kb_d3", name: "Joginder Narwal", type: "def", sport: "kabaddi", rating: 91, specialty: "Left corner positioning & captaincy", basePriceL: 18 },

    // Fitness
    { id: "c_kb_f1", name: "Rakesh Kumar", type: "fitness", sport: "kabaddi", rating: 95, specialty: "Kabaddi endurance, stamina & match agility", basePriceL: 20 },
  ],
};
