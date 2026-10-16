import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import clsx from "clsx";
import { formatMoney } from "../../../shared/format.js";
import { ROLE_LABEL, ROLE_SHORT } from "../../../shared/teams.js";

export const Money = ({ lakhs, compact = false, className = "" }) => (
  <span className={clsx("tabular-nums font-semibold", className)}>{formatMoney(lakhs, { compact })}</span>
);

export const RolePill = ({ role, className = "" }) => (
  <span className={clsx(
    "rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
    role === "BAT" && "bg-sky-500/15 text-sky-300",
    role === "WK" && "bg-violet-500/15 text-violet-300",
    role === "AR" && "bg-emerald-500/15 text-emerald-300",
    role === "PACE" && "bg-orange-500/15 text-orange-300",
    role === "SPIN" && "bg-pink-500/15 text-pink-300",
    role === "GK" && "bg-yellow-500/15 text-yellow-300",
    role === "DEF" && "bg-blue-500/15 text-blue-300",
    role === "MID" && "bg-emerald-500/15 text-emerald-300",
    role === "FWD" && "bg-rose-500/15 text-rose-300",
    className,
  )}>
    {ROLE_SHORT[role] || role}
  </span>
);

export const RatingBadge = ({ rating, size = "md", className = "" }) => {
  const tone = rating >= 90 ? "from-amber-300 to-amber-500 text-night-950"
    : rating >= 84 ? "from-emerald-300 to-emerald-500 text-night-950"
    : rating >= 76 ? "from-sky-300 to-sky-500 text-night-950"
    : "from-slate-400 to-slate-600 text-white";
  return (
    <span className={clsx(
      "inline-flex items-center justify-center rounded-lg bg-gradient-to-b font-black tabular-nums shadow-lift",
      tone,
      size === "sm" ? "h-7 w-8 text-xs" : size === "lg" ? "h-14 w-16 text-2xl" : "h-9 w-11 text-base",
      className,
    )}>
      {rating}
    </span>
  );
};

export const TeamBadge = ({ team, size = 36, ring = false, className = "", full = false }) => {
  const dims = full ? undefined : { width: size, height: size, fontSize: size * 0.34 };
  if (!team) return <div className={clsx("rounded-xl bg-white/5", full ? "h-full w-full" : "")} style={dims} />;
  return (
    <div
      className={clsx("relative grid place-items-center rounded-xl font-black shadow-lift", ring && "ring-2 ring-white/30", full && "h-full w-full text-base", className)}
      style={{
        ...dims,
        background: `linear-gradient(140deg, ${team.primary}, ${team.secondary || "#0b1020"})`,
        color: team.accent || "#fff",
      }}
      title={team.name}
    >
      <span className="drop-shadow">{team.short?.slice(0, 4) || team.glyph}</span>
    </div>
  );
};

export const Panel = ({ children, className = "", title, right, dense = false }) => (
  <section className={clsx("panel", className)}>
    {(title || right) && (
      <header className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[.18em] text-slate-400">{title}</h3>
        {right}
      </header>
    )}
    <div className={dense ? "" : "p-4"}>{children}</div>
  </section>
);

export const Modal = ({ open, onClose, title, children, wide = false, footer }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={clsx("panel w-full overflow-hidden", wide ? "max-w-3xl" : "max-w-lg")}
          initial={{ scale: .92, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: .95, y: 8, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
            <h3 className="font-display text-xl tracking-wide text-white">{title}</h3>
            <button className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>
          <div className="max-h-[70vh] overflow-y-auto scroll-thin px-5 py-4">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-white/8 px-5 py-3">{footer}</footer>}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const Toggle = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
    <span>
      <span className="block text-sm font-semibold text-slate-200">{label}</span>
      {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
    </span>
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-turf-500" : "bg-white/15")}
    >
      <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  </label>
);

export const Slider = ({ label, value, min, max, step = 1, onChange, format, hint }) => (
  <div className="py-1.5">
    <div className="mb-1 flex items-baseline justify-between">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <span className="font-mono text-xs text-gold-400">{format ? format(value) : value}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-gold-500"
    />
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);

export const StatTile = ({ label, value, sub, tone = "default", icon }) => (
  <div className={clsx(
    "panel-flat px-3 py-2.5",
    tone === "gold" && "border-gold-500/30 bg-gold-500/8",
    tone === "turf" && "border-turf-500/30 bg-turf-500/8",
    tone === "flare" && "border-flare-500/30 bg-flare-500/8",
  )}>
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
      {icon && <span>{icon}</span>}{label}
    </div>
    <div className="mt-0.5 font-display text-2xl leading-none tracking-wide text-white">{value}</div>
    {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
  </div>
);

export const Meter = ({ value, max = 100, tone = "gold", className = "", height = 6 }) => (
  <div className={clsx("w-full overflow-hidden rounded-full bg-white/8", className)} style={{ height }}>
    <motion.div
      className={clsx("h-full rounded-full",
        tone === "gold" && "bg-gradient-to-r from-gold-400 to-gold-600",
        tone === "turf" && "bg-gradient-to-r from-turf-400 to-turf-600",
        tone === "blue" && "bg-gradient-to-r from-sky-400 to-blue-600",
        tone === "flare" && "bg-gradient-to-r from-flare-400 to-flare-600")}
      initial={false}
      animate={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      transition={{ type: "spring", stiffness: 180, damping: 26 }}
    />
  </div>
);

export function TimerRing({ ms, total, size = 92, urgentBelow = 5000, label }) {
  const pct = total > 0 ? Math.max(0, Math.min(1, ms / total)) : 0;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const secs = Math.ceil(ms / 1000);
  const urgent = ms > 0 && ms < urgentBelow;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="timer-ring">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.09)" strokeWidth="7" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          stroke={urgent ? "#f43f5e" : pct > .5 ? "#f5b929" : "#10b981"}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .12s linear" }}
        />
      </svg>
      <div className={clsx("absolute text-center", urgent && "heartbeat")}>
        <div className={clsx("font-display leading-none tracking-wider", urgent ? "text-flare-400" : "text-white")} style={{ fontSize: size * 0.36 }}>
          {ms > 0 ? secs : "—"}
        </div>
        {label && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[.18em] text-slate-400">{label}</div>}
      </div>
    </div>
  );
}

export function useSkew(serverTime) {
  const ref = useRef({ skew: 0 });
  useEffect(() => {
    if (serverTime) ref.current.skew = serverTime - Date.now();
  }, [serverTime]);
  return ref;
}

export const Spinner = ({ label = "Loading" }) => (
  <div className="flex items-center gap-3 text-sm text-slate-400">
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-gold-400" />
    {label}
  </div>
);

export function Tooltip({ text, children }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-white/10 bg-night-950/95 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 shadow-lift"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export const IconBtn = ({ children, onClick, title, active, tone = "ghost", className = "", disabled }) => (
  <Tooltip text={title}>
    <button
      onClick={onClick} disabled={disabled} aria-label={title}
      className={clsx(
        "grid h-9 w-9 place-items-center rounded-xl border text-sm transition active:scale-95",
        tone === "gold" ? "border-gold-500/40 bg-gold-500/12 text-gold-300 hover:bg-gold-500/20"
        : active ? "border-turf-500/40 bg-turf-500/12 text-turf-300"
        : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/12 hover:text-white",
        disabled && "pointer-events-none opacity-35",
        className,
      )}
    >
      {children}
    </button>
  </Tooltip>
);
