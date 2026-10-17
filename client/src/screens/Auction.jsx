import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useStore } from "../store.jsx";
import {
  Panel, TeamBadge, Money, RatingBadge, RolePill, TimerRing, Modal, IconBtn,
  Meter, Tooltip, useSkew,
} from "../components/ui.jsx";
import { sfx, unlockAudio } from "../lib/sound.js";
import { evaluateSquad, squadIssues, roleCounts, paceAdvice, PACE_COPY } from "../../../shared/evaluate.js";
import { nextBid, incrementFor, REACTIONS, SPORTS } from "../../../shared/constants.js";
import { ROLE_LABEL, COUNTRY_FLAG } from "../../../shared/teams.js";
import { HouseRulesModal } from "./Lobby.jsx";
import ScoutingModal, { ShortcutsModal, estValue } from "../components/Scouting.jsx";
import { getWatchlist, toggleWatch, SHORTCUTS } from "../lib/watchlist.js";
import { PlayerStatsBadge, PlayerStatsCard } from "../components/PlayerStats.jsx";

export default function Auction({ onLeave }) {
  const store = useStore();
  const { payload, live, me, isHost, act, notify, mergedTeams, playersById, current, currentPlayer, prefs, setPrefs, stats } = store;
  const [tab, setTab] = useState("table");
  const [mobileTab, setMobileTab] = useState("bid");
  const [reactOpen, setReactOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [chatText, setChatText] = useState("");
  const [bidError, setBidError] = useState(null);
  const [feedTab, setFeedTab] = useState("auctioneer");
  const [chat, setChat] = useState(payload?.chat || []);
  const [queueEndModal, setQueueEndModal] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [watch, setWatch] = useState(() => getWatchlist(payload?.code));
  const skew = useSkew(live?.serverTime || payload?.serverTime);

  useEffect(() => { if (payload?.chat) setChat(payload.chat); }, [payload?.chat]);
  useEffect(() => { setWatch(getWatchlist(payload?.code)); }, [payload?.code]);

  const onToggleWatch = useCallback((playerId) => {
    setWatch(toggleWatch(payload?.code, playerId));
  }, [payload?.code]);

  const settings = payload?.settings || {};
  const myTeam = mergedTeams.find((t) => t.id === me?.teamId) || null;
  const leaderTeam = current?.leaderId ? mergedTeams.find((t) => t.id === current.leaderId) : null;
  const isSpectator = !!me?.spectator;

  // live countdown
  const [leftMs, setLeftMs] = useState(0);
  const endsAt = current?.endsAt;
  const phase = current?.phase;
  useEffect(() => {
    let raf;
    const loop = () => {
      const now = Date.now() + (skew.current?.skew || 0);
      setLeftMs(endsAt ? Math.max(0, endsAt - now) : 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, skew]);

  const bidding = phase === "bidding" && !live?.paused;
  const timerTotal = useMemo(() => {
    if (!settings) return 20000;
    if (phase === "intro") return (settings.introSeconds || 3) * 1000;
    if (phase === "hammer") return (settings.hammerSeconds || 3) * 1000;
    if (phase === "rtm") return (settings.rtmWindowSeconds || 8) * 1000;
    return Math.max((settings.bidSeconds || 20) * 1000, (settings.resetSeconds || 10) * 1000);
  }, [phase, settings]);

  // ── bid capability ────────────────────────────────────────────────────────
  const compliance = useMemo(() => checkCompliance(myTeam, playersById, settings, currentPlayer), [myTeam, playersById, settings, currentPlayer]);
  const minBid = current ? nextBid(current.bidL) : 0;
  const bidAmount = current ? current.bidL + incrementFor(current.bidL) * multiplier : 0;
  const canBid = !isSpectator && !!myTeam && bidding && compliance.ok && bidAmount <= (myTeam?.purseLeftL ?? 0)
    && current?.leaderId !== myTeam?.id && !compliance.passed;

  // Pacing advisor: keeps owners from blowing the purse too early.
  const pace = useMemo(() => myTeam ? paceAdvice({
    purseLeftL: myTeam.purseLeftL,
    squadSize: teamPlayers(myTeam, playersById).length,
    minSquad: settings.minSquad,
    maxSquad: settings.maxSquad,
    playersLeft: Math.max(0, (payload?.queue?.length || 0) - (live?.index ?? payload?.index ?? 0)),
    rating: currentPlayer?.rating || 70,
    budgetL: (settings.budgetCr || 120) * 100,
  }) : null, [myTeam, playersById, settings, payload?.queue?.length, live?.index, payload?.index, currentPlayer]);

  const doBid = useCallback(async (amount) => {
    if (!amount || amount <= 0) return;
    unlockAudio();
    const res = await act("bid:place", { amount });
    if (!res?.ok) { setBidError(res?.error || "Bid rejected"); setTimeout(() => setBidError(null), 2200); sfx.error(); }
    else { setBidError(null); setMultiplier(1); }
  }, [act]);

  const doPass = useCallback(async () => {
    const res = await act("bid:pass");
    if (res?.ok) { notify("You passed on this name", "info"); sfx.click(); }
  }, [act, notify]);

  const doRtm = useCallback(async () => {
    const res = await act("rtm:use");
    if (!res?.ok) notify(res?.error || "RTM unavailable", "error");
  }, [act, notify]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.code === "Space" || e.code === "Enter") {
        if (canBid) { e.preventDefault(); doBid(bidAmount); }
      } else if (e.key === "1") setMultiplier(1);
      else if (e.key === "2") setMultiplier(2);
      else if (e.key === "3") setMultiplier(3);
      else if (e.key === "5") setMultiplier(5);
      else if (e.key.toLowerCase() === "p") doPass();
      else if (e.key.toLowerCase() === "a") setAutoOpen(true);
      else if (e.key.toLowerCase() === "m") setPrefs({ sound: !prefs.sound });
      else if (e.key.toLowerCase() === "r") setReactOpen(true);
      else if (e.key.toLowerCase() === "s") setScoutOpen(true);
      else if (e.key === "?") setHelpOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBid, bidAmount, doBid, doPass, prefs.sound, setPrefs]);

  useEffect(() => { setMultiplier(1); }, [current?.playerId]);

  // Ping the owner when one of their targets reaches the podium.
  useEffect(() => {
    if (!current?.playerId || !watch.includes(current.playerId)) return;
    const p = playersById.get(current.playerId);
    if (!p) return;
    notify(`★ Your target is up: ${p.name} (base ${p.base >= 100 ? `₹${(p.base / 100).toFixed(1)}Cr` : `₹${p.base}L`})`, "warn", 4200);
    sfx.urgent();
  }, [current?.playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = payload?.queue?.length ? Math.min(100, ((live?.index ?? payload?.index ?? 0) / payload.queue.length) * 100) : 0;
  const upNext = useMemo(() => {
    const q = payload?.queue || [];
    const i = live?.index ?? payload?.index ?? 0;
    return q.slice(i + 1, i + 9).map((id) => playersById.get(id)).filter(Boolean);
  }, [payload?.queue, live?.index, payload?.index, playersById]);

  const soldList = useMemo(() => (live?.sold || payload?.sold || []).slice().reverse(), [live?.sold, payload?.sold]);
  const unsoldIds = payload?.unsold || [];

  useEffect(() => {
    if (store.event?.type === "results") setQueueEndModal(false);
  }, [store.event]);

  const queueDone = (live?.index ?? payload?.index ?? 0) >= (payload?.queue?.length || 0) && !current;
  useEffect(() => { if (queueDone && isHost && !payload?.results) setQueueEndModal(true); }, [queueDone, isHost, payload?.results]);

  if (!payload) return null;

  const squadReport = myTeam ? evaluateSquad(teamPlayers(myTeam, playersById), {
    sport: payload.sport, settings, purseLeftL: myTeam.purseLeftL,
    spentL: myTeam.spentL + (myTeam.retentions || []).reduce((a, r) => a + r.salaryL, 0),
  }) : null;

  return (
    <div className="relative z-10 flex min-h-screen flex-col pb-[132px] lg:pb-0">
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-night-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-gold-300 to-gold-600 text-base shadow-glow">🔨</span>
            <div className="leading-tight">
              <div className="font-display text-base tracking-wider text-white">{payload.code}</div>
              <div className="text-[10px] uppercase tracking-[.16em] text-slate-500">
                {payload.sets?.[0] && current ? (current.setName || "") : "auction"}
              </div>
            </div>
          </div>

          <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

          <div className="flex min-w-[140px] flex-1 items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-turf-500 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-mono text-[11px] text-slate-400">{live?.index ?? payload?.index}/{payload.queue?.length || 0}</span>
            <span className="chip !py-0.5 !text-[9px]">{live?.soldCount ?? 0} sold</span>
            {(payload?.participants || []).filter((p) => p.spectator).length > 0 && (
              <span className="chip !py-0.5 !text-[9px] hidden sm:inline-flex">👀 {(payload.participants || []).filter((p) => p.spectator).length}</span>
            )}
            {(unsoldIds?.length || 0) > 0 && <span className="chip !py-0.5 !text-[9px] border-slate-500/40">{unsoldIds.length} unsold</span>}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {isHost && (
              <>
                <IconBtn title={live?.paused ? "Resume" : "Pause"} onClick={() => act("auction:pause", { paused: !live?.paused })} active={!live?.paused}>
                  {live?.paused ? "▶" : "⏸"}
                </IconBtn>
                <IconBtn title="Next player" onClick={() => act("auction:next")}><SkipIcon /></IconBtn>
                <IconBtn title="Move to passed list" onClick={() => act("auction:skip")}>⏭</IconBtn>
                <IconBtn title="Undo last sale" onClick={async () => { const r = await act("auction:undo"); if (r?.ok) notify("Sale undone", "info"); }}>↩</IconBtn>
                <IconBtn title="House rules" onClick={() => setRulesOpen(true)}>⚙</IconBtn>
                <IconBtn title="Close the book & see results" onClick={() => setEndOpen(true)}>🏁</IconBtn>
              </>
            )}
            <IconBtn title="Scouting board (S)" onClick={() => setScoutOpen(true)}>🔎</IconBtn>
            <IconBtn title="Shortcuts (?)" onClick={() => setHelpOpen(true)}>⌨</IconBtn>
            <IconBtn title="Reactions" onClick={() => setReactOpen(true)}>😀</IconBtn>
            <IconBtn title={prefs.sound ? "Mute" : "Unmute"} active={prefs.sound} onClick={() => { setPrefs({ sound: !prefs.sound }); sfx.click(); }}>{prefs.sound ? "🔊" : "🔇"}</IconBtn>
            <IconBtn title="Leave" onClick={onLeave}>🚪</IconBtn>
          </div>
        </div>
        {live?.paused && (
          <div className="bg-gold-500/12 px-3 py-1 text-center text-[11px] font-bold uppercase tracking-[.2em] text-gold-300">
            ⏸ Auction paused by the host
          </div>
        )}
      </div>

      {/* ── LIVE TICKER ─────────────────────────────────────────────────── */}
      {soldList.length > 0 && (
        <div className="relative overflow-hidden border-b border-white/6 bg-night-900/60">
          <div className="marquee-track gap-6 py-1.5">
            {[...soldList, ...soldList].map((s, i) => {
              const t = mergedTeams.find((x) => x.id === s.teamId);
              return (
                <span key={`${s.playerId}-${i}`} className="flex shrink-0 items-center gap-1.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t?.primary || "#888" }} />
                  <span className="font-semibold text-slate-300">{s.name}</span>
                  <span className="font-mono text-gold-300">{s.amountL >= 100 ? `₹${(s.amountL / 100).toFixed(2)}Cr` : `₹${s.amountL}L`}</span>
                  <span className="text-slate-500">{t?.short}</span>
                  {s.rtm && <span className="text-violet-300">RTM</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
      <div className="mx-auto grid w-full max-w-[1700px] flex-1 gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <PlayerStage
            player={currentPlayer} current={current} leaderTeam={leaderTeam} leftMs={leftMs}
            timerTotal={timerTotal} phase={phase} settings={settings} playersById={playersById}
            myTeam={myTeam} isSpectator={isSpectator} payload={payload} live={live}
            mergedTeams={mergedTeams} onRtm={doRtm}
            watch={watch} onToggleWatch={onToggleWatch} stats={stats}
          />

          {/* BID CONSOLE (desktop) */}
          {!isSpectator && (
            <div className="hidden lg:block">
              <BidConsole
                current={current} myTeam={myTeam} compliance={compliance} canBid={canBid}
                bidAmount={bidAmount} multiplier={multiplier} setMultiplier={setMultiplier}
                onBid={doBid} onPass={doPass} onAuto={() => setAutoOpen(true)}
                bidding={bidding} leftMs={leftMs} settings={settings} playersById={playersById}
                error={bidError} isHost={isHost} act={act} pace={pace}
              />
            </div>
          )}

          {/* UP NEXT */}
          <Panel title="Coming up" dense
            right={
              <div className="flex items-center gap-2">
                {watch.length > 0 && <span className="chip !py-0.5 !text-[9px] border-gold-400/40 text-gold-300">★ {watch.length} targets</span>}
                <button className="chip !py-0.5 !text-[9px] hover:border-white/25 hover:text-white" onClick={() => setScoutOpen(true)}>🔎 Scout pool</button>
              </div>
            }>
            <div className="flex gap-2 overflow-x-auto scroll-thin p-3">
              {upNext.length === 0 && <p className="py-3 text-center text-xs text-slate-500">That is the end of the list.</p>}
              {upNext.map((p, i) => (
                <div key={p.id} className={clsx("panel-flat relative min-w-[150px] flex-1 p-2",
                  i === 0 && "border-gold-500/30 bg-gold-500/6", watch.includes(p.id) && "border-gold-400/40 bg-gold-500/8")}>
                  <button
                    onClick={() => onToggleWatch(p.id)}
                    className={clsx("absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md text-[11px] transition",
                      watch.includes(p.id) ? "bg-gold-500/20 text-gold-300" : "text-slate-600 hover:text-gold-300")}
                    title="Add to targets"
                  >{watch.includes(p.id) ? "★" : "☆"}</button>
                  <div className="flex items-center gap-2">
                    <RatingBadge rating={p.rating} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-bold text-white">{p.name}</div>
                      <div className="flex items-center gap-1"><RolePill role={p.role} /><span className="text-[10px] text-slate-500">{COUNTRY_FLAG[p.country] || ""} <Money lakhs={p.base} /></span></div>
                    </div>
                  </div>
                  {i === 0 && <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-gold-400">next on the block</div>}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ── RIGHT RAIL ──────────────────────────────────────────────── */}
        <div className="hidden flex-col gap-3 lg:flex">
          <div className="panel flex overflow-hidden">
            {[["table", "Table"], ["squad", "My squad"], ["feed", "Feed"], ["book", "Ledger"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={clsx("flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition",
                  tab === id ? "bg-white/8 text-gold-300" : "text-slate-400 hover:bg-white/4 hover:text-slate-200")}>
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .16 }}>
                {tab === "table" && <TablePanel mergedTeams={mergedTeams} payload={payload} live={live} current={current} playersById={playersById} settings={settings} me={me} />}
                {tab === "squad" && <SquadPanel myTeam={myTeam} playersById={playersById} settings={settings} sport={payload.sport} report={squadReport} />}
                {tab === "feed" && <FeedPanel payload={payload} chat={chat} chatText={chatText} setChatText={setChatText} act={act} feedTab={feedTab} setFeedTab={setFeedTab} />}
                {tab === "book" && <LedgerPanel soldList={soldList} unsoldIds={unsoldIds} playersById={playersById} mergedTeams={mergedTeams} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── MOBILE ─────────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-night-950/95 backdrop-blur-xl lg:hidden" style={{ paddingBottom: "var(--safe-b)" }}>
        <AnimatePresence>
          {mobileTab !== "bid" && (
            <motion.div initial={{ height: 0 }} animate={{ height: "min(46vh, 380px)" }} exit={{ height: 0 }} className="overflow-hidden border-b border-white/8">
              <div className="h-full overflow-y-auto scroll-thin p-3">
                {mobileTab === "table" && <TablePanel mergedTeams={mergedTeams} payload={payload} live={live} current={current} playersById={playersById} settings={settings} me={me} />}
                {mobileTab === "squad" && <SquadPanel myTeam={myTeam} playersById={playersById} settings={settings} sport={payload.sport} report={squadReport} />}
                {mobileTab === "feed" && <FeedPanel payload={payload} chat={chat} chatText={chatText} setChatText={setChatText} act={act} feedTab={feedTab} setFeedTab={setFeedTab} />}
                {mobileTab === "book" && <LedgerPanel soldList={soldList} unsoldIds={unsoldIds} playersById={playersById} mergedTeams={mergedTeams} />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {!isSpectator ? (
          <BidConsole compact current={current} myTeam={myTeam} compliance={compliance} canBid={canBid}
            bidAmount={bidAmount} multiplier={multiplier} setMultiplier={setMultiplier}
            onBid={doBid} onPass={doPass} onAuto={() => setAutoOpen(true)} bidding={bidding}
            leftMs={leftMs} settings={settings} playersById={playersById} error={bidError} isHost={isHost} act={act} pace={pace} />
        ) : (
          <div className="px-4 py-3 text-center text-xs font-semibold text-slate-400">👀 Spectator seat — enjoy the show</div>
        )}
        <div className="grid grid-cols-5 border-t border-white/8">
          {[["bid", "🔨", "Bid"], ["table", "🏟", "Table"], ["squad", "📋", "Squad"], ["feed", "💬", "Feed"], ["book", "📒", "Ledger"]].map(([id, icon, label]) => (
            <button key={id} onClick={() => setMobileTab((t) => (t === id ? "bid" : id))}
              className={clsx("flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition",
                mobileTab === id ? "text-gold-300" : "text-slate-500")}>
              <span className="text-base">{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────── */}
      <Modal open={endOpen} onClose={() => setEndOpen(false)} title="Close the book?"
        footer={<>
          <button className="btn-ghost" onClick={() => setEndOpen(false)}>Keep going</button>
          <button className="btn-danger" onClick={() => { setEndOpen(false); act("auction:finish"); }}>🏁 End & show results</button>
        </>}>
        <p className="text-sm text-slate-300">
          This stops the auction where it is and grades every table on the squads built so far.
          {unsoldIds.length > 0 ? ` ${unsoldIds.length} unsold name(s) will stay unsold.` : ""}
        </p>
      </Modal>
      <ReactionModal open={reactOpen} onClose={() => setReactOpen(false)} act={act} />
      <ShortcutsModal open={helpOpen} onClose={() => setHelpOpen(false)} shortcuts={SHORTCUTS} />
      <ScoutingModal
        open={scoutOpen} onClose={() => setScoutOpen(false)}
        players={payload.players || []} queue={payload.queue || []}
        watch={watch} onToggleWatch={onToggleWatch} sport={payload.sport}
        soldIds={(live?.sold || payload?.sold || []).map((s) => s.playerId)}
        soldBy={Object.fromEntries(mergedTeams.map((t) => [t.id, t]))}
      />
      <HouseRulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} settings={settings} sport={payload.sport} />
      <AutoBidModal open={autoOpen} onClose={() => setAutoOpen(false)} myTeam={myTeam} current={current} act={act} notify={notify} playersById={playersById} currentPlayer={currentPlayer} />
      <Modal open={queueEndModal} onClose={() => setQueueEndModal(false)} title="The list is done"
        footer={<>
          <button className="btn-ghost" onClick={() => { setQueueEndModal(false); act("auction:finish"); }}>Close the book</button>
          {unsoldIds.length > 0 && <button className="btn-turf" onClick={() => { setQueueEndModal(false); act("auction:accelerate"); }}>⚡ Run accelerated round ({unsoldIds.length})</button>}
        </>}>
        <p className="text-sm text-slate-300">
          Every name has been through the room. You can run an <b>accelerated round</b> to re-list the {unsoldIds.length} unsold
          player{unsoldIds.length === 1 ? "" : "s"} with faster timers, or close the book and see the standings.
        </p>
      </Modal>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Player stage
// ────────────────────────────────────────────────────────────────────────────
function PlayerStage({ player, current, leaderTeam, leftMs, timerTotal, phase, settings, playersById, myTeam, isSpectator, payload, live, mergedTeams, onRtm, watch = [], onToggleWatch, stats }) {
  const [detailOpen, setDetailOpen] = useState(false);
  if (!player) {
    return (
      <Panel className="grid min-h-[280px] place-items-center p-10 text-center">
        <div>
          <div className="text-4xl">🔨</div>
          <h2 className="mt-3 font-display text-3xl tracking-wide text-white">
            {payload.status === "done" ? "Auction closed" : live?.paused ? "Paused" : "Between names"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {payload.status === "done" ? "Check the standings for grades and awards." : "The next player is being brought to the podium."}
          </p>
        </div>
      </Panel>
    );
  }

  const tierTone = {
    MARQUEE: "from-amber-400/20 via-transparent to-transparent border-gold-400/30",
    ELITE: "from-emerald-400/16 via-transparent to-transparent border-emerald-400/25",
    CORE: "from-sky-400/14 via-transparent to-transparent border-sky-400/20",
    SUPPORT: "from-white/8 via-transparent to-transparent border-white/12",
    EMERGING: "from-violet-400/12 via-transparent to-transparent border-violet-400/20",
  }[player.tier] || "border-white/12";

  const sold = phase === "sold";
  const unsold = phase === "unsold";
  const rtmActive = phase === "rtm";
  const rtmEligible = rtmActive && !isSpectator && myTeam && current?.rtmEligible?.includes(myTeam.id);

  return (
    <>
      <motion.div layout className={clsx("panel relative overflow-hidden border bg-gradient-to-br", tierTone)}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-5">
          {/* rating block */}
          <div className="flex items-center gap-3 sm:flex-col sm:items-start">
            <RatingBadge rating={player.rating} size="lg" />
            <div className="sm:mt-1">
              <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{player.tier}</div>
              <div className="text-[11px] text-slate-500">{payload.queue?.length ? `#${(live?.index ?? payload.index ?? 0) + 1} of ${payload.queue.length}` : ""}</div>
            </div>
          </div>

          {/* identity */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <RolePill role={player.role} />
              <span className="chip !py-0.5 !text-[10px]">{COUNTRY_FLAG[player.country] || "🏳"} {player.overseas ? player.country : "India"}</span>
              <PlayerStatsBadge stats={stats?.[player.id]} />
              {current?.setName && <span className="chip !py-0.5 !text-[10px] border-gold-500/25 text-gold-300/90">{current.setName}</span>}
              <button className="chip !py-0.5 !text-[10px] hover:border-white/25 hover:text-white" onClick={() => setDetailOpen(true)}>📈 full card</button>
              <button
                onClick={() => onToggleWatch?.(player.id)}
                className={clsx("chip !py-0.5 !text-[10px]",
                  watch.includes(player.id) ? "border-gold-400/50 bg-gold-500/15 text-gold-200" : "hover:border-white/25 hover:text-white")}
              >{watch.includes(player.id) ? "★ on your target list" : "☆ add target"}</button>
              <span className="chip !py-0.5 !text-[10px] border-white/8 text-slate-400">est. value <Money lakhs={estValue(player)} compact /></span>
            </div>
            <h2 className="mt-1.5 truncate font-display text-[clamp(1.9rem,5.4vw,3.2rem)] leading-none tracking-wide text-white">
              {player.name}
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-400">{player.style}</p>

            <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Base price</div>
                <div className="font-display text-xl text-slate-300"><Money lakhs={player.base} /></div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Current bid</div>
                <motion.div key={current?.bidL} initial={{ scale: 1.14, color: "#ffe9a8" }} animate={{ scale: 1, color: "#ffffff" }}
                  className="font-display text-[clamp(1.8rem,5vw,2.8rem)] leading-none text-white">
                  <Money lakhs={current?.bidL ?? player.base} />
                </motion.div>
              </div>
              <div className="min-w-[150px]">
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Leading bid</div>
                {leaderTeam ? (
                  <motion.div key={leaderTeam.id} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="mt-1 flex items-center gap-2">
                    <TeamBadge team={leaderTeam} size={26} />
                    <span className="truncate text-sm font-bold" style={{ color: leaderTeam.primary }}>{leaderTeam.name}</span>
                    {current?.bidCount > 1 && <span className="chip !py-0 !text-[9px]">{current.bidCount} bids</span>}
                  </motion.div>
                ) : (
                  <div className="mt-1 text-sm font-semibold text-slate-500">No bids yet</div>
                )}
              </div>
            </div>

            {/* RTM strip */}
            <AnimatePresence>
              {rtmActive && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-400/35 bg-violet-500/10 px-3 py-2">
                    <div className="text-[12px] font-semibold text-violet-200">
                      🃏 Right-To-Match window — match <Money lakhs={current.bidL} /> and take {player.name.split(" ")[0]} to your table.
                    </div>
                    {rtmEligible ? (
                      <button className="btn !bg-violet-500 !px-3 !py-1.5 !text-xs !text-white hover:!bg-violet-400" onClick={onRtm}>Use RTM ({myTeam.rtmLeft} left)</button>
                    ) : (
                      <span className="chip !border-violet-400/30 !text-violet-200">watching</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* timer */}
          <div className="flex items-center justify-center gap-3 sm:flex-col">
            <TimerRing ms={leftMs} total={timerTotal} size={104}
              label={phase === "intro" ? "up next" : phase === "hammer" ? "going…" : phase === "rtm" ? "RTM" : phase === "bidding" ? "to bid" : sold ? "sold" : unsold ? "unsold" : ""} />
            <div className="text-center">
              {phase === "hammer" && <div className="font-display text-lg tracking-widest text-gold-300 animate-glowPulse">GOING…</div>}
              {phase === "bidding" && leftMs < 5000 && leftMs > 0 && (
                <div className="font-display text-lg tracking-widest text-flare-400 heartbeat">LAST CALL</div>
              )}
              {sold && <div className="font-display text-lg tracking-widest text-turf-400">SOLD</div>}
              {unsold && <div className="font-display text-lg tracking-widest text-slate-400">UNSOLD</div>}
            </div>
          </div>
        </div>

        {/* bid history ticker */}
        {current?.history?.length > 0 && (
          <div className="border-t border-white/8 bg-night-950/40 px-4 py-2">
            <div className="flex items-center gap-2 overflow-x-auto scroll-thin text-[11px]">
              <span className="shrink-0 font-bold uppercase tracking-widest text-slate-500">Trail</span>
              {current.history.slice(-10).map((h, i) => {
                const t = mergedTeams.find((x) => x.id === h.teamId);
                return (
                  <span key={i} className="flex shrink-0 items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: t?.primary || "#888" }} />
                    <span className="font-semibold text-slate-300">{t?.short}</span>
                    <span className="font-mono text-gold-300">{h.amountL >= 100 ? `${(h.amountL / 100).toFixed(2)}Cr` : `${h.amountL}L`}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={player.name}>
        <PlayerDetail player={player} stats={stats?.[player.id]} />
      </Modal>
    </>
  );
}

function PlayerDetail({ player, stats }) {
  const bars = useMemo(() => {
    const r = player.rating;
    if (player.role === "BAT" || player.role === "WK") return [["Power", r], ["Timing", Math.min(99, r + 3)], ["Tempo", Math.max(45, r - 8)], ["Consistency", Math.min(99, r + 1)]];
    if (player.role === "AR") return [["Batting", Math.max(50, r - 4)], ["Bowling", Math.max(50, r - 6)], ["Fielding", Math.min(99, r + 2)], ["Impact", r]];
    if (player.role === "GK") return [["Reflexes", r], ["Distribution", Math.max(50, r - 5)], ["Command", Math.min(99, r + 1)], ["Consistency", r - 2]];
    if (player.role === "DEF") return [["Defending", r], ["Passing", Math.max(45, r - 10)], ["Pace", Math.max(45, r - 6)], ["Aerial", Math.min(99, r + 2)]];
    if (player.role === "MID") return [["Vision", r], ["Pressing", Math.min(99, r + 1)], ["Passing", r + 2], ["Stamina", Math.min(99, r + 3)]];
    if (player.role === "FWD") return [["Finishing", r], ["Dribbling", Math.min(99, r + 2)], ["Pace", Math.min(99, r + 1)], ["Movement", r]];
    return [["Pace", r], ["Swing", Math.max(45, r - 6)], ["Economy", Math.min(99, r + 1)], ["Wicket-taking", r - 2]];
  }, [player]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <RatingBadge rating={player.rating} size="lg" />
        <div>
          <div className="text-sm font-bold text-white">{ROLE_LABEL[player.role] || player.role}</div>
          <div className="text-xs text-slate-400">{COUNTRY_FLAG[player.country]} {player.country} • {player.tier} tier</div>
          <div className="mt-1 text-[11px] text-slate-500">{player.style}</div>
        </div>
      </div>
      <div>
        <div className="label">Attribute profile</div>
        <div className="space-y-2">
          {bars.map(([label, v]) => (
            <div key={label}>
              <div className="mb-0.5 flex justify-between text-[11px]"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-300">{Math.round(Math.min(99, Math.max(40, v)))}</span></div>
              <Meter value={Math.min(99, Math.max(40, v))} tone={v >= 88 ? "gold" : v >= 78 ? "turf" : "blue"} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="panel-flat p-2.5 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500">Base</div><div className="font-display text-lg text-white"><Money lakhs={player.base} /></div></div>
        <div className="panel-flat p-2.5 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500">Est. value</div><div className="font-display text-lg text-gold-300"><Money lakhs={Math.round(player.base * (0.9 + Math.min(1, Math.max(0, (player.rating - 58) / 38)) * 5.5) / 5) * 5} /></div></div>
        <div className="panel-flat p-2.5 text-center"><div className="text-[10px] uppercase tracking-wider text-slate-500">Type</div><div className="font-display text-lg text-white">{player.overseas ? "Overseas" : "Domestic"}</div></div>
      </div>
      <PlayerStatsCard player={player} stats={stats} />
      <p className="rounded-lg border border-white/8 bg-white/3 p-2.5 text-[11.5px] leading-relaxed text-slate-400">
        Estimated value is what the AI owners roughly think this name is worth. Going well above it is a statement
        signing; going well under it is the steal of the night.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bid console
// ────────────────────────────────────────────────────────────────────────────
function BidConsole({ compact, current, myTeam, compliance, canBid, bidAmount, multiplier, setMultiplier, onBid, onPass, onAuto, bidding, leftMs, settings, playersById, error, isHost, act, pace }) {
  const leaderIsMe = current?.leaderId && myTeam && current.leaderId === myTeam.id;
  const rtmPhase = current?.phase === "rtm";
  const urgent = bidding && leftMs < 5000 && leftMs > 0;

  if (!myTeam) {
    return (
      <div className={clsx("panel p-4 text-center", compact && "rounded-none border-0")}>
        <p className="text-sm text-slate-300">You are in the gallery. Ask the host for a franchise seat to bid.</p>
      </div>
    );
  }

  return (
    <div className={clsx("panel p-3", compact && "rounded-none border-x-0 border-b-0")}>
      <div className={clsx("flex items-center gap-3", compact ? "flex-wrap" : "flex-wrap")}>
        {/* purse */}
        <div className="min-w-[130px] flex-1">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">Your purse</span>
            <span className="text-[10px] text-slate-500">{teamPlayers(myTeam, playersById).length}/{settings.maxSquad} players</span>
          </div>
          <div className="font-display text-2xl leading-none text-gold-300"><Money lakhs={myTeam.purseLeftL} /></div>
          <Meter className="mt-1" value={myTeam.purseLeftL} max={settings.budgetCr * 100} tone={myTeam.purseLeftL < settings.budgetCr * 20 ? "flare" : "gold"} height={4} />
        </div>

        {/* main bid button */}
        <div className={clsx("flex flex-1 items-center gap-2", compact && "w-full")}>
          <button
            onClick={() => onBid(bidAmount)}
            disabled={!canBid}
            className={clsx(
              "no-tap relative flex-1 overflow-hidden rounded-2xl px-4 py-3.5 text-center font-display tracking-wide transition active:scale-[.98]",
              canBid ? "bg-gradient-to-b from-gold-300 to-gold-600 text-night-950 shadow-glow" : "cursor-not-allowed border border-white/10 bg-white/5 text-slate-500",
              urgent && canBid && "urgent",
            )}
            style={{ fontSize: compact ? "1.5rem" : "1.8rem", lineHeight: 1 }}
          >
            {leaderIsMe ? "YOU'RE ON TOP" : rtmPhase ? "RTM WINDOW" : !bidding ? "STANDBY" : `BID ${bidAmount >= 100 ? `₹${(bidAmount / 100).toFixed(2)} Cr` : `₹${bidAmount} L`}`}
            {canBid && <span className="mt-0.5 block font-sans text-[10px] font-bold uppercase tracking-[.18em] opacity-70">space bar • +{incrementFor(current?.bidL || 0) * multiplier} L</span>}
          </button>
          <div className="flex flex-col gap-1.5">
            <button className="btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={onAuto} title="Proxy auto-bid (A)">
              🤖 Auto{myTeam.autoBidL ? ` ≤${myTeam.autoBidL >= 100 ? (myTeam.autoBidL / 100).toFixed(1) + "Cr" : myTeam.autoBidL + "L"}` : ""}
            </button>
            <button className="btn-ghost !px-2.5 !py-1.5 text-[11px]" onClick={onPass} disabled={!bidding || compliance.passed}>
              {compliance.passed ? "Passed" : "🚫 Pass (P)"}
            </button>
          </div>
        </div>
      </div>

      {/* multipliers + compliance */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Jump</span>
        {[1, 2, 3, 5].map((m) => (
          <button key={m} onClick={() => { setMultiplier(m); sfx.hover(); }}
            className={clsx("rounded-lg border px-2.5 py-1 text-[11px] font-bold transition",
              multiplier === m ? "border-gold-400/60 bg-gold-500/15 text-gold-200" : "border-white/10 bg-white/4 text-slate-400 hover:bg-white/8")}>
            +{incrementFor(current?.bidL || 0) * m} L
          </button>
        ))}
        <span className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
        {!compliance.ok && (
          <span className="chip !border-flare-500/35 !bg-flare-500/10 !text-rose-200">⚠ {compliance.reason}</span>
        )}
        {compliance.ok && !leaderIsMe && bidding && (
          <span className="chip !border-turf-500/30 !bg-turf-500/10 !text-turf-200">✓ Eligible to bid</span>
        )}
        {pace && current?.phase === "bidding" && (
          <Tooltip text={PACE_COPY[pace.mood]}>
            <span className={clsx("chip cursor-help",
              pace.mood === "must-fill" ? "!border-flare-500/40 !bg-flare-500/10 !text-rose-200"
              : pace.mood === "overstretched" ? "!border-gold-500/40 !bg-gold-500/10 !text-gold-200"
              : "!border-sky-500/30 !bg-sky-500/10 !text-sky-200")}>
              📈 pace: {pace.mood === "must-fill" ? "must fill" : pace.mood} • fair ceiling <Money lakhs={pace.ceilingL} compact />
            </span>
          </Tooltip>
        )}
        {isHost && current && (
          <span className="ml-auto flex gap-1.5">
            <button className="chip hover:border-white/25" onClick={() => act("auction:next")}>next ⏭</button>
          </span>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 rounded-lg border border-flare-500/35 bg-flare-600/15 px-3 py-1.5 text-[12px] font-semibold text-rose-100">
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Right-rail panels
// ────────────────────────────────────────────────────────────────────────────
function TablePanel({ mergedTeams, payload, live, current, playersById, settings, me }) {
  const ranked = mergedTeams.slice().sort((a, b) => (b.purseLeftL ?? 0) - (a.purseLeftL ?? 0));
  const xiOf = (t) => evaluateSquad(teamPlayers(t, playersById), { sport: payload.sport, settings, purseLeftL: t.purseLeftL, spentL: t.spentL });
  return (
    <Panel title="The table" dense right={<span className="text-[11px] text-slate-500">live standings</span>}>
      <div className="divide-y divide-white/6">
        {ranked.map((t) => {
          const owner = (payload.participants || []).find((p) => p.teamId === t.id);
          const rep = xiOf(t);
          const leading = current?.leaderId === t.id;
          const mine = me?.teamId === t.id;
          return (
            <div key={t.id} className={clsx("flex items-center gap-2.5 px-3 py-2 transition", leading && "bg-gold-500/8", mine && "bg-white/4")}>
              <TeamBadge team={t} size={32} ring={leading} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-white">{t.name}</span>
                  {owner?.isBot && <span className="text-[9px] text-violet-300">🤖</span>}
                  {!owner?.connected && owner && <span className="text-[9px] text-slate-500">offline</span>}
                  {leading && <span className="chip !px-1.5 !py-0 !text-[8px] border-gold-400/40 text-gold-300">BIDDING</span>}
                </div>
                <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
                  <span>{owner?.name || "—"}</span>
                  <span>•</span>
                  <span>{teamPlayers(t, playersById).length} players</span>
                  {settings.maxOverseas != null && <><span>•</span><span>{countOverseas(t, playersById)}/{settings.maxOverseas} OS</span></>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-base leading-none text-gold-300"><Money lakhs={t.purseLeftL} compact /></div>
                <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                  <span className={clsx("rounded px-1 font-black", gradeClass(rep.grade))}>{rep.grade}</span>
                  <span>{Math.round(rep.strength)}</span>
                  {settings.rtmCards > 0 && t.rtmLeft > 0 && <span className="text-violet-300">🃏{t.rtmLeft}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SquadPanel({ myTeam, playersById, settings, sport, report }) {
  if (!myTeam) return <Panel className="p-4 text-sm text-slate-400">No franchise assigned.</Panel>;
  const players = teamPlayers(myTeam, playersById);
  const issues = squadIssues(players, settings, sport);
  const counts = roleCounts(players);
  return (
    <Panel title="Your squad" dense right={<span className={clsx("chip !py-0.5 !text-[9px]", gradeClass(report?.grade))}>{report?.grade} • {Math.round(report?.strength || 0)}</span>}>
      <div className="space-y-3 p-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Players" value={`${players.length}/${settings.maxSquad}`} />
          <MiniStat label="Spent" value={<Money lakhs={myTeam.spentL} compact />} />
          <MiniStat label="Left" value={<Money lakhs={myTeam.purseLeftL} compact />} tone="gold" />
        </div>

        <div>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
            <span>Squad strength</span><span className="font-mono text-slate-300">{Math.round(report?.strength || 0)}/100</span>
          </div>
          <Meter value={report?.strength || 0} tone="turf" height={8} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(sport === "football" ? ["GK", "DEF", "MID", "FWD"] : ["BAT", "WK", "AR", "PACE", "SPIN"]).map((r) => (
            <span key={r} className="rounded-lg border border-white/8 bg-white/4 px-2 py-1 text-[10.5px]">
              <b className="text-white">{counts[r] || 0}</b> <span className="text-slate-400">{ROLE_LABEL[r]?.split(" ")[0] || r}</span>
            </span>
          ))}
          {settings.maxOverseas != null && (
            <span className={clsx("rounded-lg border px-2 py-1 text-[10.5px]",
              countOverseas(myTeam, playersById) >= settings.maxOverseas ? "border-flare-500/40 bg-flare-500/10 text-rose-200" : "border-white/8 bg-white/4 text-slate-300")}>
              <b>{countOverseas(myTeam, playersById)}</b>/{settings.maxOverseas} overseas
            </span>
          )}
        </div>

        {issues.length > 0 && (
          <ul className="space-y-1">
            {issues.map((i, idx) => (
              <li key={idx} className={clsx("flex items-start gap-1.5 rounded-lg px-2 py-1 text-[11px]",
                i.level === "error" ? "bg-flare-500/12 text-rose-200" : i.level === "warn" ? "bg-gold-500/10 text-gold-200" : "bg-white/4 text-slate-400")}>
                <span>{i.level === "error" ? "⛔" : i.level === "warn" ? "⚠️" : "ℹ️"}</span>{i.text}
              </li>
            ))}
          </ul>
        )}

        <div className="max-h-[34vh] space-y-1 overflow-y-auto scroll-thin">
          {players.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No signings yet.</p>}
          {[...players].sort((a, b) => b.rating - a.rating).map((p) => {
            const inXI = report?.xi?.some((x) => x.id === p.id);
            const retained = (myTeam.retentions || []).some((r) => r.playerId === p.id);
            const sale = (myTeam.purchases || []).find?.((s) => s.playerId === p.id);
            return (
              <div key={p.id} className={clsx("flex items-center gap-2 rounded-lg border px-2 py-1.5", inXI ? "border-turf-500/25 bg-turf-500/6" : "border-white/6 bg-white/3")}>
                <RatingBadge rating={p.rating} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-white">{p.name}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <RolePill role={p.role} />{p.overseas ? p.country : "IND"}
                    {retained && <span className="text-gold-400">retained</span>}
                    {inXI && <span className="text-turf-400">XI</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function FeedPanel({ payload, chat, chatText, setChatText, act, feedTab, setFeedTab }) {
  return (
    <Panel dense className="flex h-full flex-col">
      <div className="flex border-b border-white/8">
        {[["auctioneer", "🎙 Auctioneer"], ["chat", `💬 Chat (${chat.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setFeedTab(id)}
            className={clsx("flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition",
              feedTab === id ? "bg-white/8 text-gold-300" : "text-slate-400 hover:text-slate-200")}>{label}</button>
        ))}
      </div>
      <div className="flex h-[52vh] flex-col-reverse gap-1.5 overflow-y-auto scroll-thin p-3 lg:h-[calc(100vh-320px)]">
        {(feedTab === "chat" ? [...chat].reverse() : [...(payload.feed || [])].reverse()).map((item) => (
          feedTab === "chat" ? (
            <div key={item.id} className="slide-up rounded-lg bg-white/4 px-2.5 py-1.5">
              <span className="text-[10.5px] font-bold text-gold-300">{item.from}</span>
              <p className="text-[12.5px] leading-snug text-slate-200">{item.text}</p>
            </div>
          ) : (
            <FeedRow key={item.id} item={item} />
          )
        ))}
      </div>
      <form className="flex gap-2 border-t border-white/8 p-2.5"
        onSubmit={(e) => { e.preventDefault(); if (!chatText.trim()) return; act("chat:send", { text: chatText }); setChatText(""); }}>
        <input className="input !py-2 text-xs" placeholder="Message the table…" value={chatText} maxLength={200}
          onChange={(e) => setChatText(e.target.value)} />
        <button className="btn-primary !px-3 !py-2 text-xs" type="submit">Send</button>
      </form>
    </Panel>
  );
}

function FeedRow({ item }) {
  const tone = {
    bid: "text-slate-200", sold: "text-turf-300", steal: "text-sky-300", splash: "text-gold-300",
    unsold: "text-slate-400", rtm: "text-violet-300", system: "text-slate-500", hammer: "text-gold-200",
    open: "text-white", "rtm-window": "text-violet-200",
  }[item.type] || "text-slate-300";
  const icon = { bid: "💰", sold: "🔨", steal: "🎯", splash: "💸", unsold: "🚫", rtm: "🃏", system: "ℹ️", hammer: "⏳", open: "📣" }[item.type] || "•";
  return (
    <div className="slide-up flex gap-2 rounded-lg px-2 py-1.5 hover:bg-white/4">
      <span className="text-xs">{icon}</span>
      <p className={clsx("text-[12.5px] leading-snug", tone)}>{item.text}</p>
    </div>
  );
}

function LedgerPanel({ soldList, unsoldIds, playersById, mergedTeams }) {
  const [view, setView] = useState("sold");
  return (
    <Panel dense>
      <div className="flex border-b border-white/8">
        {[["sold", `Sold (${soldList.length})`], ["unsold", `Unsold (${unsoldIds.length})`]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={clsx("flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider", view === id ? "bg-white/8 text-gold-300" : "text-slate-400")}>{label}</button>
        ))}
      </div>
      <div className="max-h-[52vh] divide-y divide-white/5 overflow-y-auto scroll-thin lg:max-h-[calc(100vh-330px)]">
        {view === "sold" && soldList.map((s) => {
          const t = mergedTeams.find((x) => x.id === s.teamId);
          return (
            <div key={`${s.playerId}-${s.at}`} className="flex items-center gap-2 px-3 py-1.5">
              <TeamBadge team={t} size={24} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-white">{s.name}</div>
                <div className="text-[10px] text-slate-500">{ROLE_LABEL[s.role]?.split(" ")[0]} • base <Money lakhs={s.base} />{s.rtm ? " • RTM" : ""}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[12px] font-bold text-gold-300"><Money lakhs={s.amountL} compact /></div>
                <div className="text-[9px] text-slate-500">{s.bidCount} bids</div>
              </div>
            </div>
          );
        })}
        {view === "unsold" && (unsoldIds.length === 0
          ? <p className="p-6 text-center text-xs text-slate-500">Everyone found a home so far.</p>
          : unsoldIds.map((id) => {
            const p = playersById.get(id);
            if (!p) return null;
            return (
              <div key={id} className="flex items-center gap-2 px-3 py-1.5">
                <RatingBadge rating={p.rating} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-white">{p.name}</div>
                  <div className="text-[10px] text-slate-500">{ROLE_LABEL[p.role]?.split(" ")[0]} • {p.country}</div>
                </div>
                <div className="font-mono text-[11px] text-slate-500"><Money lakhs={p.base} /></div>
              </div>
            );
          }))}
      </div>
    </Panel>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className={clsx("panel-flat px-2 py-1.5 text-center", tone === "gold" && "border-gold-500/25 bg-gold-500/8")}>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-display text-base text-white">{value}</div>
    </div>
  );
}

function ReactionModal({ open, onClose, act }) {
  return (
    <Modal open={open} onClose={onClose} title="Send a reaction">
      <div className="grid grid-cols-5 gap-2">
        {REACTIONS.map((r) => (
          <button key={r} className="rounded-xl border border-white/10 bg-white/4 py-3 text-2xl transition hover:scale-110 hover:border-gold-400/40 hover:bg-white/10"
            onClick={() => { act("react:send", { emoji: r }); sfx.click(); onClose(); }}>
            {r}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-500">Reactions float across everyone's screen.</p>
    </Modal>
  );
}

function AutoBidModal({ open, onClose, myTeam, current, act, notify, playersById, currentPlayer }) {
  const [max, setMax] = useState(0);
  useEffect(() => {
    if (open && current) setMax(Math.min(myTeam?.purseLeftL || 0, nextBid(current.bidL) * 3));
  }, [open, current?.playerId]);
  if (!myTeam) return null;
  const min = current ? nextBid(current.bidL) : 0;
  const cap = myTeam.purseLeftL;
  return (
    <Modal open={open} onClose={onClose} title="Proxy auto-bid"
      footer={<>
        <button className="btn-ghost" onClick={async () => { await act("bid:auto", { max: 0 }); notify("Auto-bid cancelled", "info"); onClose(); }}>Cancel auto-bid</button>
        <button className="btn-gold" disabled={max < min || max > cap}
          onClick={async () => { const r = await act("bid:auto", { max }); if (r?.ok) { notify(`Auto-bidding up to ${r.maxL >= 100 ? `₹${(r.maxL / 100).toFixed(2)} Cr` : `₹${r.maxL} L`} on this name`, "info"); sfx.click(); onClose(); } }}>
          Set ceiling
        </button>
      </>}>
      <div className="space-y-3">
        <p className="text-[12.5px] leading-relaxed text-slate-400">
          Set the most you are willing to pay{currentPlayer ? ` for <b className="text-white">${currentPlayer.name}</b>` : ""}. Your paddle
          keeps raising by the minimum increment until the ceiling is hit or you are top. It applies to the current name only.
        </p>
        <div>
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-slate-400">Ceiling</span>
            <span className="font-mono text-gold-300">{max >= 100 ? `₹${(max / 100).toFixed(2)} Cr` : `₹${max} L`}</span>
          </div>
          <input type="range" min={min} max={cap} step={5} value={Math.max(min, Math.min(cap, max))}
            onChange={(e) => setMax(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-gold-500" />
          <div className="mt-1 flex justify-between text-[10px] text-slate-500">
            <span>min {min >= 100 ? `₹${(min / 100).toFixed(2)}Cr` : `₹${min}L`}</span>
            <span>purse {cap >= 100 ? `₹${(cap / 100).toFixed(2)}Cr` : `₹${cap}L`}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[min * 2, min * 3, min * 5, cap].map((v, i) => (
            <button key={i} className="rounded-lg border border-white/10 bg-white/4 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-white/10"
              onClick={() => setMax(Math.min(cap, Math.round(v / 5) * 5))}>
              {i === 3 ? "Max" : v >= 100 ? `${(v / 100).toFixed(1)}Cr` : `${v}L`}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function teamPlayers(team, playersById) {
  if (!team) return [];
  const out = [];
  for (const id of team.squad || []) {
    const p = playersById.get(id);
    if (p) out.push(p);
  }
  for (const r of team.retentions || []) if (!out.some((p) => p.id === r.playerId)) out.push(r);
  return out;
}

function countOverseas(team, playersById) {
  return teamPlayers(team, playersById).filter((p) => p.overseas).length;
}

function checkCompliance(team, playersById, settings, player) {
  if (!team) return { ok: false, reason: "No franchise" };
  const squad = teamPlayers(team, playersById);
  if (squad.length >= (settings.maxSquad || 25)) return { ok: false, reason: `Squad full (${settings.maxSquad})` };
  if (player?.overseas && settings.maxOverseas != null) {
    const os = squad.filter((p) => p.overseas).length;
    if (os >= settings.maxOverseas) return { ok: false, reason: `Overseas cap reached (${settings.maxOverseas})` };
  }
  return { ok: true, reason: "", passed: false };
}

function gradeClass(grade) {
  const map = {
    "A+": "border-turf-500/40 bg-turf-500/12 text-turf-300",
    A: "border-turf-500/30 bg-turf-500/8 text-turf-200",
    "B+": "border-lime-400/30 bg-lime-400/8 text-lime-200",
    B: "border-yellow-400/30 bg-yellow-400/8 text-yellow-200",
    "C+": "border-orange-400/30 bg-orange-400/8 text-orange-200",
    C: "border-orange-500/30 bg-orange-500/8 text-orange-200",
    D: "border-flare-500/30 bg-flare-500/8 text-rose-200",
    F: "border-flare-600/40 bg-flare-600/10 text-rose-300",
  };
  return `chip !py-0 !text-[9px] ${map[grade] || map.C}`;
}

const SkipIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5.5v13l9-6.5-9-6.5zM17 5h2v14h-2z" /></svg>
);
