import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { TEAMS, getTeamsForSport } from "../../../shared/teams.js";
import { MODES, SPORTS, DEFAULT_SETTINGS } from "../../../shared/constants.js";
import { CRICKET_POOL_SIZE } from "../../../shared/players.cricket.js";
import { FOOTBALL_POOL_SIZE } from "../../../shared/players.football.js";
import { KABADDI_POOL_SIZE } from "../../../shared/players.kabaddi.js";
import { useStore } from "../store.jsx";
import { Panel, Modal, Slider, Toggle, TeamBadge, StatTile, Spinner, Money } from "../components/ui.jsx";
import { sfx, unlockAudio } from "../lib/sound.js";

const MODE_ORDER = ["mock", "mega", "blitz", "custom"];

export default function Home({ onOpenMatch }) {
  const { createRoom, joinRoom, refreshRooms, rooms, prefs, setPrefs, notify, conn, session, rejoin } = useStore();
  const [name, setName] = useState(prefs.lastName || "");
  const [sport, setSport] = useState(prefs.lastSport || "cricket");
  const [mode, setMode] = useState(prefs.lastMode || "mock");
  const currentTeams = useMemo(() => getTeamsForSport(sport), [sport]);
  const [teamId, setTeamId] = useState(currentTeams[0]?.id || TEAMS[0].id);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);

  useEffect(() => {
    const list = getTeamsForSport(sport);
    if (list.length > 0 && !list.some((t) => t.id === teamId)) {
      setTeamId(list[0].id);
    }
  }, [sport]);

  useEffect(() => {
    const base = { ...DEFAULT_SETTINGS, ...(MODES[mode] || {}), ...(SPORTS[sport]?.defaults || {}) };
    base.sport = sport;
    base.mode = mode;
    base.retentions = mode === "mock" && sport === "cricket";
    base.rtmCards = MODES[mode]?.rtmCards ?? 0;
    base.poolTop = MODES[mode]?.poolTop ?? 0;
    base.budgetCr = sport === "kabaddi" ? 5 : (MODES[mode]?.budgetCr ?? 120);
    if (mode === "custom") { base.retentions = false; base.poolTop = 0; }
    if (sport === "football") { base.maxOverseas = null; base.overseasInXI = null; }
    setSettings((prev) => ({ ...prev, ...base }));
  }, [sport, mode]);

  const poolSize = sport === "football" ? FOOTBALL_POOL_SIZE : sport === "kabaddi" ? KABADDI_POOL_SIZE : CRICKET_POOL_SIZE;
  const effectivePool = settings.poolTop > 0 ? Math.min(settings.poolTop, poolSize) : poolSize;

  const guardName = () => {
    const n = name.trim();
    if (!n) { notify("Enter your name to take a seat", "warn"); return null; }
    setPrefs({ lastName: n, lastSport: sport, lastMode: mode });
    return n;
  };

  const onCreate = async () => {
    const n = guardName(); if (!n) return;
    unlockAudio(); sfx.click();
    setBusy("create");
    const res = await createRoom({ name: n, teamId, sport, mode, settings, public: settings.public });
    setBusy(null);
    if (!res?.ok) notify(res?.error || "Could not create the table", "error");
  };

  const onSolo = async () => {
    const n = guardName(); if (!n) return;
    unlockAudio(); sfx.click();
    setBusy("solo");
    const soloSettings = { ...settings, bots: { enabled: true, count: 9, difficulty: "normal" } };
    const res = await createRoom({ name: n, teamId, sport, mode, settings: soloSettings, public: false, solo: true, botCount: 9 });
    setBusy(null);
    if (!res?.ok) notify(res?.error || "Could not start a solo table", "error");
  };

  const onJoin = async (joinCode = code, spectator = joinAsSpectator) => {
    const c = String(joinCode || "").trim().toUpperCase();
    if (!c) { notify("Enter a room code", "warn"); return; }
    if (!spectator) { const n = guardName(); if (!n) return; }
    unlockAudio(); sfx.click();
    setBusy("join");
    const res = await joinRoom({ code: c, name: spectator ? (name.trim() || "Spectator") : name.trim(), teamId, spectator });
    setBusy(null);
    if (!res?.ok) notify(res?.error || "Could not join", "error");
    else setBrowseOpen(false);
  };

  const openBrowse = async () => {
    setBrowseOpen(true);
    await refreshRooms();
  };

  // Deep-link join: /?room=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("room") || params.get("code");
    if (c) { setCode(c.toUpperCase()); setJoinAsSpectator(false); }
  }, []);

  const heroStats = useMemo(() => ([
    { label: "Auction pool", value: poolSize, sub: `${sport === "football" ? "footballers" : "cricketers"} loaded` },
    { label: "Franchises", value: TEAMS.length, sub: "up to 12 at one table" },
    { label: "Purse", value: `₹${settings.budgetCr} Cr`, sub: settings.retentions ? "minus retentions" : "clean slate" },
    { label: "AI owners", value: "9", sub: "play solo against bots" },
  ]), [poolSize, sport, settings]);

  return (
    <div className="relative z-10 min-h-screen">
      <TopBar conn={conn} session={session} rejoin={rejoin} sound={prefs.sound} onSound={(v) => setPrefs({ sound: v })} />

      {/* HERO */}
      <header className="relative mx-auto max-w-6xl px-4 pb-6 pt-10 sm:pt-16">
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5 }} className="flex flex-wrap items-center gap-2">
              <span className="chip border-gold-500/40 bg-gold-500/12 text-gold-300">🔨 Live auction engine</span>
              <span className="chip border-turf-500/30 bg-turf-500/10 text-turf-300">
                {sport === "football" ? "⚽ Football pool" : "🏏 Cricket pool"} • {poolSize} names
              </span>
              <span className="chip">No sign-up • Any device</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55, delay: .05 }}
              className="mt-5 font-display text-[clamp(3rem,10vw,6.2rem)] leading-[.86] tracking-tight text-white"
            >
              Run the <span className="shimmer-text">auction</span>.<br />
              Own the table.
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }} className="mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-slate-300 sm:text-base">
              Ten franchises, one purse, and a countdown that never waits for you. Bid against friends across the
              world — or take on nine AI owners with their own tempers, budgets and wish-lists. Build the strongest
              XI before the gavel falls on the last name.
            </motion.p>

            <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {heroStats.map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .25 + i * .06 }}>
                  <StatTile label={s.label} value={s.value} sub={s.sub} />
                </motion.div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button className="btn-gold px-6 py-3.5 text-base" onClick={onCreate} disabled={busy === "create"}>
                {busy === "create" ? <Spinner label="Building table" /> : <>🔨 Create a room</>}
              </button>
              <button className="btn-ghost px-5 py-3.5 text-base" onClick={onSolo} disabled={busy === "solo"}>
                {busy === "solo" ? <Spinner label="Seating AI owners" /> : <>🤖 Play solo vs AI</>}
              </button>
              <button
                className="rounded-2xl border border-turf-500/50 bg-turf-500/20 px-5 py-3.5 text-base font-bold text-turf-200 transition hover:bg-turf-500/30 shadow-lg"
                onClick={() => onOpenMatch && onOpenMatch(sport)}
              >
                🏟️ Play Match vs AI (Instant)
              </button>
              <button className="btn-ghost px-5 py-3.5 text-base" onClick={openBrowse}>
                👀 Browse live rooms {rooms.length > 0 && <span className="ml-1 rounded-full bg-turf-500/20 px-2 py-0.5 text-[11px] text-turf-300">{rooms.length}</span>}
              </button>
            </div>
          </div>

          {/* SETUP CARD */}
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .5, delay: .1 }}>
            <Panel className="overflow-hidden">
              <div className="border-b border-white/8 bg-gradient-to-br from-white/6 to-transparent px-5 py-4">
                <h2 className="font-display text-2xl tracking-wide text-white">Set up your table</h2>
                <p className="text-xs text-slate-400">Everything here can be changed later by the host.</p>
              </div>

              <div className="space-y-4 px-5 py-4">
                <div>
                  <label className="label">Your name</label>
                  <input className="input" value={name} maxLength={24} placeholder="e.g. Ashwin" onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <label className="label">Sport</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(SPORTS).map((sp) => (
                      <button key={sp.id} onClick={() => { setSport(sp.id); sfx.click(); }}
                        className={clsx("rounded-xl border px-3 py-2.5 text-xs sm:text-sm font-bold transition",
                          sport === sp.id ? "border-gold-400/60 bg-gold-500/12 text-gold-200 shadow-md" : "border-white/10 bg-white/4 text-slate-300 hover:bg-white/8")}>
                        <span className="mr-1">{sp.icon}</span>{sp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Your franchise</label>
                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
                    {currentTeams.map((t) => (
                      <button key={t.id} onClick={() => { setTeamId(t.id); sfx.hover(); }} title={t.name}
                        className={clsx("group relative aspect-square rounded-xl transition", teamId === t.id && "ring-2 ring-gold-400 ring-offset-2 ring-offset-night-900")}>
                        <TeamBadge team={t} full className="rounded-xl" />
                        <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 truncate rounded-b-xl bg-night-950/75 px-1 text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                          {t.city}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Picked: <span className="font-semibold text-slate-300">{currentTeams.find((t) => t.id === teamId)?.name}</span> — anyone can take a different seat later.
                  </p>
                </div>

                <div>
                  <label className="label">Auction mode</label>
                  <div className="space-y-2">
                    {MODE_ORDER.map((m) => {
                      const cfg = MODES[m];
                      const active = mode === m;
                      return (
                        <button key={m} onClick={() => { setMode(m); sfx.click(); }}
                          className={clsx("card-sheen w-full rounded-xl border px-3.5 py-2.5 text-left transition",
                            active ? "border-gold-400/50 bg-gold-500/10" : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/6")}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={clsx("text-sm font-bold", active ? "text-gold-200" : "text-slate-200")}>{cfg.label}</span>
                            <span className="chip !py-0.5 !text-[9px]">{cfg.tag}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{cfg.blurb}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="divider" />

                <div className="space-y-2 rounded-xl border border-white/8 bg-night-900/50 p-3">
                  <button className="flex w-full items-center justify-between text-sm font-bold text-slate-200" onClick={() => setAdvanced((v) => !v)}>
                    <span>⚙️ House rules</span>
                    <span className="text-xs text-slate-500">{advanced ? "hide" : "tweak"} <span className="ml-1">{advanced ? "▲" : "▼"}</span></span>
                  </button>
                  <AnimatePresence initial={false}>
                    {advanced && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="pt-1">
                          <Slider label="Purse per team" value={settings.budgetCr} min={40} max={300} step={5} onChange={(v) => setSettings((s) => ({ ...s, budgetCr: v }))} format={(v) => `₹${v} Cr`} hint={settings.retentions ? "Mock mode deducts retained salaries from this." : "Every owner starts with the full purse."} />
                          <Slider label="Bid timer" value={settings.bidSeconds} min={5} max={60} onChange={(v) => setSettings((s) => ({ ...s, bidSeconds: v }))} format={(v) => `${v}s`} />
                          <Slider label="Timer reset on a bid" value={settings.resetSeconds} min={3} max={30} onChange={(v) => setSettings((s) => ({ ...s, resetSeconds: v }))} format={(v) => `+${v}s`} />
                          <Slider label="Min squad" value={settings.minSquad} min={1} max={30} onChange={(v) => setSettings((s) => ({ ...s, minSquad: v }))} />
                          <Slider label="Max squad" value={settings.maxSquad} min={2} max={40} onChange={(v) => setSettings((s) => ({ ...s, maxSquad: v }))} />
                          {sport === "cricket" && (
                            <Slider label="Max overseas" value={settings.maxOverseas ?? 8} min={0} max={12} onChange={(v) => setSettings((s) => ({ ...s, maxOverseas: v }))} />
                          )}
                          <Slider label="Right-To-Match cards" value={settings.rtmCards} min={0} max={5} onChange={(v) => setSettings((s) => ({ ...s, rtmCards: v }))} hint="Steal a just-sold player back by matching the final price." />
                          <Slider label="Pool size" value={settings.poolTop || poolSize} min={40} max={poolSize} step={10} onChange={(v) => setSettings((s) => ({ ...s, poolTop: v >= poolSize ? 0 : v }))} format={() => `${effectivePool} names`} hint="Top names by rating, spread across roles." />
                          <Toggle label="Retained squads" checked={!!settings.retentions} onChange={(v) => setSettings((s) => ({ ...s, retentions: v }))} hint={sport === "football" ? "Not available for football mode" : "Teams begin with players already signed."} />
                          <Toggle label="Auto next player" checked={settings.autoNext !== false} onChange={(v) => setSettings((s) => ({ ...s, autoNext: v }))} hint="Move straight to the next name after the gavel." />
                          <Toggle label="Public room" checked={settings.public !== false} onChange={(v) => setSettings((s) => ({ ...s, public: v }))} hint="Listed in Browse live rooms." />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="divider" />

                <div>
                  <label className="label">Have a room code?</label>
                  <div className="flex gap-2">
                    <input className="input font-mono uppercase tracking-[.3em]" value={code} maxLength={6}
                      placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && onJoin()} />
                    <button className="btn-primary shrink-0" onClick={() => onJoin()} disabled={busy === "join"}>
                      {busy === "join" ? <Spinner label="Joining" /> : "Join"}
                    </button>
                  </div>
                  <button className="mt-2 text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                    onClick={() => onJoin(code, true)}>
                    Join as a spectator instead
                  </button>
                </div>
              </div>
            </Panel>
          </motion.div>
        </div>
      </header>

      {/* FEATURE STRIP */}
      <section className="mx-auto mt-6 max-w-6xl px-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .05 }}>
              <Panel className="card-sheen h-full">
                <div className="flex items-start gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-white/12 to-white/4 text-lg">{f.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{f.title}</h3>
                    <p className="mt-1 text-[12px] leading-snug text-slate-400">{f.text}</p>
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW TO PLAY */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <h2 className="font-display text-4xl tracking-wide text-white">How a table runs</h2>
        <p className="mt-1 text-sm text-slate-400">Four steps from empty room to full squad sheet.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .07 }}>
              <Panel className="h-full p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-gold-500/15 font-display text-lg text-gold-300">{i + 1}</span>
                  <h3 className="text-sm font-bold text-white">{s.title}</h3>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{s.text}</p>
              </Panel>
            </motion.div>
          ))}
        </div>
      </section>

      {/* RULES / FAQ */}
      <section className="mx-auto mt-12 max-w-6xl px-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-5">
            <h2 className="font-display text-2xl tracking-wide text-white">Bidding rules</h2>
            <ul className="mt-3 space-y-2.5 text-[13px] text-slate-300">
              {RULES.map((r) => (
                <li key={r.q} className="flex gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  <span><b className="text-white">{r.q}</b> — {r.a}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel className="p-5">
            <h2 className="font-display text-2xl tracking-wide text-white">Questions owners ask</h2>
            <div className="mt-3 divide-y divide-white/6">
              {FAQ.map((f) => <FaqRow key={f.q} {...f} />)}
            </div>
          </Panel>
        </div>
      </section>

      <footer className="mx-auto mt-14 max-w-6xl px-4 pb-10 text-center">
        <div className="divider mb-5" />
        <p className="text-xs text-slate-500">
          Auction Arena is an independent fan-made simulation. Franchise seats are city-based and fully renamable by the
          host. Player ratings and prices are illustrative values built for gameplay balance.
        </p>
        <button className="mt-4 btn-ghost px-5 py-2.5" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ Back to the top</button>
      </footer>

      <BrowseModal open={browseOpen} onClose={() => setBrowseOpen(false)} rooms={rooms} refresh={refreshRooms} onJoin={onJoin} />
    </div>
  );
}

function FaqRow({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-2.5">
      <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((v) => !v)}>
        <span className="text-[13px] font-bold text-slate-100">{q}</span>
        <span className={clsx("text-slate-500 transition-transform", open && "rotate-45")}>＋</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-[12.5px] leading-relaxed text-slate-400">
            <span className="block pt-1.5">{a}</span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function BrowseModal({ open, onClose, rooms, refresh, onJoin }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Live rooms" wide
      footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{rooms.length} open table{rooms.length === 1 ? "" : "s"}. Spectate anything, or join a lobby that has not started.</p>
        <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={busy}
          onClick={async () => { setBusy(true); await refresh(); setBusy(false); }}>
          {busy ? <Spinner label="Refreshing" /> : "↻ Refresh"}
        </button>
      </div>
      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/12 p-8 text-center">
          <div className="text-3xl">🔨</div>
          <p className="mt-2 text-sm font-semibold text-slate-200">Nothing on the block right now</p>
          <p className="mt-1 text-xs text-slate-500">Create a public room and it will show up here instantly.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rooms.map((r) => (
            <li key={r.code} className="panel-flat flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={clsx("chip !py-0.5 !text-[9px]", r.status === "live" ? "border-turf-500/40 bg-turf-500/12 text-turf-300" : "border-gold-500/40 bg-gold-500/12 text-gold-300")}>
                    {r.status === "live" ? "● LIVE" : "LOBBY"}
                  </span>
                  <span className="truncate text-sm font-bold text-white">{r.title}</span>
                  <span className="font-mono text-[11px] text-slate-500">{r.code}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                  <span>{r.sport === "football" ? "⚽" : "🏏"} {MODES[r.mode]?.label || r.mode}</span>
                  <span>👥 {r.humans}/{r.maxPlayers} owners{r.bots ? ` + ${r.bots} AI` : ""}</span>
                  {r.status === "live" && <span>🔨 {r.sold}/{r.total} sold{r.currentPlayer ? ` • ${r.currentPlayer}` : ""}</span>}
                  <span className="flex gap-1">
                    {r.teams?.slice(0, 6).map((t) => <span key={t.teamId} className="rounded bg-white/8 px-1 font-bold text-slate-300">{t.short}</span>)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {r.status === "lobby" && r.humans < r.maxPlayers && (
                  <button className="btn-primary !px-3 !py-2 text-xs" onClick={() => onJoin(r.code, false)}>Join</button>
                )}
                <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => onJoin(r.code, true)}>Spectate</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function TopBar({ conn, session, rejoin, sound, onSound }) {
  return (
    <nav className="sticky top-0 z-40 border-b border-white/6 bg-night-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-lg shadow-glow">🔨</span>
          <div className="leading-tight">
            <div className="font-display text-xl tracking-wider text-white">AUCTION ARENA</div>
            <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-slate-500">build the squad • own the table</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={clsx("hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:flex",
            conn === "online" ? "border-turf-500/40 bg-turf-500/10 text-turf-300"
            : conn === "reconnecting" ? "border-gold-500/40 bg-gold-500/10 text-gold-300"
            : "border-flare-500/40 bg-flare-500/10 text-flare-300")}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", conn === "online" ? "bg-turf-400" : conn === "reconnecting" ? "bg-gold-400 animate-pulse" : "bg-flare-400")} />
            {conn === "online" ? "connected" : conn === "reconnecting" ? "reconnecting" : "offline"}
          </span>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-sm transition hover:bg-white/12"
            onClick={() => onSound(!sound)} title={sound ? "Mute" : "Unmute"}>
            {sound ? "🔊" : "🔇"}
          </button>
          {session?.code && (
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={rejoin}>↩ Rejoin {session.code}</button>
          )}
        </div>
      </div>
    </nav>
  );
}

const FEATURES = [
  { icon: "🤖", title: "AI owners with tempers", text: "Nine bot franchises bid with distinct styles — aggressive, shrewd, frugal, collector. Solo nights are never quiet." },
  { icon: "⏱️", title: "Server-side shot clock", text: "Anti-snipe timers run on the server, so every seat sees the same countdown. Bids inside the window reset the clock." },
  { icon: "🎯", title: "Proxy auto-bidding", text: "Set a ceiling and let the paddle work for you. Stay in the fight while you read the next set." },
  { icon: "🃏", title: "Right-To-Match cards", text: "A short window after the gavel lets you match the winning bid and pull a player back to your table." },
  { icon: "📊", title: "Live squad strength", text: "Best-XI engine, role balance, overseas limits and purse pacing update after every single sale." },
  { icon: "🎙️", title: "Auctioneer feed", text: "Commentary on wars, steals and splashes, plus chat and emoji reactions flying across the room." },
  { icon: "🔊", title: "Procedural sound", text: "Gavel, bid pings and the last-five-second heartbeat are synthesised in your browser — no downloads." },
  { icon: "📱", title: "Any screen, any seat", text: "Mobile-first layout, keyboard shortcuts, reconnect-proof sessions and spectate mode for the gallery." },
];

const STEPS = [
  { title: "Create or join", text: "Type a name, pick a city franchise, choose a mode. Share the six-letter code — or drop into a public room as a spectator." },
  { title: "Fill the table", text: "Up to ten human owners, plus AI seats if you want them. The host tunes purses, timers, squad limits and RTM cards." },
  { title: "Work the paddle", text: "Names arrive in sets, marquee first. Beat the current bid before the clock runs out, or set a proxy ceiling and wait." },
  { title: "Close the book", text: "When the pool is done, run the accelerated round for unsold names, then see standings, best XIs, grades and awards." },
];

const RULES = [
  { q: "Increments", a: "₹5 L below ₹1 Cr, ₹10 L to ₹2 Cr, ₹25 L to ₹5 Cr and ₹50 L beyond. You can always jump higher if the purse allows." },
  { q: "Timer", a: "Each name opens with a countdown. A bid inside the reset window pushes the clock back out, so nobody snipes the last millisecond." },
  { q: "Purse", a: "You cannot bid more than the money left. Mock mode starts from ₹120 Cr minus retained salaries." },
  { q: "Squad limits", a: "Minimum and maximum squad sizes are enforced, and overseas slots are capped — bids that break the rules are rejected." },
  { q: "Unsold", a: "Names with no bids go unsold. The host can run an accelerated round at the end to re-list them with faster timers." },
  { q: "Undo", a: "Mis-clicked the gavel? The host can undo the last sale, which refunds the purse and returns the player to the pool." },
];

const FAQ = [
  { q: "Do I need an account?", a: "No. Type a name and you are in. Your seat survives a refresh — the room remembers you with a rejoin token kept in your browser." },
  { q: "Can I play alone?", a: "Yes. 'Play solo vs AI' seats nine bot owners instantly. Choose easy, normal or insane difficulty in the house rules before you start." },
  { q: "How many friends can join?", a: "Ten franchises per table, with a spectator gallery on top. Latecomers can watch a running auction live." },
  { q: "What is the difference between the modes?", a: "Mock keeps retained squads, tighter purses and RTM cards. Mega is a clean slate with the top 300 names. Blitz is 120 names with rapid timers. Custom hands you every dial." },
  { q: "Does it work on a phone?", a: "It is built mobile-first: big bid buttons, a collapsible squad sheet, and a one-handed layout that keeps the current name on screen." },
  { q: "Who wins at the end?", a: "Every squad is graded on a best-XI engine that weighs rating, role balance, bench depth and overseas limits — plus awards for the biggest splash and best steal." },
];
