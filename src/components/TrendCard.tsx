import { type TrendResult, type TrendSeverity } from "../utils/trendAnalysis";

const COLORS: Record<TrendSeverity, { bg: string; border: string; labelColor: string; accent: string }> = {
  good:    { bg: "#f0fdf4", border: "#86efac", labelColor: "#15803d", accent: "#22c55e" },
  info:    { bg: "#eff6ff", border: "#93c5fd", labelColor: "#1d4ed8", accent: "#3b82f6" },
  warning: { bg: "#fffbeb", border: "#fcd34d", labelColor: "#92400e", accent: "#f59e0b" },
  danger:  { bg: "#fef2f2", border: "#fca5a5", labelColor: "#991b1b", accent: "#ef4444" },
};

interface Props {
  result: TrendResult;
}

export function TrendCard({ result }: Props) {
  const c = COLORS[result.severity];

  return (
    <div style={{
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      borderRadius: 14,
      padding: "14px 16px",
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Icon */}
        <div style={{ fontSize: "1.6rem", lineHeight: 1.2, flexShrink: 0 }}>{result.icon}</div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: c.labelColor, marginBottom: 4 }}>
            {result.title}
          </div>
          <div style={{ fontSize: "0.82rem", color: "#374151", lineHeight: 1.55 }}>
            {result.message}
          </div>
          {result.action && (
            <div style={{
              marginTop: 8, fontSize: "0.75rem", fontWeight: 700,
              color: c.accent, display: "flex", alignItems: "center", gap: 4,
            }}>
              <span>→</span> {result.action}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
