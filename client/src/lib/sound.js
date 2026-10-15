// Procedural sound design with the WebAudio API — no external assets needed.
let ctx = null;
let master = null;
let enabled = true;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setSoundEnabled(v) {
  enabled = !!v;
  if (master) master.gain.value = enabled ? 0.5 : 0;
}

export function isSoundEnabled() {
  return enabled;
}

export function unlockAudio() {
  ac();
}

function tone({ freq = 440, type = "sine", dur = 0.18, gain = 0.25, attack = 0.008, decay = 0.16, slide = 0, delay = 0 }) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

function noise({ dur = 0.2, gain = 0.2, filter = 1200, type = "lowpass", delay = 0, q = 1 }) {
  const c = ac();
  if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bq = c.createBiquadFilter();
  bq.type = type;
  bq.frequency.value = filter;
  bq.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bq).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  click: () => tone({ freq: 620, type: "triangle", dur: 0.06, gain: 0.12, decay: 0.05 }),
  hover: () => tone({ freq: 880, type: "sine", dur: 0.04, gain: 0.05, decay: 0.04 }),
  bid: () => {
    tone({ freq: 740, type: "square", dur: 0.07, gain: 0.11, decay: 0.07 });
    tone({ freq: 1180, type: "sine", dur: 0.12, gain: 0.14, decay: 0.12, delay: 0.03 });
  },
  myBid: () => {
    tone({ freq: 880, type: "triangle", dur: 0.09, gain: 0.2, decay: 0.09 });
    tone({ freq: 1320, type: "sine", dur: 0.16, gain: 0.16, decay: 0.16, delay: 0.05 });
    tone({ freq: 1760, type: "sine", dur: 0.2, gain: 0.1, decay: 0.2, delay: 0.1 });
  },
  outbid: () => {
    tone({ freq: 320, type: "sawtooth", dur: 0.16, gain: 0.14, decay: 0.16, slide: -90 });
    tone({ freq: 240, type: "square", dur: 0.18, gain: 0.08, decay: 0.18, delay: 0.06 });
  },
  tick: () => tone({ freq: 1500, type: "square", dur: 0.03, gain: 0.07, decay: 0.03 }),
  urgent: () => tone({ freq: 1000, type: "square", dur: 0.07, gain: 0.13, decay: 0.07 }),
  gavel: () => {
    noise({ dur: 0.28, gain: 0.4, filter: 900, type: "lowpass" });
    tone({ freq: 180, type: "sine", dur: 0.24, gain: 0.32, decay: 0.22, slide: -60 });
    tone({ freq: 96, type: "triangle", dur: 0.4, gain: 0.22, decay: 0.38, delay: 0.02 });
  },
  goingOnce: () => tone({ freq: 520, type: "triangle", dur: 0.22, gain: 0.14, decay: 0.2 }),
  sold: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.3, gain: 0.17, decay: 0.28, delay: i * 0.075 }));
    noise({ dur: 0.5, gain: 0.1, filter: 2600, type: "highpass", delay: 0.1 });
  },
  myWin: () => {
    [659, 784, 988, 1319].forEach((f, i) => tone({ freq: f, type: "square", dur: 0.34, gain: 0.15, decay: 0.3, delay: i * 0.08 }));
    tone({ freq: 130, type: "sine", dur: 0.7, gain: 0.2, decay: 0.6, delay: 0.1 });
  },
  unsold: () => {
    tone({ freq: 300, type: "sawtooth", dur: 0.3, gain: 0.14, decay: 0.3, slide: -140 });
    tone({ freq: 180, type: "sine", dur: 0.45, gain: 0.12, decay: 0.4, delay: 0.12 });
  },
  rtm: () => {
    tone({ freq: 1200, type: "square", dur: 0.09, gain: 0.16, decay: 0.09 });
    tone({ freq: 1600, type: "square", dur: 0.12, gain: 0.13, decay: 0.12, delay: 0.08 });
    tone({ freq: 800, type: "triangle", dur: 0.3, gain: 0.16, decay: 0.3, delay: 0.16 });
  },
  join: () => {
    tone({ freq: 700, type: "sine", dur: 0.12, gain: 0.12, decay: 0.12 });
    tone({ freq: 1050, type: "sine", dur: 0.16, gain: 0.1, decay: 0.16, delay: 0.08 });
  },
  chat: () => tone({ freq: 1400, type: "sine", dur: 0.05, gain: 0.06, decay: 0.05 }),
  fanfare: () => {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.34, gain: 0.18, decay: 0.3, delay: i * 0.12 }));
    noise({ dur: 1.1, gain: 0.07, filter: 3000, type: "highpass", delay: 0.2 });
  },
  error: () => tone({ freq: 200, type: "square", dur: 0.2, gain: 0.14, decay: 0.18, slide: -60 }),
};
