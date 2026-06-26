import { useState } from "react";
import { usePoolEntries, type PoolEntry } from "../hooks/usePoolEntries";
import { localToday } from "../utils/status";
import {
  analyzeProfiles,
  getSmartReminders,
  type CrossProfileInsight,
} from "../utils/correlationEngine";

// ── Typen ─────────────────────────────────────────────────────────────────────

interface Props {
  spaEntries: PoolEntry[];
  lastRainMm: number;           // heutiger Niederschlag (0 wenn kein Wetter)
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function confidenceBar(c: number) {
  const pct = Math.round(c * 100);
  const color = c >= 0.7 ? "#22c55e" : c >= 0.4 ? "#f59e0b" : "#e2e8f0";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
      <div style={{ flex: 1, height: 4, background: "#f1f5f9", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: "0.62rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
        {pct}% Datenbasis
      </span>
    </div>
  );
}

const INSIGHT_ICON: Record<CrossProfileInsight["type"], string> = {
  tap_to_spa: "🚿",
  rain_to_spa: "🌧️",
  combined: "🔬",
  info: "💡",
};

const INSIGHT_COLOR: Record<CrossProfileInsight["type"], string> = {
  tap_to_spa: "#0369a1",
  rain_to_spa: "#6366f1",
  combined:   "#10b981",
  info:       "#94a3b8",
};

// ── Mini-Entry-Formulare ──────────────────────────────────────────────────────

interface MiniFormProps {
  label: string;
  icon: string;
  phDefault: number;
  clDefault: number;
  clOptional?: boolean;
  onSave: (ph: number, cl: number, date: string) => void;
}

function MiniEntryForm({ label, icon, phDefault, clDefault, clOptional, onSave }: MiniFormProps) {
  const [open, setOpen]   = useState(false);
  const [ph, setPh]       = useState(phDefault);
  const [cl, setCl]       = useState(clDefault);
  const [date, setDate]   = useState(localToday());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(ph, cl, date);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1600);
  };

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 14, boxShadow: "0 1px 6px #0369a10d", marginBottom: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between",
          alignItems: "center", background: "none", border: "none",
          cursor: "pointer", padding: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>
          {icon} {label}
        </span>
        <span style={{ color: "#94a3b8", fontSize: "0.85rem", transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
          {/* Datum */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: "0.72rem", color: "#94a3b8", flexShrink: 0 }}>📅 Datum</span>
            <input
              type="date" value={date}
              onChange={e => setDate(e.target.value)}
              style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "5px 8px", fontSize: "0.82rem", outline: "none" }}
            />
          </div>

          {/* pH-Slider */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>pH-Wert</span>
              <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#8b5cf6" }}>{ph.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={5.5} max={8.5} step={0.05} value={ph}
              onChange={e => setPh(+e.target.value)}
              style={{ width: "100%", accentColor: "#8b5cf6" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "#cbd5e1" }}>
              <span>5.5</span><span>7.0</span><span>8.5</span>
            </div>
          </div>

          {/* Cl-Slider */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>
                Chlor (Cl)
                {clOptional && <span style={{ fontWeight: 400, fontSize: "0.65rem", color: "#94a3b8", marginLeft: 6 }}>optional</span>}
              </span>
              <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "#0ea5e9" }}>{cl.toFixed(2)} mg/l</span>
            </div>
            <input
              type="range"
              min={0} max={3} step={0.05} value={cl}
              onChange={e => setCl(+e.target.value)}
              style={{ width: "100%", accentColor: "#0ea5e9" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "#cbd5e1" }}>
              <span>0</span><span>1.5</span><span>3.0</span>
            </div>
          </div>

          <button
            onClick={handleSave}
            style={{
              width: "100%", padding: "10px 0",
              background: "linear-gradient(90deg,#0369a1,#0ea5e9)",
              color: "white", border: "none", borderRadius: 10,
              fontWeight: 700, fontSize: "0.88rem", cursor: "pointer",
            }}
          >
            💾 Speichern
          </button>

          {saved && (
            <div style={{ marginTop: 8, background: "#d1fae5", borderRadius: 8, padding: "8px 12px", color: "#065f46", fontWeight: 700, textAlign: "center", fontSize: "0.82rem" }}>
              ✅ Gespeichert!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Eintragsliste ─────────────────────────────────────────────────────────────

function EntryList({ entries, label, onDelete }: {
  entries: PoolEntry[];
  label: string;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between",
          alignItems: "center", background: "white", border: "none",
          borderRadius: 14, padding: "10px 14px", cursor: "pointer",
          boxShadow: "0 1px 6px #0369a10d",
        }}
      >
        <span style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.82rem" }}>
          📋 {label} ({entries.length})
        </span>
        <span style={{ color: "#94a3b8", fontSize: "0.8rem", transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>

      {open && (
        <div style={{ marginTop: 6 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background: "white", borderRadius: 10, padding: "8px 12px", marginBottom: 5, boxShadow: "0 1px 3px #0369a10d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: "0.78rem", color: "#475569" }}>
                  {new Date(e.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "2-digit" })}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: 10 }}>
                  pH <b>{e.ph.toFixed(2)}</b>
                </span>
                {e.cl > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: 8 }}>
                    Cl <b>{e.cl.toFixed(2)}</b> mg/l
                  </span>
                )}
              </div>
              <button
                onClick={() => onDelete(e.id)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "#e2e8f0", padding: "0 0 0 8px" }}
              >🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────

export function WasseranalyseView({ spaEntries, lastRainMm }: Props) {
  const tap  = usePoolEntries("entries_tap");
  const rain = usePoolEntries("entries_rain");

  const insights  = analyzeProfiles(spaEntries, tap.entries, rain.entries);
  const reminders = getSmartReminders(spaEntries, tap.entries, lastRainMm);

  const addTap = (ph: number, cl: number, date: string) => {
    tap.addEntry({ date, cl, ph, temp: 0, note: "Leitungswasser" });
  };

  const addRain = (ph: number, cl: number, date: string) => {
    rain.addEntry({ date, cl, ph, temp: 0, note: "Regenwasser" });
  };

  return (
    <div>
      {/* ── Reminders ─────────────────────────────────────────────────────── */}
      {reminders.map(r => (
        <div key={r.id} style={{
          background: r.severity === "warn" ? "#fef3c7" : "#f0f9ff",
          borderLeft: `4px solid ${r.severity === "warn" ? "#f59e0b" : "#0369a1"}`,
          borderRadius: 12, padding: "10px 14px", marginBottom: 10,
          fontSize: "0.8rem", color: r.severity === "warn" ? "#92400e" : "#0369a1",
          lineHeight: 1.5,
        }}>
          {r.text}
        </div>
      ))}

      {/* ── Wasserquellen erfassen ─────────────────────────────────────────── */}
      <div style={{ fontWeight: 700, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Wasserquellen
      </div>

      <MiniEntryForm
        label="Leitungswasser messen"
        icon="🚿"
        phDefault={7.4}
        clDefault={0.1}
        onSave={addTap}
      />

      <MiniEntryForm
        label="Regenwasser messen"
        icon="🌧️"
        phDefault={6.2}
        clDefault={0}
        clOptional
        onSave={addRain}
      />

      {/* ── Eintrags-Listen ───────────────────────────────────────────────── */}
      <EntryList
        entries={tap.entries}
        label="Leitungswasser-Einträge"
        onDelete={tap.deleteEntry}
      />
      <EntryList
        entries={rain.entries}
        label="Regenwasser-Einträge"
        onDelete={rain.deleteEntry}
      />

      {/* ── Insights ──────────────────────────────────────────────────────── */}
      <div style={{ fontWeight: 700, color: "#475569", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 18, marginBottom: 8 }}>
        Wasser-Insights
      </div>

      {insights.map((ins, i) => (
        <div key={i} style={{
          background: "white", borderRadius: 14, padding: "12px 14px",
          marginBottom: 10, boxShadow: "0 1px 6px #0369a10d",
          borderLeft: `4px solid ${INSIGHT_COLOR[ins.type]}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: "1rem" }}>{INSIGHT_ICON[ins.type]}</span>
            <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>{ins.title}</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#374151", lineHeight: 1.65 }}>
            {ins.body}
          </p>
          {ins.samplesUsed > 0 && confidenceBar(ins.confidence)}
        </div>
      ))}

      {/* ── Erklärung ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "#f8fafc", borderRadius: 14, padding: "12px 14px",
        marginTop: 8, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.6,
      }}>
        <b>So funktioniert das:</b> AquaLog vergleicht dein Leitungs- und Regenwasser mit deinen Spa-Messwerten. Je mehr Messungen du einträgst, desto genauer werden die Vorhersagen (Konfidenz-Balken zeigt Datenbasis).
      </div>
    </div>
  );
}
