/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        night: { 950: "#05070f", 900: "#080b16", 850: "#0c1120", 800: "#111728", 700: "#1a2237", 600: "#26304a" },
        gold: { 300: "#ffe9a8", 400: "#ffd76a", 500: "#f5b929", 600: "#d99a12" },
        turf: { 400: "#34d399", 500: "#10b981", 600: "#059669" },
        flare: { 400: "#fb7185", 500: "#f43f5e", 600: "#e11d48" },
      },
      opacity: {
        3: "0.03", 4: "0.04", 6: "0.06", 8: "0.08", 12: "0.12", 14: "0.14",
        16: "0.16", 18: "0.18", 22: "0.22", 28: "0.28", 32: "0.32", 45: "0.45",
      },
      fontFamily: {
        display: ['"Bebas Neue"', '"Outfit"', "system-ui", "sans-serif"],
        sans: ['"Outfit"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,185,41,.35), 0 8px 40px -8px rgba(245,185,41,.45)",
        panel: "0 24px 60px -30px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.05)",
        lift: "0 18px 40px -22px rgba(0,0,0,.95)",
      },
      keyframes: {
        floatUp: { "0%": { transform: "translateY(0) scale(.7)", opacity: "0" }, "15%": { opacity: "1" }, "100%": { transform: "translateY(-70vh) scale(1.5)", opacity: "0" } },
        popIn: { "0%": { transform: "scale(.6)", opacity: "0" }, "60%": { transform: "scale(1.06)" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        ring: { "0%": { boxShadow: "0 0 0 0 rgba(245,185,41,.5)" }, "100%": { boxShadow: "0 0 0 22px rgba(245,185,41,0)" } },
        ticker: { "0%": { transform: "translateX(0)" }, "100%": { transform: "translateX(-50%)" } },
        slam: { "0%": { transform: "rotate(-42deg) translateY(-30px)", opacity: "0" }, "55%": { transform: "rotate(6deg) translateY(4px)", opacity: "1" }, "100%": { transform: "rotate(0deg) translateY(0)" } },
        glowPulse: { "0%,100%": { opacity: ".55" }, "50%": { opacity: "1" } },
      },
      animation: {
        floatUp: "floatUp 2.6s ease-out forwards",
        popIn: "popIn .35s cubic-bezier(.2,1.4,.4,1) both",
        shimmer: "shimmer 2.6s linear infinite",
        ring: "ring 1.4s ease-out infinite",
        ticker: "ticker 28s linear infinite",
        slam: "slam .45s cubic-bezier(.2,1.3,.4,1) both",
        glowPulse: "glowPulse 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
