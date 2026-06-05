import { type PoolEntry } from "../hooks/usePoolEntries";
import { getStatus } from "../utils/status";
import { type FieldKey } from "../utils/constants";

interface Props {
  last: PoolEntry | undefined;
  daysSinceLast: number | null;
}

export function SwimmingReadiness({ last, daysSinceLast }: Props) {
  if (!last) return null;

  const badFields = (["cl", "ph", "temp"] as FieldKey[]).filter(
    (k) => getStatus(k, last[k] as number) !== "ok"
  );
  const isStale = daysSinceLast !== null && daysSinceLast >= 3;

  type Level = "green" | "yellow" | "red";
  let level: Level;
  if (badFields.length >= 2) level = "red";
  else if (badFields.length === 1 || isStale) level = "yellow";
  else level = "green";

  const cfg = {
    green: {
      bg: "#f0fdf4", accent: "#22c55e",
      label: "Badebereit",
      sub: "Alle Werte im grünen Bereich",
      labelColor: "#15803d",
      dot: "#22c55e",
    },
    yellow: {
      bg: "#fffbeb", accent: "#f59e0b",
      label: "Mit Vorsicht",
      sub: isStale && badFields.length === 0
        ? `Messung vor ${daysSinceLast} Tagen – bitte neu messen`
        : "1 Wert außerhalb – Korrektur empfohlen",
      labelColor: "#92400e",
      dot: "#f59e0b",
    },
    red: {
      bg: "#fef2f2", accent: "#ef4444",
      label: "Nicht empfohlen",
      sub: "Bitte Werte korrigieren vor dem Baden",
      labelColor: "#991b1b",
      dot: "#ef4444",
    },
  }[level];

  return (
    <div style={{
      background: cfg.bg,
      borderRadius: 14,
      padding: "12px 16px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 12,
      borderLeft: `4px solid ${cfg.accent}`,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: cfg.labelColor, lineHeight: 1.2 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>{cfg.sub}</div>
      </div>
    </div>
  );
}
