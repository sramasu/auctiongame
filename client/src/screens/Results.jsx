import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useStore } from "../store.jsx";
import { Panel, TeamBadge, Money, RatingBadge, RolePill, Meter } from "../components/ui.jsx";
import { GRADE_COLOR } from "../../../shared/evaluate.js";
import { ROLE_LABEL, COUNTRY_FLAG } from "../../../shared/teams.js";
import { MODES } from "../../../shared/constants.js";
import { sfx } from "../lib/sound.js";

export default function Results({ onLeave, onRematch }) {
  const { payload, live, me, isHost, notify } = useStore();
  const results = payload?.results || live?.results?.full || null;
  const [expanded, setExpanded] = useState(null);

  if (!results) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center p-6">
        <Panel className="max-w-md p-8 text-center">
          <div className="text-4xl">🔨</div>
          <h2 className="mt-3 font-display text-3xl tracking-wide text-white">Closing the book…</h2>
          <p className="mt-2 text-sm text-slate-400">Grades and awards are being calculated for every table.</p>
        </Panel>
      </div>
    );
  }

  const standings = results.standings || [];
  const awards = results.awards || {};
  const totals = results.totals || {};
  const mine = standings.find((t) => t.teamId === me?.teamId);
  const podium = standings.slice(0, 3);

  const summary = useMemo(() => buildSummary(results, payload), [results, payload]);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      notify("Auction report copied to clipboard", "info");
      sfx.click();
    } catch { notify("Copy failed", "error"); }
  };

  const download = (kind) => {
    const blob = kind === "json"
      ? new Blob([JSON.stringify(results, null, 2)], { type: "application/json" })
      : new Blob([csv(results)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auction-${payload?.code || "arena"}-${kind === "json" ? "results.json" : "signings.csv"}`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Download started", "info");
  };

  return (
    <div className="relative z-10 min-h-screen pb-16">
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-5">
        {/* header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="chip border-gold-500/40 bg-gold-500/12 text-gold-300">🏁 Auction closed • {MODES[payload?.mode]?.label}</div>
            <h1 className="mt-2 font-display text-[clamp(2.4rem,7vw,4.4rem)] leading-none tracking-wide text-white">
              {awards.champion ? <>The <span className="shimmer-text">{awards.champion.name}</span> table wins</> : "Final standings"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {totals.sold} sold • {totals.unsold} unsold • {totals.spendL ? <Money lakhs={totals.spendL} /> : "₹0"} spent •
              highest single bid {totals.highestL ? <Money lakhs={totals.highestL} /> : "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={copySummary}>📋 Copy report</button>
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => download("csv")}>⬇ Signings CSV</button>
            <button className="btn-ghost !px-3 !py-2 text-xs" onClick={() => download("json")}>⬇ JSON</button>
            {isHost && <button className="btn-turf !px-4 !py-2 text-xs" onClick={onRematch}>🔁 Run it again</button>}
            <button className="btn-primary !px-4 !py-2 text-xs" onClick={onLeave}>New table</button>
          </div>
        </div>

        {/* your card */}
        {mine && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <Panel className="overflow-hidden">
              <div className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center" style={{ background: `linear-gradient(120deg, ${mine.primary}22, transparent 60%)` }}>
                <TeamBadge team={mine} size={56} ring />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-400">Your table</div>
                  <div className="font-display text-3xl leading-none tracking-wide text-white">{mine.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{mine.owner?.name}{mine.owner?.isBot ? " 🤖" : ""} • {mine.size} signings • finished #{standings.findIndex((t) => t.teamId === mine.teamId) + 1} of {standings.length}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Grade</div>
                    <div className="font-display text-5xl leading-none" style={{ color: GRADE_COLOR[mine.grade] || "#fff" }}>{mine.grade}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Strength</div>
                    <div className="font-display text-3xl leading-none text-white">{Math.round(mine.strength)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Purse left</div>
                    <div className="font-display text-xl leading-none text-gold-300"><Money lakhs={mine.purseLeftL} compact /></div>
                  </div>
                </div>
              </div>
            </Panel>
          </motion.div>
        )}

        {/* podium */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {podium.map((t, i) => (
            <motion.div key={t.teamId} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 + i * .08 }}>
              <Panel className={clsx("p-4 text-center", i === 0 && "ring-1 ring-gold-400/40 shadow-glow")}>
                <div className="text-2xl">{["🥇", "🥈", "🥉"][i]}</div>
                <div className="mx-auto mt-1 w-fit"><TeamBadge team={t} size={44} /></div>
                <div className="mt-2 font-display text-2xl tracking-wide text-white">{t.name}</div>
                <div className="text-[11px] text-slate-400">{t.owner?.name}{t.owner?.isBot ? " 🤖" : ""}</div>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="font-display text-3xl" style={{ color: GRADE_COLOR[t.grade] || "#fff" }}>{t.grade}</span>
                  <div className="text-left text-[11px] text-slate-400">
                    <div>Strength <b className="text-white">{Math.round(t.strength)}</b></div>
                    <div>XI avg <b className="text-white">{t.xiRating?.toFixed?.(1) || Math.round(t.xi?.reduce((a, p) => a + p.rating, 0) / Math.max(1, t.xi?.length || 1) * 10) / 10}</b></div>
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>

        {/* awards */}
        <h2 className="mt-8 font-display text-3xl tracking-wide text-white">Awards</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Award icon="💸" title="Biggest splash" value={awards.biggestSplash ? <Money lakhs={awards.biggestSplash.amountL} /> : "—"}
            sub={awards.biggestSplash ? `${awards.biggestSplash.playerName} → ${standings.find((t) => t.teamId === awards.biggestSplash.teamId)?.name || ""}` : ""} />
          <Award icon="🎯" title="Steal of the auction" value={awards.steal ? <Money lakhs={awards.steal.amountL} /> : "—"}
            sub={awards.steal ? `${awards.steal.playerName} → ${awards.steal.teamName} (worth ~${awards.steal.fair ? <Money lakhs={Math.round(awards.steal.fair)} /> : "?"})` : ""} />
          <Award icon="🧮" title="Best value" value={awards.valueKing?.name || "—"} sub={awards.valueKing ? `Strength per crore spent: ${awards.valueKing.value}` : ""} />
          <Award icon="🏃" title="Most active paddle" value={awards.mostActive?.name || "—"} sub={awards.mostActive ? `${awards.mostActive.count} signings` : ""} />
          <Award icon="🏦" title="Purse master" value={awards.purseMaster?.name || "—"} sub={awards.purseMaster ? `${<Money lakhs={awards.purseMaster.purseLeftL} />} left with a full squad` : ""} />
          <Award icon="🃏" title="RTM cards used" value={standings.reduce((a, t) => a + (t.rtmUsed || 0), 0)} sub="Right-To-Match steals across the table" />
        </div>

        {/* standings */}
        <h2 className="mt-8 font-display text-3xl tracking-wide text-white">Final standings</h2>
        <Panel dense className="mt-3 overflow-hidden">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="border-b border-white/8 bg-white/3 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Franchise</th>
                  <th className="px-3 py-2">Grade</th>
                  <th className="px-3 py-2">Strength</th>
                  <th className="px-3 py-2">Squad</th>
                  <th className="px-3 py-2">Spent</th>
                  <th className="px-3 py-2">Purse left</th>
                  <th className="px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {standings.map((t, i) => (
                  <tr key={t.teamId} className={clsx("transition hover:bg-white/4", t.teamId === me?.teamId && "bg-white/5")}>
                    <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2">
                      <button className="flex items-center gap-2" onClick={() => setExpanded(expanded === t.teamId ? null : t.teamId)}>
                        <TeamBadge team={t} size={26} />
                        <span className="font-bold text-white">{t.name}</span>
                        <span className="text-[10.5px] text-slate-500">{t.owner?.name}{t.owner?.isBot ? " 🤖" : ""}</span>
                        <span className="text-[10px] text-slate-600">{expanded === t.teamId ? "▲" : "▼"}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2"><span className="font-display text-lg" style={{ color: GRADE_COLOR[t.grade] || "#fff" }}>{t.grade}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 font-mono text-white">{Math.round(t.strength)}</span>
                        <Meter value={t.strength} tone={i === 0 ? "gold" : "turf"} className="w-20" height={5} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{t.size}{t.overseas != null ? ` (${t.overseas} OS)` : ""}</td>
                    <td className="px-3 py-2 font-mono text-gold-300"><Money lakhs={t.spentL + t.retentionL} compact /></td>
                    <td className="px-3 py-2 font-mono text-slate-300"><Money lakhs={t.purseLeftL} compact /></td>
                    <td className="px-3 py-2 font-mono text-slate-400">{t.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expanded && <SquadSheet team={standings.find((t) => t.teamId === expanded)} />}
        </Panel>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Strength blends a best-XI engine, role balance, bench depth and purse efficiency. Grades are relative to the whole table.
        </p>
      </div>
    </div>
  );
}

function SquadSheet({ team }) {
  if (!team) return null;
  const xiIds = new Set((team.xi || []).map((p) => p.id));
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="border-t border-white/8 bg-night-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TeamBadge team={team} size={30} />
          <span className="font-display text-xl tracking-wide text-white">{team.name} squad sheet</span>
        </div>
        <div className="flex gap-3 text-[11px] text-slate-400">
          <span>Balance <b className="text-white">{Math.round((team.balance || 0) * 100)}%</b></span>
          <span>Purchases <b className="text-white">{team.purchases?.length || 0}</b></span>
          <span>RTM used <b className="text-white">{team.rtmUsed || 0}</b></span>
        </div>
      </div>
      <div className="mb-3">
        <div className="label">Best XI</div>
        <div className="flex flex-wrap gap-1.5">
          {(team.xi || []).map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-lg border border-turf-500/25 bg-turf-500/8 px-2 py-1 text-[11px] font-semibold text-turf-100">
              {COUNTRY_FLAG[p.country]} {p.name} <b className="text-white">{p.rating}</b>
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {(team.squad || []).slice().sort((a, b) => b.rating - a.rating).map((p) => (
          <div key={p.id} className={clsx("flex items-center gap-2 rounded-lg border px-2 py-1.5", xiIds.has(p.id) ? "border-turf-500/20 bg-turf-500/5" : "border-white/6 bg-white/3")}>
            <RatingBadge rating={p.rating} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold text-white">{p.name}</div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500"><RolePill role={p.role} />{COUNTRY_FLAG[p.country]} {p.country}</div>
            </div>
            {xiIds.has(p.id) && <span className="text-[9px] font-black uppercase tracking-wider text-turf-400">XI</span>}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Award({ icon, title, value, sub }) {
  return (
    <Panel className="card-sheen p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-gold-400/20 to-transparent text-lg">{icon}</span>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{title}</div>
          <div className="truncate font-display text-xl leading-tight text-white">{value}</div>
          {sub && <div className="truncate text-[11px] text-slate-400">{sub}</div>}
        </div>
      </div>
    </Panel>
  );
}

function buildSummary(results, payload) {
  const lines = [];
  lines.push(`AUCTION ARENA — ${payload?.code || ""} (${MODES[payload?.mode]?.label || ""})`);
  lines.push(`${results.totals.sold} sold • ${results.totals.unsold} unsold • total spend ${money(results.totals.spendL)}`);
  lines.push("");
  results.standings.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.name} — grade ${t.grade}, strength ${Math.round(t.strength)}, squad ${t.size}, spent ${money(t.spentL + t.retentionL)}, purse left ${money(t.purseLeftL)}`);
  });
  if (results.awards.biggestSplash) lines.push("", `Biggest splash: ${results.awards.biggestSplash.playerName} for ${money(results.awards.biggestSplash.amountL)}`);
  if (results.awards.steal) lines.push(`Steal of the auction: ${results.awards.steal.playerName} for ${money(results.awards.steal.amountL)}`);
  return lines.join("\n");
}

function money(l) {
  if (!l) return "₹0";
  return l >= 100 ? `₹${(l / 100).toFixed(2)} Cr` : `₹${l} L`;
}

function csv(results) {
  const rows = [["player", "team", "amount_lakhs", "amount_cr", "base_lakhs", "rating", "role", "country", "bids", "rtm"]];
  results.standings.forEach((t) => {
    (t.purchases || []).forEach((p) => {
      rows.push([p.name, t.name, p.amountL, (p.amountL / 100).toFixed(2), p.base, p.rating, p.role, p.country, p.bidCount, p.rtm ? "yes" : "no"]);
    });
  });
  return rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}
