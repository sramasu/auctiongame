import React, { useMemo, useState } from "react";
import clsx from "clsx";
import { Modal, RatingBadge, RolePill, Money, Meter } from "./ui.jsx";
import { ROLE_LABEL, COUNTRY_FLAG } from "../../../shared/teams.js";
import { TIER_ORDER, TIER_LABEL, ROLE_SET_ORDER, ROLE_SET_NAME } from "../../../shared/constants.js";
import { sfx } from "../lib/sound.js";

/**
 * Scouting board: search the whole pool, filter it, and mark targets.
 * Works in the lobby (planning) and mid-auction (re-planning).
 */
export default function ScoutingModal({ open, onClose, players, queue, watch, onToggleWatch, sport, soldIds = [], soldBy = {} }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [tier, setTier] = useState("ALL");
  const [geo, setGeo] = useState("ALL");
  const [onlyTargets, setOnlyTargets] = useState(false);
  const [sort, setSort] = useState("queue");

  const position = useMemo(() => {
    const m = new Map();
    queue.forEach((id, i) => m.set(id, i));
    return m;
  }, [queue]);

  const countries = useMemo(() => {
    const set = new Map();
    players.forEach((p) => set.set(p.country, (set.get(p.country) || 0) + 1));
    return [...set.entries()].sort((a, b) => b[1] - a[1]);
  }, [players]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = players.filter((p) => {
      if (needle && !p.name.toLowerCase().includes(needle) && !(p.style || "").toLowerCase().includes(needle)) return false;
      if (role !== "ALL" && p.role !== role) return false;
      if (tier !== "ALL" && p.tier !== tier) return false;
      if (geo !== "ALL") {
        if (geo === "OS" && !p.overseas) return false;
        if (geo === "DOM" && p.overseas) return false;
        if (geo !== "OS" && geo !== "DOM" && p.country !== geo) return false;
      }
      if (onlyTargets && !watch.includes(p.id)) return false;
      return true;
    });
    if (sort === "queue") list = list.sort((a, b) => (position.get(a.id) ?? 1e9) - (position.get(b.id) ?? 1e9));
    if (sort === "rating") list = list.sort((a, b) => b.rating - a.rating);
    if (sort === "base") list = list.sort((a, b) => b.base - a.base);
    if (sort === "value") list = list.sort((a, b) => estValue(b) / Math.max(1, b.base) - estValue(a) / Math.max(1, a.base));
    return list.slice(0, 400);
  }, [players, q, role, tier, geo, onlyTargets, watch, sort, position]);

  const roles = ROLE_SET_ORDER[sport] || [];

  return (
    <Modal open={open} onClose={onClose} title="Scouting board" wide
      footer={<span className="mr-auto text-[11px] text-slate-500">{rows.length} names shown • tap ★ to add a target</span>}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-auto !flex-1 !py-2 text-xs" placeholder="Search a name or skill…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input !w-auto !py-2 text-xs" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="queue">Sort: auction order</option>
          <option value="rating">Sort: rating</option>
          <option value="base">Sort: base price</option>
          <option value="value">Sort: value for money</option>
        </select>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterChip active={role === "ALL"} onClick={() => setRole("ALL")}>All roles</FilterChip>
        {roles.map((r) => (
          <FilterChip key={r} active={role === r} onClick={() => setRole(r)}>{ROLE_SET_NAME[r] || ROLE_LABEL[r]}</FilterChip>
        ))}
        <span className="mx-1 h-6 w-px self-center bg-white/10" />
        <FilterChip active={tier === "ALL"} onClick={() => setTier("ALL")}>All tiers</FilterChip>
        {TIER_ORDER.map((t) => (
          <FilterChip key={t} active={tier === t} onClick={() => setTier(t)}>{TIER_LABEL[t]}</FilterChip>
        ))}
        <span className="mx-1 h-6 w-px self-center bg-white/10" />
        <FilterChip active={geo === "ALL"} onClick={() => setGeo("ALL")}>Everyone</FilterChip>
        <FilterChip active={geo === "DOM"} onClick={() => setGeo("DOM")}>{sport === "cricket" ? "Indian" : "Domestic"}</FilterChip>
        <FilterChip active={geo === "OS"} onClick={() => setGeo("OS")}>Overseas</FilterChip>
        <select className="rounded-lg border border-white/10 bg-white/4 px-2 py-1 text-[11px] font-semibold text-slate-300"
          value={geo.startsWith("C") || geo.length === 3 ? geo : "ALL"}
          onChange={(e) => setGeo(e.target.value)}>
          <option value="ALL">Any country</option>
          {countries.map(([c, n]) => <option key={c} value={c}>{COUNTRY_FLAG[c] || ""} {c} ({n})</option>)}
        </select>
        <FilterChip active={onlyTargets} onClick={() => setOnlyTargets((v) => !v)}>★ My targets ({watch.length})</FilterChip>
      </div>

      <div className="max-h-[52vh] space-y-1 overflow-y-auto scroll-thin pr-1">
        {rows.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No names match those filters.</p>}
        {rows.map((p) => {
          const pos = position.get(p.id);
          const sold = soldIds.includes(p.id);
          const starred = watch.includes(p.id);
          return (
            <div key={p.id} className={clsx("flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5",
              sold ? "border-white/5 bg-white/2 opacity-55" : starred ? "border-gold-400/40 bg-gold-500/8" : "border-white/6 bg-white/3 hover:border-white/14")}>
              <button
                onClick={() => { onToggleWatch(p.id); sfx.hover(); }}
                className={clsx("grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-sm transition",
                  starred ? "border-gold-400/50 bg-gold-500/15 text-gold-300" : "border-white/10 bg-white/4 text-slate-500 hover:text-gold-300")}
                title={starred ? "Remove target" : "Add target"}
              >
                {starred ? "★" : "☆"}
              </button>
              <RatingBadge rating={p.rating} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-bold text-white">{p.name}</span>
                  {sold && <span className="chip !px-1.5 !py-0 !text-[8px] border-turf-500/30 text-turf-300">SOLD {soldBy[p.id]?.short || ""}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                  <RolePill role={p.role} />
                  <span>{COUNTRY_FLAG[p.country]} {p.country}</span>
                  <span>•</span><span>{p.tier}</span>
                  {pos != null && !sold && <><span>•</span><span className="text-slate-400">#{pos + 1} in queue</span></>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[11.5px] font-bold text-slate-200"><Money lakhs={p.base} compact /></div>
                <div className="text-[10px] text-slate-500">est. <Money lakhs={estValue(p)} compact /></div>
              </div>
              <div className="hidden w-16 shrink-0 sm:block">
                <Meter value={p.rating} tone={p.rating >= 88 ? "gold" : p.rating >= 78 ? "turf" : "blue"} height={4} />
                <div className="mt-0.5 text-center text-[9px] uppercase tracking-wider text-slate-500">{p.rating}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function estValue(p) {
  const quality = Math.min(1, Math.max(0, (p.rating - 58) / 38));
  return Math.round((p.base * (0.9 + quality * 5.5)) / 5) * 5;
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={() => { onClick(); sfx.hover(); }}
      className={clsx("rounded-lg border px-2.5 py-1 text-[11px] font-bold transition",
        active ? "border-gold-400/50 bg-gold-500/14 text-gold-200" : "border-white/10 bg-white/4 text-slate-400 hover:bg-white/8 hover:text-slate-200")}>
      {children}
    </button>
  );
}

export function ShortcutsModal({ open, onClose, shortcuts }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard shortcuts"
      footer={<button className="btn-gold" onClick={onClose}>Got it</button>}>
      <ul className="space-y-1.5">
        {shortcuts.map((s) => (
          <li key={s.action} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-white/3 px-3 py-2">
            <span className="text-[12.5px] text-slate-300">{s.action}</span>
            <span className="flex gap-1">
              {s.keys.map((k) => (
                <kbd key={k} className="rounded-md border border-white/15 bg-night-950 px-2 py-0.5 font-mono text-[11px] text-gold-300">{k}</kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-slate-500">Shortcuts work anywhere on the auction screen except inside text fields.</p>
    </Modal>
  );
}
