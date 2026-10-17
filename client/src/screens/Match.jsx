import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { getTeamsForSport } from "../../../shared/teams.js";
import {
  simulateCricketMatch,
  simulateFootballMatch,
  simulateKabaddiMatch,
  getOfficialSquad,
  buildBalancedAiTeam,
  OFFICIAL_ROSTERS,
} from "../../../shared/match.js";
import { SPORTS } from "../../../shared/constants.js";
import { Panel, TeamBadge } from "../components/ui.jsx";
import { sfx } from "../lib/sound.js";

export default function Match({ draftedTeam = null, initialSport = "cricket", onBack }) {
  const [sport, setSport] = useState(initialSport);
  const [playMode, setPlayMode] = useState(draftedTeam ? "drafted" : "official");
  const teams = useMemo(() => getTeamsForSport(sport), [sport]);

  const [homeTeamId, setHomeTeamId] = useState(draftedTeam?.id || teams[0]?.id || "mum");
  const [awayTeamId, setAwayTeamId] = useState(teams[1]?.id || "che");

  const [matchState, setMatchState] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentEventIdx, setCurrentEventIdx] = useState(0);
  const [simSpeed, setSimSpeed] = useState(1); // 1 = normal, 2 = fast, 0 = instant

  const timerRef = useRef(null);

  // When sport changes, update team choices
  useEffect(() => {
    const available = getTeamsForSport(sport);
    if (available.length >= 2) {
      if (!draftedTeam || playMode === "official") {
        setHomeTeamId(available[0].id);
        setAwayTeamId(available[1].id);
      } else {
        setAwayTeamId(available.find((t) => t.id !== draftedTeam.id)?.id || available[1].id);
      }
    }
    setMatchState(null);
    setCurrentEventIdx(0);
  }, [sport, playMode, draftedTeam]);

  const homeTeamMeta = useMemo(() => {
    if (playMode === "drafted" && draftedTeam) return draftedTeam;
    return teams.find((t) => t.id === homeTeamId) || teams[0];
  }, [playMode, draftedTeam, teams, homeTeamId]);

  const awayTeamMeta = useMemo(() => {
    return teams.find((t) => t.id === awayTeamId) || teams[1] || teams[0];
  }, [teams, awayTeamId]);

  const startSimulation = () => {
    sfx.click();
    setIsSimulating(true);
    setProgress(0);
    setCurrentEventIdx(0);

    let squadA = [];
    let squadB = [];

    if (playMode === "drafted" && draftedTeam) {
      squadA = draftedTeam.squad || [];
      squadB = buildBalancedAiTeam(sport, 85, new Set(squadA.map((p) => p.id)));
    } else {
      squadA = getOfficialSquad(sport, homeTeamId);
      squadB = getOfficialSquad(sport, awayTeamId);
    }

    const tA = { ...homeTeamMeta, squad: squadA };
    const tB = { ...awayTeamMeta, squad: squadB };

    let simResult;
    if (sport === "football") simResult = simulateFootballMatch(tA, tB);
    else if (sport === "kabaddi") simResult = simulateKabaddiMatch(tA, tB);
    else simResult = simulateCricketMatch(tA, tB);

    setMatchState(simResult);

    // Event animation
    const events = simResult.events || simResult.inn1?.timeline || [];
    const totalEvents = events.length;

    if (simSpeed === 0 || totalEvents === 0) {
      // Instant
      setCurrentEventIdx(totalEvents);
      setIsSimulating(false);
      setProgress(100);
    } else {
      let idx = 0;
      const intervalMs = Math.max(80, 450 / simSpeed);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        idx++;
        setCurrentEventIdx(idx);
        setProgress(Math.round((idx / totalEvents) * 100));
        if (idx >= totalEvents) {
          clearInterval(timerRef.current);
          setIsSimulating(false);
          sfx.gavel();
        }
      }, intervalMs);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="relative z-10 min-h-screen px-4 pb-16 pt-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
            >
              ← Back
            </button>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                🏟️ Match Arena
              </h1>
              <p className="text-xs text-slate-400">
                Play simulated matches with your drafted squad or official real-life teams against AI
              </p>
            </div>
          </div>

          {/* Sport Selector */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-night-900/80 p-1.5 backdrop-blur">
            {Object.values(SPORTS).map((sp) => (
              <button
                key={sp.id}
                onClick={() => setSport(sp.id)}
                className={clsx(
                  "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                  sport === sp.id
                    ? "bg-gold-500/20 text-gold-300 shadow-sm ring-1 ring-gold-400/50"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <span className="mr-1">{sp.icon}</span>
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Setup / Team Selector */}
        {!matchState && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => setPlayMode("official")}
                className={clsx(
                  "rounded-2xl border px-6 py-3 text-sm font-bold transition shadow-lg",
                  playMode === "official"
                    ? "border-turf-400/60 bg-turf-500/20 text-turf-200 ring-2 ring-turf-400/30"
                    : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                )}
              >
                ⭐ Official Real-Life Teams vs AI
              </button>
              {draftedTeam && (
                <button
                  onClick={() => setPlayMode("drafted")}
                  className={clsx(
                    "rounded-2xl border px-6 py-3 text-sm font-bold transition shadow-lg",
                    playMode === "drafted"
                      ? "border-gold-400/60 bg-gold-500/20 text-gold-200 ring-2 ring-gold-400/30"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  )}
                >
                  🏆 Drafted Squad ({draftedTeam.name}) vs AI
                </button>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Home Team Card */}
              <Panel className="p-6">
                <span className="chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                  {playMode === "drafted" ? "Your Drafted Team" : "Your Selected Team"}
                </span>
                <div className="mt-4 flex items-center gap-4">
                  <TeamBadge team={homeTeamMeta} className="h-16 w-16 rounded-2xl" />
                  <div>
                    <h2 className="text-xl font-bold text-white">{homeTeamMeta.name}</h2>
                    <p className="text-xs text-slate-400">{homeTeamMeta.city} • Home side</p>
                  </div>
                </div>

                {playMode === "official" && (
                  <div className="mt-5">
                    <label className="text-xs font-semibold text-slate-400">Choose franchise:</label>
                    <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {teams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setHomeTeamId(t.id)}
                          className={clsx(
                            "flex flex-col items-center rounded-xl p-2 transition",
                            homeTeamId === t.id
                              ? "bg-white/15 ring-2 ring-gold-400"
                              : "bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <TeamBadge team={t} className="h-8 w-8 rounded-lg" />
                          <span className="mt-1 text-[10px] font-bold text-slate-300">{t.short}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Panel>

              {/* Away AI Team Card */}
              <Panel className="p-6">
                <span className="chip border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
                  🤖 Opponent (AI Franchise)
                </span>
                <div className="mt-4 flex items-center gap-4">
                  <TeamBadge team={awayTeamMeta} className="h-16 w-16 rounded-2xl" />
                  <div>
                    <h2 className="text-xl font-bold text-white">{awayTeamMeta.name}</h2>
                    <p className="text-xs text-slate-400">{awayTeamMeta.city} • AI Opponent</p>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="text-xs font-semibold text-slate-400">Choose AI opponent:</label>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {teams
                      .filter((t) => t.id !== homeTeamId)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setAwayTeamId(t.id)}
                          className={clsx(
                            "flex flex-col items-center rounded-xl p-2 transition",
                            awayTeamId === t.id
                              ? "bg-white/15 ring-2 ring-indigo-400"
                              : "bg-white/5 hover:bg-white/10"
                          )}
                        >
                          <TeamBadge team={t} className="h-8 w-8 rounded-lg" />
                          <span className="mt-1 text-[10px] font-bold text-slate-300">{t.short}</span>
                        </button>
                      ))}
                  </div>
                </div>
              </Panel>
            </div>

            {/* Launch simulation */}
            <div className="flex flex-col items-center justify-center gap-3 pt-4">
              <button
                onClick={startSimulation}
                className="btn-gold px-10 py-4 text-lg font-black tracking-wide shadow-2xl transition hover:scale-105"
              >
                ⚡ START MATCH SIMULATION
              </button>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Speed:</span>
                {[
                  { label: "Normal (1x)", val: 1 },
                  { label: "Fast (2x)", val: 2 },
                  { label: "Instant", val: 0 },
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setSimSpeed(s.val)}
                    className={clsx(
                      "rounded-lg px-2.5 py-1 font-semibold transition",
                      simSpeed === s.val
                        ? "bg-white/20 text-white"
                        : "bg-white/5 text-slate-400 hover:text-white"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live Match Screen */}
        {matchState && (
          <div className="mt-8 space-y-6">
            {/* Scoreboard Banner */}
            <Panel className="relative overflow-hidden p-6 sm:p-8">
              <div className="grid items-center gap-6 sm:grid-cols-3">
                {/* Team A */}
                <div className="flex items-center gap-4 sm:flex-row-reverse sm:text-right">
                  <TeamBadge team={matchState.teamA} className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20" />
                  <div>
                    <h3 className="font-display text-xl font-black text-white sm:text-2xl">
                      {matchState.teamA.name}
                    </h3>
                    <div className="mt-1 text-2xl font-black text-gold-300 sm:text-4xl">
                      {matchState.teamA.score}
                    </div>
                    {matchState.teamA.overs && (
                      <p className="text-xs text-slate-400 font-mono">({matchState.teamA.overs} ov)</p>
                    )}
                  </div>
                </div>

                {/* VS / Margin */}
                <div className="text-center">
                  <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-bold text-slate-300">
                    {sport === "football" ? "90 MINS" : sport === "kabaddi" ? "40 MINS PKL" : "20 OVERS T20"}
                  </span>
                  <div className="mt-3 text-sm font-extrabold text-turf-300">
                    {matchState.margin || matchState.penaltyResult || "Match Concluded"}
                  </div>
                  {matchState.pom && (
                    <div className="mt-2 text-xs text-slate-400">
                      ⭐ Player of the Match: <span className="font-bold text-white">{matchState.pom}</span>
                    </div>
                  )}
                </div>

                {/* Team B */}
                <div className="flex items-center gap-4">
                  <TeamBadge team={matchState.teamB} className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20" />
                  <div>
                    <h3 className="font-display text-xl font-black text-white sm:text-2xl">
                      {matchState.teamB.name}
                    </h3>
                    <div className="mt-1 text-2xl font-black text-gold-300 sm:text-4xl">
                      {matchState.teamB.score}
                    </div>
                    {matchState.teamB.overs && (
                      <p className="text-xs text-slate-400 font-mono">({matchState.teamB.overs} ov)</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {isSimulating && (
                <div className="mt-6">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-gold-400 to-turf-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-400">Simulating live action... {progress}%</p>
                </div>
              )}
            </Panel>

            {/* Events Timeline / Commentary */}
            <div className="grid gap-6 md:grid-cols-2">
              <Panel className="p-5">
                <h4 className="flex items-center gap-2 font-display text-base font-bold text-white">
                  <span>🎙️</span> Live Match Commentary & Highlights
                </h4>
                <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-2 text-xs">
                  {sport === "cricket" ? (
                    (matchState.inn2?.timeline || matchState.inn1?.timeline || [])
                      .slice(0, currentEventIdx)
                      .reverse()
                      .map((ev, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-white/4 p-2.5">
                          <span className="font-mono font-bold text-gold-400">Over {ev.over}: </span>
                          <span className="text-slate-300">{ev.commentary}</span>
                        </div>
                      ))
                  ) : (
                    (matchState.events || [])
                      .slice(0, currentEventIdx)
                      .reverse()
                      .map((ev, i) => (
                        <div
                          key={i}
                          className={clsx(
                            "rounded-xl border p-2.5 transition",
                            ev.type === "goal" || ev.type === "super-raid"
                              ? "border-turf-500/40 bg-turf-500/10 text-turf-200"
                              : "border-white/5 bg-white/4 text-slate-300"
                          )}
                        >
                          <span className="font-mono font-bold text-slate-400">
                            {ev.minute ? `${ev.minute}' ` : `Raid ${ev.raid || i + 1}: `}
                          </span>
                          <span>{ev.text}</span>
                        </div>
                      ))
                  )}
                </div>
              </Panel>

              {/* Scorecard / Stats */}
              <Panel className="p-5">
                <h4 className="flex items-center gap-2 font-display text-base font-bold text-white">
                  <span>📊</span> Match Performance Stats
                </h4>

                {sport === "cricket" && matchState.inn1 && (
                  <div className="mt-4 space-y-4 text-xs">
                    <div>
                      <h5 className="font-bold text-gold-300">{matchState.teamA.name} Top Scorers</h5>
                      <div className="mt-1 space-y-1">
                        {matchState.inn1.batters.slice(0, 4).map((b, i) => (
                          <div key={i} className="flex justify-between border-b border-white/5 py-1 text-slate-300">
                            <span>{b.name} ({b.dismissal})</span>
                            <span className="font-mono font-bold text-white">{b.runs} ({b.balls}b, {b.fours}x4, {b.sixes}x6)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {matchState.inn2 && (
                      <div>
                        <h5 className="font-bold text-gold-300">{matchState.teamB.name} Top Scorers</h5>
                        <div className="mt-1 space-y-1">
                          {matchState.inn2.batters.slice(0, 4).map((b, i) => (
                            <div key={i} className="flex justify-between border-b border-white/5 py-1 text-slate-300">
                              <span>{b.name} ({b.dismissal})</span>
                              <span className="font-mono font-bold text-white">{b.runs} ({b.balls}b, {b.fours}x4, {b.sixes}x6)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {sport === "football" && matchState.stats && (
                  <div className="mt-4 space-y-3 text-xs">
                    {[
                      { label: "Possession", valA: `${matchState.stats.possession[0]}%`, valB: `${matchState.stats.possession[1]}%` },
                      { label: "Total Shots", valA: matchState.stats.shots[0], valB: matchState.stats.shots[1] },
                      { label: "Shots on Target", valA: matchState.stats.shotsOnTarget[0], valB: matchState.stats.shotsOnTarget[1] },
                      { label: "Corners", valA: matchState.stats.corners[0], valB: matchState.stats.corners[1] },
                    ].map((st, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-white/5 py-1.5">
                        <span className="font-mono font-bold text-gold-300">{st.valA}</span>
                        <span className="text-slate-400">{st.label}</span>
                        <span className="font-mono font-bold text-indigo-300">{st.valB}</span>
                      </div>
                    ))}
                  </div>
                )}

                {sport === "kabaddi" && (
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between border-b border-white/5 py-1.5">
                      <span className="text-slate-400">Total Points</span>
                      <span className="font-mono font-bold text-white">{matchState.teamA.score} - {matchState.teamB.score}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 py-1.5">
                      <span className="text-slate-400">All-Outs Inflicted</span>
                      <span className="font-mono font-bold text-white">{matchState.teamA.allOuts || 0} - {matchState.teamB.allOuts || 0}</span>
                    </div>
                  </div>
                )}
              </Panel>
            </div>

            {/* Play Again button */}
            <div className="flex justify-center gap-3 pt-4">
              <button
                onClick={() => setMatchState(null)}
                className="btn-gold px-8 py-3 text-sm font-bold shadow-lg"
              >
                🔄 Play Another Match
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
