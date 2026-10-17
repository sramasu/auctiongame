import React, { useState } from "react";
import clsx from "clsx";

export function PlayerStatsBadge({ stats }) {
  if (!stats) return null;
  const isMock = stats.source === "mock" || stats.mock;
  const label = stats.sourceLabel || stats.source || (isMock ? "SAMPLE NUMBERS" : "LIVE STATS");
  return (
    <span
      className={clsx(
        "chip !py-0.5 !text-[9px] font-semibold tracking-wider uppercase border",
        isMock
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      )}
      title={isMock ? "Mock numbers — configure sports API keys in .env for live stats" : `Verified from ${label}`}
    >
      {isMock ? "⚠ SAMPLE NUMBERS" : `✓ ${label}`}
    </span>
  );
}

export function PlayerStatsCard({ player, stats, compact = false }) {
  if (!player && !stats) return null;
  const p = stats || player || {};
  const isCricket = (stats?.sport || player?.sport || "cricket") === "cricket";
  const num = stats?.stats || stats || {};

  return (
    <div className={clsx("rounded-lg border border-white/10 bg-night-950/70 p-3.5 backdrop-blur-sm", compact ? "text-xs" : "text-sm")}>
      <div className="flex items-center justify-between border-b border-white/8 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">{p.name || player?.name}</span>
          <PlayerStatsBadge stats={stats} />
        </div>
        {stats?.url && (
          <a
            href={stats.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-sky-400 hover:text-sky-300 underline"
          >
            Verify source ↗
          </a>
        )}
      </div>

      {/* Profile details */}
      {(stats?.dob || stats?.height || stats?.shirt || stats?.club) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400 border-b border-white/5 pb-2">
          {stats?.club && <div><span className="text-slate-500">Club/Team:</span> {stats.club}</div>}
          {stats?.dob && <div><span className="text-slate-500">Born:</span> {stats.dob}</div>}
          {stats?.height && <div><span className="text-slate-500">Height:</span> {stats.height}</div>}
          {stats?.shirt && <div><span className="text-slate-500">Shirt:</span> #{stats.shirt}</div>}
        </div>
      )}

      {/* Numeric stats grid */}
      <div className="mt-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Career Performance</div>
        {isCricket ? (
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatBox label="Matches" val={num.matches ?? num.matchesT20 ?? "--"} />
            <StatBox label="Runs" val={num.runs ?? num.runsT20 ?? "--"} />
            <StatBox label="Average" val={num.average ?? num.battingAvg ?? "--"} />
            <StatBox label="Strike Rate" val={num.strikeRate ?? num.sr ?? "--"} />
            <StatBox label="Wickets" val={num.wickets ?? num.wicketsT20 ?? "--"} />
            <StatBox label="Economy" val={num.economy ?? num.econ ?? "--"} />
            <StatBox label="100s / 50s" val={num.hundreds !== undefined ? `${num.hundreds}/${num.fifties || 0}` : "--"} />
            <StatBox label="Best" val={num.bestBowling ?? num.best ?? "--"} />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatBox label="Appearances" val={num.apps ?? num.appearances ?? "--"} />
            <StatBox label="Goals" val={num.goals ?? "--"} />
            <StatBox label="Assists" val={num.assists ?? "--"} />
            <StatBox label="Rating" val={num.rating ?? "--"} />
            <StatBox label="Minutes" val={num.minutes ?? "--"} />
            <StatBox label="Pass %" val={num.passAccuracy ?? (num.passes ? `${num.passes}%` : "--")} />
            <StatBox label="Tackles" val={num.tackles ?? "--"} />
            <StatBox label="Duels Win" val={num.duelsWon ?? (num.duels ? `${num.duels}%` : "--")} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, val }) {
  return (
    <div className="rounded bg-white/4 px-1.5 py-1">
      <div className="text-[9px] font-medium text-slate-400 truncate">{label}</div>
      <div className="font-mono text-xs font-bold text-white truncate">{val}</div>
    </div>
  );
}
