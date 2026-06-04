import { useMemo } from "react";
import { type PoolEntry } from "../hooks/usePoolEntries";
import { analyzeTrends, MIN_ENTRIES } from "../utils/trendAnalysis";
import { TrendCard } from "./TrendCard";

interface Props {
  entries: PoolEntry[];
}

function entryDateRange(entries: PoolEntry[]): string {
  if (entries.length < 2) return "";
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const days = Math.round(
    (new Date(sorted[sorted.length - 1].date + "T12:00:00").getTime() -
      new Date(sorted[0].date + "T12:00:00").getTime()) / 86_400_000,
  );
  return `${entries.length} Messungen über ${days} Tage`;
}

export function TrendsView({ entries }: Props) {
  const results  = useMemo(() => analyzeTrends(entries), [entries]);
  const missing  = MIN_ENTRIES - entries.length;

  // ── Zu wenig Daten ─────────────────────────────────────────────
  if (entries.length < MIN_ENTRIES) {
    return (
      <div style={{ padding: "24px 0" }}>
        <div style={{
          background: "white", borderRadius: 18, padding: "28px 20px",
          textAlign: "center", boxShadow: "0 2px 12px #0369a110",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔍</div>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "#1e293b", marginBottom: 8 }}>
            Noch {missing} Messung{missing === 1 ? "" : "en"} bis zur ersten Analyse
          </div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", lineHeight: 1.5 }}>
            Mit mindestens {MIN_ENTRIES} Einträgen erkennt die App Muster in deinen Pool-Daten —
            Trends, Vorhersagen und Wetter-Korrelationen.
          </div>
          {/* Fortschrittsbalken */}
          <div style={{ marginTop: 16, background: "#f1f5f9", borderRadius: 8, height: 8, overflow: "hidden" }}>
            <div style={{
              width: `${(entries.length / MIN_ENTRIES) * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg,#0369a1,#0ea5e9)",
              borderRadius: 8,
              transition: "width 0.5s ease",
            }} />
          </div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 6 }}>
            {entries.length} / {MIN_ENTRIES} Messungen
          </div>
        </div>
      </div>
    );
  }

  // ── Keine Auffälligkeiten ──────────────────────────────────────
  if (results.length === 0) {
    return (
      <div>
        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 12 }}>
          {entryDateRange(entries)}
        </div>
        <div style={{
          background: "#f0fdf4", border: "1.5px solid #86efac",
          borderRadius: 18, padding: "24px 20px", textAlign: "center",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🌊</div>
          <div style={{ fontWeight: 700, color: "#15803d", fontSize: "0.95rem" }}>
            Alles im grünen Bereich
          </div>
          <div style={{ fontSize: "0.8rem", color: "#166534", marginTop: 6, lineHeight: 1.5 }}>
            Keine auffälligen Muster erkannt — dein Pool läuft optimal.
          </div>
        </div>
      </div>
    );
  }

  // ── Ergebnisse ─────────────────────────────────────────────────
  const dangerCount  = results.filter(r => r.severity === "danger").length;
  const warningCount = results.filter(r => r.severity === "warning").length;
  const goodCount    = results.filter(r => r.severity === "good").length;

  return (
    <div>
      {/* Meta-Info */}
      <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 12 }}>
        {entryDateRange(entries)}
        {" · "}
        {results.length} Erkenntnisse
      </div>

      {/* Zusammenfassung */}
      <div style={{
        background: "white", borderRadius: 14, padding: "12px 14px",
        marginBottom: 14, boxShadow: "0 1px 6px #0369a10d",
        display: "flex", gap: 12, flexWrap: "wrap",
      }}>
        {dangerCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
            <span style={{ color: "#991b1b", fontWeight: 600 }}>{dangerCount} dringend</span>
          </div>
        )}
        {warningCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
            <span style={{ color: "#92400e", fontWeight: 600 }}>{warningCount} Warnung{warningCount > 1 ? "en" : ""}</span>
          </div>
        )}
        {goodCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ color: "#15803d", fontWeight: 600 }}>{goodCount} positiv</span>
          </div>
        )}
      </div>

      {/* Karten — sortiert nach Severity */}
      {results.map(r => (
        <TrendCard key={r.id} result={r} />
      ))}

      {/* Hinweis */}
      <div style={{ fontSize: "0.67rem", color: "#cbd5e1", textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
        Analyse basiert auf gespeicherten Messwerten.
        Mehr Einträge = genauere Muster.
      </div>
    </div>
  );
}
