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
    (k) => getStatus(k, last[k]) !== "ok"
  );
  const isStale = daysSinceLast !== null && daysSinceLast >= 3;

  type Level = "green" | "yellow" | "red";
  let level: Level;
  if (badFields.length >= 2) level = "red";
  else if (badFields.length === 1 || isStale) level = "yellow";
  else level = "green";

  const cfg = {
    green: {
      bg: "#f0fdf4", border: "#86efac", icon: "🟢",
      label: "Badebereit!", sub: "Alle Werte im grünen Bereich",
      labelColor: "#15803d",
    },
    yellow: {
      bg: "#fffbeb", border: "#fcd34d", icon: "🟡",
      label: "Mit Vorsicht",
      sub: isStale && badFields.length === 0
        ? `Messung vor ${daysSinceLast} Tagen – bitte neu messen`
        : "1 Wert außerhalb – Korrektur empfohlen",
      labelColor: "#92400e",
    },
    red: {
      bg: "#fef2f2", border: "#fca5a5", icon: "🔴",
      label: "Nicht empfohlen",
      sub: "Bitte Werte korrigieren vor dem Baden",
      labelColor: "#991b1b",
    },
  }[level];

  return (
    <div style={{
      background: cfg.bg,
      border: `2px solid ${cfg.border}`,
      borderRadius: 18,
      padding: "16px 20px",
      marginBottom: 14,
      display: "flex",
      alignItems: "center",
      gap: 16,
      boxShadow: "0 2px 12px #0369a108",
    }}>
      <div style={{ fontSize: "3rem", lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", color: cfg.labelColor, lineHeight: 1.2 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginTop: 4 }}>{cfg.sub}</div>
      </div>
    </div>
  );
}
