export function formatMoney(lakhs, opts = {}) {
  const { symbol = "₹", compact = false } = opts;
  if (lakhs == null || Number.isNaN(lakhs)) return "—";
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    const s = compact && cr >= 10 ? cr.toFixed(0) : cr.toFixed(2).replace(/\.?0+$/, "");
    return `${symbol}${s} Cr`;
  }
  return `${symbol}${lakhs} L`;
}

export function shortMoney(lakhs) {
  if (lakhs == null) return "—";
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(lakhs % 100 === 0 ? 0 : 2)} Cr`;
  return `₹${lakhs} L`;
}

export function pickOne(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}
