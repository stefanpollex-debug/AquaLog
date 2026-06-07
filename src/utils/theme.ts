/** AquaLog Design-System — zentrale Design-Tokens */

export const COLORS = {
  primary:      "#0369a1",
  primaryDark:  "#075985",
  primaryLight: "#0ea5e9",

  surface:    "#ffffff",
  background: "#f1f5f9",

  text:      "#1e293b",
  textSub:   "#475569",
  textMuted: "#64748b",
  textFaint: "#94a3b8",

  border: "#e2e8f0",

  ok:       "#22c55e",
  okBg:     "#d1fae5",
  okText:   "#065f46",

  warn:     "#f59e0b",
  warnBg:   "#fef3c7",
  warnText: "#92400e",

  danger:     "#ef4444",
  dangerBg:   "#fee2e2",
  dangerText: "#991b1b",

  legionella: "#7f1d1d",
} as const;

export const SHADOWS = {
  card:   "0 2px 12px rgba(3,105,161,0.065)",
  cardSm: "0 1px 6px rgba(3,105,161,0.05)",
  float:  "0 8px 32px rgba(3,105,161,0.16)",
} as const;

export const RADIUS = {
  card:  18,
  btn:   14,
  chip:  10,
  input: 10,
  pill:  99,
} as const;

export const SPACING = {
  page:  16,
  card:  16,
  gap:   12,
  gapSm: 8,
} as const;

export const GRADIENT = {
  header: "linear-gradient(135deg,#0369a1,#0284c7)",
  onboarding: "linear-gradient(160deg,#0369a1 0%,#0284c7 55%,#0ea5e9 100%)",
} as const;
