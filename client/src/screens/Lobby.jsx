import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { useStore } from "../store.jsx";
import { Panel, TeamBadge, Modal, Slider, Toggle, Money, RatingBadge, RolePill, Spinner, IconBtn } from "../components/ui.jsx";
import { sfx } from "../lib/sound.js";
import { MODES, SPORTS } from "../../../shared/constants.js";
import { TEAMS } from "../../../shared/teams.js";
import ScoutingModal from "../components/Scouting.jsx";
import { getWatchlist, toggleWatch } from "../lib/watchlist.js";

export default function Lobby({ onLeave }) {
  const { payload, live, me, isHost, act, notify, prefs, setPrefs, mergedTeams, playersById } = useStore();
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chat, setChat] = useState(payload?.chat || []);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [watch, setWatch] = useState(() => getWatchlist(payload?.code));
  const settings = payload?.settings || {};

  useEffect(() => { if (payload?.chat) setChat(payload.chat); }, [payload?.chat]);

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}?room=${payload?.code}`;
  }, [payload?.code]);

  const owners = (payload?.participants || []).filter((p) => !p.spectator);
  const spectators = (payload?.participants || []).filter((p) => p.spectator);
  const bots = owners.filter((p) => p.isBot);
  const humans = owners.filter((p) => !p.isBot);

  const copy = async (text, label = "Room code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      notify(`${label} copied`, "info");
      sfx.click();
    } catch { notify("Copy failed — select it manually", "warn"); }
  };

  const share = async () => {
    const text = `Join my auction table — code ${payload.code}: ${inviteLink}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Auction Arena", text, url: inviteLink }); return; } catch { /* cancelled */ }
    }
    copy(text, "Invite");
  };

  const onStart = async () => {
    sfx.gavel();
    const res = await act("auction:start");
    if (!res?.ok) notify(res?.error || "Could not start", "error");
  };

  const marqueePreview = useMemo(() => {
    const ids = (payload?.queue || []).slice(0, 200);
    return ids.map((id) => playersById.get(id)).filter(Boolean).sort((a, b) => b.rating - a.rating).slice(0, 8);
  }, [payload?.queue, playersById]);

  if (!payload) return null;

  return (
    <div className="relative z-10 min-h-screen pb-28">
      {/* header */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-night-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 text-lg shadow-glow">🔨</span>
            <div>
              <div className="font-display text-lg leading-none tracking-wider text-white">{payload.title || "Auction table"}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                <span>{SPORTS[payload.sport]?.icon} {MODES[payload.mode]?.label}</span>
                <span className="opacity-40">•</span>
                <span>{payload.queue?.length || 0} names</span>
                <span className="opacity-40">•</span>
                <span>{payload.sets?.length || 0} sets</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="panel-flat flex items-center gap-2 px-3 py-2 font-mono text-sm tracking-[.28em] text-gold-300" onClick={() => copy(payload.code)}>
              {payload.code}
              <span className="text-[10px] font-sans tracking-normal text-slate-500">{copied ? "copied ✓" : "copy"}</span>
            </button>
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={share}>📤 Invite</button>
            <IconBtn title="Sound" active={prefs.sound} onClick={() => { setPrefs({ sound: !prefs.sound }); sfx.click(); }}>{prefs.sound ? "🔊" : "🔇"}</IconBtn>
            <IconBtn title="Leave room" onClick={onLeave}>🚪</IconBtn>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {/* Seats */}
          <Panel title={`Franchise seats — ${owners.length}/10`} dense
            right={<span className="text-[11px] text-slate-500">{spectators.length ? `${spectators.length} watching` : "tap a free seat to switch"}</span>}>
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {TEAMS.map((t) => {
                const team = mergedTeams.find((x) => x.id === t.id);
                const owner = owners.find((p) => p.teamId === t.id);
                const isMine = me?.teamId === t.id;
                return (
                  <motion.button
                    key={t.id}
                    onClick={async () => {
                      if (owner || isMine) return;
                      sfx.click();
                      await act("room:pickTeam", { teamId: t.id });
                    }}
                    whileTap={{ scale: .98 }}
                    className={clsx(
                      "panel-flat flex items-center gap-3 p-2.5 text-left transition",
                      isMine && "border-gold-400/50 bg-gold-500/10 ring-1 ring-gold-400/30",
                      !owner && !isMine && "cursor-pointer hover:border-white/25 hover:bg-white/6",
                      owner && !isMine && "opacity-80",
                    )}
                    style={!isMine ? { borderLeft: `3px solid ${t.primary}` } : { borderLeft: `3px solid ${t.primary}`, }}
                  >
                    <TeamBadge team={t} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-white">{t.name}</span>
                        {owner?.isHost && <span className="chip !px-1.5 !py-0 !text-[8px] border-gold-400/40 bg-gold-500/15 text-gold-300">HOST</span>}
                        {isMine && <span className="chip !px-1.5 !py-0 !text-[8px] border-turf-500/40 bg-turf-500/15 text-turf-300">YOU</span>}
                      </div>
                      <div className="truncate text-[11.5px] text-slate-400">
                        {owner ? (
                          <span className={clsx(owner.connected ? "text-slate-300" : "text-slate-500 italic")}>
                            {owner.name}{owner.isBot && <span className="ml-1 text-[10px] text-violet-300">🤖 {owner.style}</span>}
                            {!owner.connected && " • offline"}
                          </span>
                        ) : <span className="text-slate-500">Empty seat</span>}
                      </div>
                    </div>
                    {team?.retentions?.length > 0 && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">purse</div>
                        <Money lakhs={team.purseLeftL} className="text-xs text-gold-300" />
                      </div>
                    )}
                    {isHost && owner?.isBot && (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 text-xs text-slate-400 hover:border-flare-500/40 hover:text-flare-300"
                        onClick={async (e) => { e.stopPropagation(); await act("room:removeBot", { participantId: owner.id }); }}>✕</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </Panel>

          {/* Host controls */}
          {isHost && (
            <Panel title="Auctioneer controls" dense>
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => act("room:addBots", { count: 1 })}>+ 1 AI owner</button>
                  <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => act("room:addBots", { count: 9 })}>Fill with AI</button>
                  <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => setSettingsOpen(true)}>⚙️ House rules</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <RuleStat label="Purse" value={`₹${settings.budgetCr} Cr`} sub={settings.retentions ? "minus retentions" : "clean slate"} />
                  <RuleStat label="Timer" value={`${settings.bidSeconds}s`} sub={`+${settings.resetSeconds}s on a bid`} />
                  <RuleStat label="Squad" value={`${settings.minSquad}–${settings.maxSquad}`} sub={settings.maxOverseas != null ? `max ${settings.maxOverseas} overseas` : "no overseas cap"} />
                </div>
                <button className="btn-gold w-full py-4 text-lg tracking-wide" onClick={onStart} disabled={owners.length < 1}>
                  🔨 Start the auction
                </button>
                <p className="text-center text-[11px] text-slate-500">
                  {owners.length} franchise{owners.length === 1 ? "" : "s"} seated • {bots.length} AI • {payload.queue?.length} names in {payload.sets?.length} sets
                </p>
              </div>
            </Panel>
          )}

          {/* Retained squads */}
          {mergedTeams.some((t) => t.retentions?.length) && (
            <Panel title="Retained squads" dense>
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {mergedTeams.filter((t) => t.retentions?.length).map((t) => (
                  <div key={t.id} className="panel-flat p-2.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TeamBadge team={t} size={26} />
                        <span className="text-xs font-bold text-white">{t.name}</span>
                      </div>
                      <Money lakhs={t.purseLeftL} className="text-[11px] text-gold-300" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.retentions.map((r) => (
                        <span key={r.playerId} className="rounded-md border border-white/8 bg-white/5 px-1.5 py-0.5 text-[10.5px] text-slate-300">
                          {r.name} <span className="text-slate-500">₹{(r.salaryL / 100).toFixed(1)}Cr</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Pool preview */}
          <Panel title="Headliners in the pool" dense
            right={
              <div className="flex items-center gap-2">
                {watch.length > 0 && <span className="chip !py-0.5 !text-[9px] border-gold-400/40 text-gold-300">★ {watch.length} targets</span>}
                <button className="chip !py-0.5 !text-[9px] hover:border-white/25 hover:text-white" onClick={() => setScoutOpen(true)}>🔎 Scout the full pool</button>
              </div>
            }>
            <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
              {marqueePreview.map((p) => (
                <div key={p.id} className="panel-flat card-sheen flex items-center gap-2.5 p-2">
                  <RatingBadge rating={p.rating} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold text-white">{p.name}</div>
                    <div className="flex items-center gap-1.5">
                      <RolePill role={p.role} />
                      <span className="text-[10px] text-slate-500">{p.overseas ? p.country : "IND"} • <Money lakhs={p.base} /></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* sidebar */}
        <div className="space-y-4">
          {!isHost && (
            <Panel className="p-4 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold-500/12 text-2xl animate-glowPulse">⏳</div>
              <h3 className="mt-3 font-display text-xl tracking-wide text-white">Waiting for the auctioneer</h3>
              <p className="mt-1 text-xs text-slate-400">
                The host starts the hammer. Share the code <b className="font-mono text-gold-300">{payload.code}</b> to fill the table.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-ghost flex-1 !py-2 text-xs" onClick={() => copy(payload.code)}>Copy code</button>
                <button className="btn-ghost flex-1 !py-2 text-xs" onClick={share}>Share link</button>
              </div>
              <button className="btn-ghost mt-2 w-full !py-2 text-xs" onClick={() => setScoutOpen(true)}>🔎 Scout the pool & pick targets</button>
            </Panel>
          )}

          <Panel title={`Table chat (${chat.length})`} dense>
            <div className="flex h-56 flex-col-reverse gap-1.5 overflow-y-auto scroll-thin p-3">
              {[...chat].reverse().map((c) => (
                <div key={c.id} className="slide-up rounded-lg bg-white/4 px-2.5 py-1.5">
                  <span className="text-[10.5px] font-bold text-gold-300">{c.from}</span>
                  <p className="text-[12.5px] leading-snug text-slate-200">{c.text}</p>
                </div>
              ))}
              {chat.length === 0 && <p className="text-center text-[11px] text-slate-500">Say hi to the table.</p>}
            </div>
            <form className="flex gap-2 border-t border-white/8 p-2.5"
              onSubmit={(e) => { e.preventDefault(); if (!chatText.trim()) return; act("chat:send", { text: chatText }); setChatText(""); }}>
              <input className="input !py-2 text-xs" placeholder="Message the table…" value={chatText} maxLength={200}
                onChange={(e) => setChatText(e.target.value)} />
              <button className="btn-primary !px-3 !py-2 text-xs" type="submit">Send</button>
            </form>
          </Panel>

          <Panel title="Auction checklist" dense>
            <ul className="space-y-1.5 p-3 text-[12px] text-slate-300">
              {[
                [`Pick your franchise seat`, me?.teamId],
                [`Share the room code`, true],
                [`Host: tune house rules`, isHost],
                [`Host: add AI owners if seats are empty`, isHost && bots.length > 0],
                [`Host: start the auction`, isHost],
              ].map(([label, done]) => (
                <li key={label} className="flex items-center gap-2">
                  <span className={clsx("grid h-4 w-4 place-items-center rounded-full text-[9px]", done ? "bg-turf-500/20 text-turf-300" : "bg-white/8 text-slate-500")}>{done ? "✓" : "•"}</span>
                  <span className={done ? "text-slate-400 line-through" : ""}>{label}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {/* sticky start bar for host on mobile */}
      {isHost && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night-950/90 p-3 backdrop-blur-xl sm:hidden" style={{ paddingBottom: "calc(12px + var(--safe-b))" }}>
          <button className="btn-gold w-full py-3.5" onClick={onStart}>🔨 Start auction</button>
        </div>
      )}

      <HouseRulesModal open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} sport={payload.sport} />
      <ScoutingModal
        open={scoutOpen} onClose={() => setScoutOpen(false)}
        players={payload.players || []} queue={payload.queue || []}
        watch={watch} onToggleWatch={(id) => setWatch(toggleWatch(payload?.code, id))}
        sport={payload.sport}
        soldIds={(payload.teams || []).flatMap((t) => (t.retentions || []).map((r) => r.playerId))}
        soldBy={{}}
      />
    </div>
  );
}

function RuleStat({ label, value, sub }) {
  return (
    <div className="panel-flat px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">{label}</div>
      <div className="font-display text-xl text-white">{value}</div>
      <div className="text-[10.5px] text-slate-400">{sub}</div>
    </div>
  );
}

export function HouseRulesModal({ open, onClose, settings, sport }) {
  const { act, notify } = useStore();
  const [local, setLocal] = useState(settings);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setLocal(settings); }, [open, settings]);

  const save = async () => {
    setBusy(true);
    const res = await act("room:settings", { settings: local });
    setBusy(false);
    if (res?.ok) { notify("House rules updated", "info"); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="House rules" wide
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-gold" onClick={save} disabled={busy}>{busy ? <Spinner label="Saving" /> : "Apply rules"}</button>
      </>}>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <Slider label="Purse per team" value={local.budgetCr} min={40} max={300} step={5} onChange={(v) => setLocal({ ...local, budgetCr: v })} format={(v) => `₹${v} Cr`} hint={local.retentions ? "Retained salaries are deducted from this." : "Full purse for everyone."} />
        <Slider label="Bid timer" value={local.bidSeconds} min={5} max={60} onChange={(v) => setLocal({ ...local, bidSeconds: v })} format={(v) => `${v}s`} />
        <Slider label="Reset on bid" value={local.resetSeconds} min={3} max={30} onChange={(v) => setLocal({ ...local, resetSeconds: v })} format={(v) => `+${v}s`} />
        <Slider label="Intro time" value={local.introSeconds} min={0} max={10} onChange={(v) => setLocal({ ...local, introSeconds: v })} format={(v) => `${v}s`} hint="Pause before bidding opens." />
        <Slider label="Delay before next name" value={local.nextDelaySeconds} min={1} max={15} onChange={(v) => setLocal({ ...local, nextDelaySeconds: v })} format={(v) => `${v}s`} />
        <Slider label="Min squad" value={local.minSquad} min={1} max={30} onChange={(v) => setLocal({ ...local, minSquad: v })} />
        <Slider label="Max squad" value={local.maxSquad} min={2} max={40} onChange={(v) => setLocal({ ...local, maxSquad: v })} />
        {sport === "cricket" && <Slider label="Max overseas" value={local.maxOverseas ?? 8} min={0} max={12} onChange={(v) => setLocal({ ...local, maxOverseas: v })} />}
        <Slider label="RTM cards per team" value={local.rtmCards} min={0} max={5} onChange={(v) => setLocal({ ...local, rtmCards: v })} />
        <Slider label="RTM window" value={local.rtmWindowSeconds} min={3} max={25} onChange={(v) => setLocal({ ...local, rtmWindowSeconds: v })} format={(v) => `${v}s`} />
        <div className="sm:col-span-2 mt-1">
          <Toggle label="Auto-advance to the next name" checked={!!local.autoNext} onChange={(v) => setLocal({ ...local, autoNext: v })} />
          <Toggle label="Retained squads (mock mode)" checked={!!local.retentions} onChange={(v) => setLocal({ ...local, retentions: v })} hint={sport === "football" ? "Cricket-only" : "Applied when the auction starts."} />
          <Toggle label="Public room (listed in Browse)" checked={!!local.public} onChange={(v) => setLocal({ ...local, public: v })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">AI owner difficulty</label>
          <div className="grid grid-cols-3 gap-2">
            {["easy", "normal", "insane"].map((d) => (
              <button key={d} onClick={() => setLocal({ ...local, bots: { ...local.bots, difficulty: d } })}
                className={clsx("rounded-xl border px-3 py-2 text-xs font-bold capitalize transition",
                  local.bots?.difficulty === d ? "border-violet-400/50 bg-violet-500/12 text-violet-200" : "border-white/10 bg-white/4 text-slate-300 hover:bg-white/8")}>
                {d === "easy" ? "🌱 easy" : d === "normal" ? "⚖️ normal" : "🔥 insane"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 rounded-lg border border-white/8 bg-white/3 p-2.5 text-[11px] text-slate-400">
        Rule changes re-prepare the pool while the table is still in the lobby — purses, retentions and the queue are rebuilt instantly.
      </p>
    </Modal>
  );
}
