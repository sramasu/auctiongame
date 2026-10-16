import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getSocket, emit, loadSession, saveSession, loadPrefs, savePrefs } from "./lib/socket.js";
import { setSoundEnabled } from "./lib/sound.js";

const StoreCtx = createContext(null);

const defaultPrefs = { sound: true, reactions: true, reducedMotion: false, lastSport: "cricket", lastMode: "mock", lastName: "" };

export function StoreProvider({ children }) {
  const [conn, setConn] = useState("connecting");
  const [payload, setPayload] = useState(null);
  const [live, setLive] = useState(null);
  const [session, setSession] = useState(() => loadSession());
  const [prefs, setPrefsState] = useState(() => ({ ...defaultPrefs, ...loadPrefs() }));
  const [toast, setToast] = useState(null);
  const [event, setEvent] = useState(null); // last transient effect event
  const [bidPulse, setBidPulse] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const eventId = useRef(1);

  const socketRef = useRef(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const fire = useCallback((type, data = {}) => {
    setEvent({ id: eventId.current++, type, at: Date.now(), ...data });
  }, []);

  const notify = useCallback((message, kind = "info", ttl = 3200) => {
    setToast({ id: Date.now() + Math.random(), message, kind });
    if (ttl) setTimeout(() => setToast((t) => (t && Date.now() - t.id > ttl - 200 ? null : t)), ttl);
  }, []);

  const setPrefs = useCallback((patch) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      savePrefs(next);
      if (patch.sound !== undefined) setSoundEnabled(next.sound);
      return next;
    });
  }, []);

  useEffect(() => setSoundEnabled(prefs.sound), [prefs.sound]);

  const refreshPayload = useCallback(async () => {
    const res = await emit("room:state", {});
    if (res?.ok && res.payload) setPayload(res.payload);
  }, []);

  // ── socket wiring ────────────────────────────────────────────────────────
  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => {
      setConn("online");
      const sess = sessionRef.current;
      if (sess?.code && sess?.participantId) {
        setRestoring(true);
        emit("room:rejoin", { code: sess.code, participantId: sess.participantId, token: sess.token }).then((res) => {
          setRestoring(false);
          if (res.ok) {
            setPayload(res.payload);
            setSession({ code: res.code, participantId: res.participantId, token: res.token });
            saveSession({ code: res.code, participantId: res.participantId, token: res.token });
          }
        });
      }
    };
    const onDisconnect = (reason) => {
      setConn(reason === "io client disconnect" ? "offline" : "reconnecting");
    };
    const onConnectError = () => setConn("offline");

    const onState = (st) => setLive(st);
    const onFeed = (item) => fire("feed", item);
    const onChat = (item) => fire("chat", item);
    const onReaction = (item) => fire("reaction", item);
    const onBid = (data) => { setBidPulse((n) => n + 1); fire("bid", data); };
    const onSold = (data) => fire("sold", data);
    const onUnsold = (data) => fire("unsold", data);
    const onRtm = (data) => fire("rtm", data);
    const onPhase = (data) => fire("phase", data);
    const onPlayer = (data) => fire("player", data);
    const onResults = (data) => {
      setPayload((p) => (p ? { ...p, results: data, status: "done" } : p));
      setLive((l) => (l ? { ...l, status: "done", current: null } : l));
      fire("results", data);
    };
    const onAuctionStart = () => {
      setPayload((p) => (p ? { ...p, status: "live", results: null } : p));
      setLive((l) => (l ? { ...l, status: "live", results: null } : l));
      refreshPayload();
    };
    const onAccelerated = (data) => { fire("accelerated", data); refreshPayload(); };
    const onPass = (data) => fire("pass", data);
    const onSettings = (data) => setPayload((p) => (p ? { ...p, settings: data.settings } : p));
    const onParticipants = (data) => setPayload((p) => (p ? { ...p, participants: data.participants } : p));
    const onTeams = (data) =>
      setPayload((p) => (p ? { ...p, teams: p.teams.map((t) => data.teams.find((x) => x.id === t.id) ? { ...t, ...data.teams.find((x) => x.id === t.id) } : t) } : p));
    const onKicked = (data) => {
      setSession(null); saveSession(null); setPayload(null); setLive(null);
      notify(data?.reason || "You left the table", "warn");
      fire("kicked", data || {});
    };
    const onUndo = (data) => fire("undo", data);
    const onFull = (data) => setPayload(data);

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.on("state", onState);
    s.on("feed", onFeed);
    s.on("chat", onChat);
    s.on("reaction", onReaction);
    s.on("bid", onBid);
    s.on("sold", onSold);
    s.on("unsold", onUnsold);
    s.on("rtm", onRtm);
    s.on("phase", onPhase);
    s.on("player", onPlayer);
    s.on("results", onResults);
    s.on("pass", onPass);
    s.on("settings", onSettings);
    s.on("participants", onParticipants);
    s.on("teams", onTeams);
    s.on("kicked", onKicked);
    s.on("undo", onUndo);
    s.on("accelerated", onAccelerated);
    s.on("auction-start", onAuctionStart);
    s.on("room:full", onFull);

    if (s.connected) onConnect();

    return () => {
      s.off("connect", onConnect); s.off("disconnect", onDisconnect); s.off("connect_error", onConnectError);
      s.off("state", onState); s.off("feed", onFeed); s.off("chat", onChat); s.off("reaction", onReaction);
      s.off("bid", onBid); s.off("sold", onSold); s.off("unsold", onUnsold); s.off("rtm", onRtm);
      s.off("phase", onPhase); s.off("player", onPlayer); s.off("results", onResults); s.off("pass", onPass);
      s.off("settings", onSettings); s.off("participants", onParticipants); s.off("teams", onTeams);
      s.off("kicked", onKicked); s.off("undo", onUndo); s.off("accelerated", onAccel); s.off("room:full", onFull);
    };
  }, [fire, notify, refreshPayload]);

  // ── actions ──────────────────────────────────────────────────────────────
  // Returns the raw server response so callers can branch on res.ok.
  const enterRoom = useCallback((res) => {
    if (!res?.ok) {
      notify(res?.error || "Something went wrong", "error");
      return { ok: false, error: res?.error || "Something went wrong" };
    }
    setPayload(res.payload);
    setLive(null);
    const sess = { code: res.code, participantId: res.participantId, token: res.token };
    setSession(sess);
    saveSession(sess);
    return res;
  }, [notify]);

  const createRoom = useCallback(async (opts) => enterRoom(await emit("room:create", opts)), [enterRoom]);
  const joinRoom = useCallback(async (opts) => enterRoom(await emit("room:join", opts)), [enterRoom]);
  const rejoin = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess) return { ok: false, error: "No saved seat" };
    const res = await emit("room:rejoin", { code: sess.code, participantId: sess.participantId, token: sess.token });
    if (!res?.ok) { setSession(null); saveSession(null); }
    return enterRoom(res);
  }, [enterRoom]);

  const leaveRoom = useCallback(async () => {
    await emit("room:leave", {});
    setSession(null); saveSession(null); setPayload(null); setLive(null);
  }, []);

  const refreshRooms = useCallback(async () => {
    const res = await emit("room:list", {});
    if (res?.ok) setRooms(res.rooms || []);
    return res;
  }, []);

  const act = useCallback(async (event, data) => {
    const res = await emit(event, data || {});
    if (res && res.ok === false) notify(res.error || "Action failed", "error");
    return res;
  }, [notify]);

  // ── derived data ─────────────────────────────────────────────────────────
  const playersById = useMemo(() => {
    const m = new Map();
    for (const p of payload?.players || []) m.set(p.id, p);
    return m;
  }, [payload?.players]);

  const me = useMemo(() => {
    if (!payload || !session) return null;
    return payload.participants.find((p) => p.id === session.participantId) || null;
  }, [payload, session]);

  const myTeam = useMemo(() => {
    if (!payload || !me?.teamId) return null;
    return payload.teams.find((t) => t.id === me.teamId) || null;
  }, [payload, me]);

  const liveTeams = useMemo(() => live?.teams || {}, [live?.teams]);
  const isHost = useMemo(() => !!payload && !!me && payload.hostId === me.id, [payload, me]);
  const current = live?.current || payload?.current || null;
  const currentPlayer = current?.playerId ? playersById.get(current.playerId) || null : null;

  const mergedTeams = useMemo(() => {
    if (!payload) return [];
    return payload.teams.map((t) => ({ ...t, ...(liveTeams[t.id] || {}) }));
  }, [payload, liveTeams]);

  const value = {
    conn, payload, live, session, prefs, toast, event, bidPulse, rooms, restoring,
    playersById, me, myTeam, mergedTeams, isHost, current, currentPlayer,
    setPrefs, notify, fire, createRoom, joinRoom, rejoin, leaveRoom, refreshRooms, refreshPayload, act,
    socket: socketRef,
    serverTime: live?.serverTime || payload?.serverTime || Date.now(),
    status: live?.status || payload?.status || "lobby",
    index: live?.index ?? payload?.index ?? 0,
    total: live?.total ?? payload?.queue?.length ?? 0,
    sold: live?.sold || payload?.sold || [],
    feed: payload?.feed || [],
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useCountdown(endsAt, serverTimeRef) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    let raf;
    const tickFn = () => {
      const now = Date.now() + (serverTimeRef?.current?.skew || 0);
      setLeft(endsAt ? Math.max(0, endsAt - now) : 0);
      raf = requestAnimationFrame(tickFn);
    };
    raf = requestAnimationFrame(tickFn);
    return () => cancelAnimationFrame(raf);
  }, [endsAt, serverTimeRef]);
  return left;
}
