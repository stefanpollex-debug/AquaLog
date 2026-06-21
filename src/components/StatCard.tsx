import { type PoolEntry } from "../hooks/usePoolEntries";
import { LIMITS, type FieldKey, type ActiveLimits } from "../utils/constants";
import { avg, pctOutOfRange } from "../utils/status";

interface Props {
  entries: PoolEntry[];
  limits?: ActiveLimits;
}

const FIELDS: [FieldKey, string, string][] = [
  ["cl",   "🟦", "mg/l"],
  ["ph",   "🟣", ""],
  ["temp", "🟠", "°C"],
];

export function StatCard({ entries, limits }: Props) {
  if (entries.length < 2) return null;
  return (
    <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 14, fontSize: "0.95rem" }}>
        📊 Saisonstatistik ({entries.length} Messungen)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {FIELDS.map(([k, emoji, u]) => {
          const a   = avg(entries as unknown as Array<Record<string, number>>, k).toFixed(1);
          const mn  = Math.min(...entries.map((e) => e[k] as number)).toFixed(1);
          const mx  = Math.max(...entries.map((e) => e[k] as number)).toFixed(1);
          const pct = pctOutOfRange(entries as unknown as Array<Record<string, number>>, k, limits);
          return (
            <div key={k} style={{ background: "#f8fafc", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: "1.1rem" }}>{emoji}</div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 4 }}>{LIMITS[k].label}</div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{a}{u}</div>
              <div style={{ fontSize: "0.65rem", color: "#94a3b8" }}>Ø Mittel</div>
              <div style={{ fontSize: "0.65rem", color: "#64748b", marginTop: 4 }}>{mn} – {mx}{u}</div>
              {pct > 0
                ? <div style={{ marginTop: 4, fontSize: "0.65rem", background: "#fee2e2", color: "#991b1b", borderRadius: 6, padding: "2px 6px" }}>{pct}% außerh.</div>
                : <div style={{ marginTop: 4, fontSize: "0.65rem", background: "#d1fae5", color: "#065f46", borderRadius: 6, padding: "2px 6px" }}>immer OK ✓</div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}
