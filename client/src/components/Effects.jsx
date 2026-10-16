import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store.jsx";
import { sfx } from "../lib/sound.js";
import clsx from "clsx";

// ── Confetti burst ──────────────────────────────────────────────────────────
const COLORS = ["#f5b929", "#ffe9a8", "#10b981", "#38bdf8", "#f43f5e", "#a855f7", "#ffffff"];

function Burst({ count = 90, originY = 42, burstKey }) {
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: `${burstKey}-${i}`,
    left: Math.random() * 100,
    dx: (Math.random() - 0.5) * 46,
    rz: `${Math.round(360 + Math.random() * 900)}deg`,
    color: COLORS[i % COLORS.length],
    delay: Math.random() * 0.35,
    dur: 1.6 + Math.random() * 1.5,
    w: 5 + Math.random() * 7,
    h: 9 + Math.random() * 10,
    round: Math.random() > 0.7,
  })), [count, burstKey]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`, top: `${originY}%`, width: p.w, height: p.h,
            background: p.color, borderRadius: p.round ? "50%" : 2,
            animation: `confettiFall ${p.dur}s cubic-bezier(.25,.6,.4,1) ${p.delay}s forwards`,
            "--dx": `${p.dx}vw`, "--rz": p.rz,
          }}
        />
      ))}
    </div>
  );
}

// ── Floating emoji reactions ────────────────────────────────────────────────
function ReactionLayer() {
  const { event, prefs } = useStore();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!prefs.reactions) return;
    if (event?.type !== "reaction") return;
    const item = { key: event.id, emoji: event.emoji, from: event.from, left: 8 + Math.random() * 84, dur: 2.2 + Math.random() * 1.1 };
    setItems((prev) => [...prev.slice(-14), item]);
    const t = setTimeout(() => setItems((prev) => prev.filter((x) => x.key !== item.key)), item.dur * 1000 + 300);
    return () => clearTimeout(t);
  }, [event, prefs.reactions]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      <AnimatePresence>
        {items.map((it) => (
          <motion.div
            key={it.key}
            className="absolute bottom-6 flex flex-col items-center"
            style={{ left: `${it.left}%` }}
            initial={{ y: 0, opacity: 0, scale: .5 }}
            animate={{ y: "-58vh", opacity: [0, 1, 1, 0], scale: [0.6, 1.25, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: it.dur, ease: "easeOut" }}
          >
            <span className="text-4xl drop-shadow-[0_4px_16px_rgba(0,0,0,.6)]">{it.emoji}</span>
            {it.from && <span className="mt-1 rounded-full bg-night-950/80 px-2 py-0.5 text-[10px] font-bold text-slate-300">{it.from}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────
export function ToastHost() {
  const { toast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ y: -24, opacity: 0, scale: .96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -18, opacity: 0 }}
            className={clsx(
              "pointer-events-auto max-w-md rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-lift backdrop-blur-xl",
              toast.kind === "error" ? "border-flare-500/40 bg-flare-600/20 text-rose-100"
              : toast.kind === "warn" ? "border-gold-500/40 bg-gold-500/15 text-gold-100"
              : "border-white/12 bg-night-800/90 text-slate-100",
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sold / unsold stamp overlay ─────────────────────────────────────────────
function StampOverlay() {
  const { event, mergedTeams, playersById } = useStore();
  const [stamp, setStamp] = useState(null);

  useEffect(() => {
    if (event?.type === "sold") {
      const team = mergedTeams.find((t) => t.id === event.record?.teamId);
      setStamp({ kind: "sold", key: event.id, team, name: event.record?.name, amountL: event.record?.amountL, rtm: event.record?.rtm });
      const t = setTimeout(() => setStamp(null), 2400);
      return () => clearTimeout(t);
    }
    if (event?.type === "unsold") {
      setStamp({ kind: "unsold", key: event.id, name: event.player?.name });
      const t = setTimeout(() => setStamp(null), 2000);
      return () => clearTimeout(t);
    }
  }, [event, mergedTeams, playersById]);

  return (
    <AnimatePresence>
      {stamp && (
        <motion.div
          key={stamp.key}
          className="pointer-events-none fixed inset-0 z-[58] grid place-items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0" style={{ background: stamp.kind === "sold" ? "radial-gradient(circle at 50% 45%, rgba(245,185,41,.22), transparent 62%)" : "radial-gradient(circle at 50% 45%, rgba(100,116,139,.18), transparent 60%)" }} />
          <div className="stamp relative flex flex-col items-center px-6 text-center">
            <div
              className={clsx("rounded-2xl border-[3px] px-6 py-3 font-display tracking-[.14em]",
                stamp.kind === "sold" ? "border-gold-400 text-gold-300" : "border-slate-500 text-slate-300")}
              style={{ fontSize: "clamp(2.4rem,8vw,4.6rem)", lineHeight: 1, background: "rgba(5,7,15,.55)", backdropFilter: "blur(4px)" }}
            >
              {stamp.kind === "sold" ? "SOLD" : "UNSOLD"}
            </div>
            {stamp.kind === "sold" && (
              <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: .18 }} className="mt-3 space-y-1">
                <div className="text-lg font-bold text-white">{stamp.name}</div>
                <div className="flex items-center justify-center gap-2 text-sm">
                  {stamp.team && <span className="rounded-md px-2 py-0.5 font-black text-[11px]" style={{ background: stamp.team.primary, color: stamp.team.accent }}>{stamp.team.short}</span>}
                  <span className="font-mono text-gold-300">{stamp.amountL >= 100 ? `₹${(stamp.amountL / 100).toFixed(2)} Cr` : `₹${stamp.amountL} L`}</span>
                  {stamp.rtm && <span className="chip border-violet-400/40 bg-violet-500/15 text-violet-200">RTM</span>}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Master effects controller (sound + confetti + toasts) ───────────────────
export function Effects({ onPhase }) {
  const { event, prefs, me, mergedTeams, payload } = useStore();
  const [burst, setBurst] = useState(null);
  const lastHandled = useRef(0);
  const myTeamId = me?.teamId;

  useEffect(() => {
    if (!event || event.id === lastHandled.current) return;
    lastHandled.current = event.id;
    const on = prefs.sound;

    switch (event.type) {
      case "bid": {
        if (!on) break;
        if (event.teamId === myTeamId) sfx.myBid(); else sfx.bid();
        break;
      }
      case "sold": {
        if (on) { sfx.gavel(); setTimeout(() => (event.record?.teamId === myTeamId ? sfx.myWin() : sfx.sold()), 180); }
        setBurst({ key: event.id, big: event.record?.teamId === myTeamId || (event.record?.amountL || 0) >= 1000 });
        setTimeout(() => setBurst(null), 2600);
        break;
      }
      case "unsold": if (on) sfx.unsold(); break;
      case "rtm": if (on) sfx.rtm(); break;
      case "phase":
        if (on && event.phase === "hammer") sfx.goingOnce();
        onPhase?.(event);
        break;
      case "chat": if (on) sfx.chat(); break;
      case "results":
        if (on) sfx.fanfare();
        setBurst({ key: event.id, big: true });
        setTimeout(() => setBurst(null), 4200);
        break;
      case "feed":
        if (on && event.itemType === "system" && /joined/.test(event.text || "")) sfx.join();
        break;
      default: break;
    }
  }, [event, prefs.sound, myTeamId, onPhase]);

  return (
    <>
      {burst && <Burst count={burst.big ? 140 : 80} originY={burst.big ? 30 : 42} burstKey={burst.key} />}
      <ReactionLayer />
      <StampOverlay />
      <ToastHost />
    </>
  );
}

// ── Bid flash on the leaderboard rows ───────────────────────────────────────
export function useBidFlash() {
  const { event } = useStore();
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (event?.type === "bid") {
      setFlash(event.teamId);
      const t = setTimeout(() => setFlash(null), 700);
      return () => clearTimeout(t);
    }
  }, [event]);
  return flash;
}

// ── Urgent tick sound in the final seconds ──────────────────────────────────
export function useTickSound(msLeft, active) {
  const { prefs } = useStore();
  const last = useRef(-1);
  useEffect(() => {
    if (!active || !prefs.sound || msLeft <= 0 || msLeft > 5200) return;
    const s = Math.ceil(msLeft / 1000);
    if (s !== last.current) {
      last.current = s;
      sfx.urgent();
    }
  }, [msLeft, active, prefs.sound]);
}
