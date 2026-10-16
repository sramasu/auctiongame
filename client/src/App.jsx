import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StoreProvider, useStore } from "./store.jsx";
import { Effects } from "./components/Effects.jsx";
import Home from "./screens/Home.jsx";
import Lobby from "./screens/Lobby.jsx";
import Auction from "./screens/Auction.jsx";
import Results from "./screens/Results.jsx";

function Backdrop() {
  return (
    <>
      <div className="arena-bg" />
      <div className="floodlight" style={{ left: "-14vw", background: "radial-gradient(circle, rgba(245,185,41,.22), transparent 62%)" }} />
      <div className="floodlight" style={{ right: "-18vw", background: "radial-gradient(circle, rgba(56,130,246,.2), transparent 62%)" }} />
    </>
  );
}

function Shell() {
  const { payload, live, status, leaveRoom, act, notify, conn, restoring, session } = useStore();
  const [screen, setScreen] = useState("home");

  const effectiveStatus = live?.status || payload?.status;

  useEffect(() => {
    if (!payload) setScreen("home");
    else if (effectiveStatus === "done" || payload.results) setScreen("results");
    else if (effectiveStatus === "live") setScreen("auction");
    else setScreen("lobby");
  }, [payload, effectiveStatus]);

  const leave = async () => {
    await leaveRoom();
    setScreen("home");
  };

  return (
    <>
      <Backdrop />
      <Effects />
      {conn !== "online" && (
        <div className="fixed inset-x-0 bottom-0 z-[80] bg-gold-500/15 px-4 py-2 text-center text-[12px] font-semibold text-gold-200 backdrop-blur">
          {conn === "reconnecting" ? "⟳ Reconnecting to the table — your seat is being held…" : "⚠ Offline. Bids will resume once the connection returns."}
        </div>
      )}
      {restoring && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-night-950/90">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-gold-400" />
            <p className="mt-3 text-sm text-slate-400">Restoring your seat…</p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: .22 }}
        >
          {screen === "home" && <Home />}
          {screen === "lobby" && <Lobby onLeave={leave} />}
          {screen === "auction" && <Auction onLeave={leave} />}
          {screen === "results" && (
            <Results
              onLeave={leave}
              onRematch={async () => {
                const res = await act("auction:start");
                if (!res?.ok) notify(res?.error || "Could not restart", "error");
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
