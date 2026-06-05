import { useState } from "react";
import {
  type FilterEntry, type FilterSettings,
  CLEAN_INTERVAL_OPTIONS, REPLACE_INTERVAL_OPTIONS,
  daysSinceEntry, getFilterStatus, FILTER_STATUS_COLOR, FILTER_STATUS_BG,
} from "../utils/filterLog";

interface Props {
  log:          FilterEntry[];
  settings:     FilterSettings;
  lastClean?:   FilterEntry;
  lastReplace?: FilterEntry;
  onAdd:        (type: FilterEntry["type"]) => void;
  onDelete:     (id: number) => void;
  onSettings:   (s: FilterSettings) => void;
}

function MiniCard({ entry, intervalDays, icon, label, onAdd }: {
  entry?:       FilterEntry;
  intervalDays: number;
  icon:         string;
  label:        string;
  onAdd:        () => void;
}) {
  const daysSince = entry ? daysSinceEntry(entry) : null;
  const status    = daysSince !== null ? getFilterStatus(daysSince, intervalDays) : "danger";
  const color     = FILTER_STATUS_COLOR[status];
  const bg        = FILTER_STATUS_BG[status];

  return (
    <div style={{ flex: 1, background: bg, borderRadius: 12, padding: "12px 10px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: "1.3rem" }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#1e293b", marginTop: 4, marginBottom: 8 }}>{label}</div>

      {daysSince !== null ? (
        <>
          <div style={{ fontWeight: 900, fontSize: "1.9rem", color, lineHeight: 1 }}>{daysSince}</div>
          <div style={{ fontSize: "0.58rem", color, fontWeight: 700, marginBottom: 2, letterSpacing: "0.05em" }}>TAGE HER</div>
          <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginBottom: 10 }}>
            {new Date(entry!.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
          </div>
        </>
      ) : (
        <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: 18 }}>Noch nie</div>
      )}

      <button
        onClick={onAdd}
        style={{
          width: "100%", padding: "7px 4px", marginTop: "auto",
          background: "white", border: `1.5px solid ${color}`,
          borderRadius: 8, fontWeight: 700, color,
          cursor: "pointer", fontSize: "0.72rem",
        }}
      >
        ✓ Jetzt erledigt
      </button>
    </div>
  );
}

export function FilterCareCard({ log, settings, lastClean, lastReplace, onAdd, onDelete, onSettings }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const recent = log.slice(0, 5);

  return (
    <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.95rem" }}>🔧 Filterpflege</div>
        <button
          onClick={() => setShowSettings(v => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem", color: "#94a3b8", padding: 0 }}
        >
          ⚙️
        </button>
      </div>

      {/* Zwei Mini-Karten */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <MiniCard
          entry={lastClean} intervalDays={settings.cleanIntervalDays}
          icon="🧽" label="Reinigung" onAdd={() => onAdd("clean")}
        />
        <MiniCard
          entry={lastReplace} intervalDays={settings.replaceIntervalDays}
          icon="🔄" label="Wechsel" onAdd={() => onAdd("replace")}
        />
      </div>

      {/* Intervall-Einstellungen */}
      {showSettings && (
        <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginBottom: 10 }}>Erinnerungs-Intervalle</div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", width: 72, flexShrink: 0 }}>🧽 Reinigung</span>
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {CLEAN_INTERVAL_OPTIONS.map(d => (
                <button key={d} onClick={() => onSettings({ ...settings, cleanIntervalDays: d })} style={{
                  flex: 1, padding: "5px 0", fontSize: "0.72rem",
                  border:     `1px solid ${settings.cleanIntervalDays === d ? "#0369a1" : "#e2e8f0"}`,
                  borderRadius: 6,
                  background: settings.cleanIntervalDays === d ? "#e0f2fe" : "white",
                  color:      settings.cleanIntervalDays === d ? "#0369a1" : "#64748b",
                  fontWeight: settings.cleanIntervalDays === d ? 700 : 400,
                  cursor: "pointer",
                }}>{d}d</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.72rem", color: "#64748b", width: 72, flexShrink: 0 }}>🔄 Wechsel</span>
            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {REPLACE_INTERVAL_OPTIONS.map(d => (
                <button key={d} onClick={() => onSettings({ ...settings, replaceIntervalDays: d })} style={{
                  flex: 1, padding: "5px 0", fontSize: "0.72rem",
                  border:     `1px solid ${settings.replaceIntervalDays === d ? "#0369a1" : "#e2e8f0"}`,
                  borderRadius: 6,
                  background: settings.replaceIntervalDays === d ? "#e0f2fe" : "white",
                  color:      settings.replaceIntervalDays === d ? "#0369a1" : "#64748b",
                  fontWeight: settings.replaceIntervalDays === d ? 700 : 400,
                  cursor: "pointer",
                }}>{d}d</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Verlauf letzte 5 */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Letzte Einträge</div>
          {recent.map((e, i) => (
            <div key={e.id} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 0",
              borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
            }}>
              <span style={{ fontSize: "0.95rem" }}>{e.type === "clean" ? "🧽" : "🔄"}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>
                {new Date(e.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "2-digit" })}
              </span>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                {e.type === "clean" ? "Reinigung" : "Filterwechsel"}
              </span>
              {e.note && (
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontStyle: "italic", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  · {e.note}
                </span>
              )}
              <button
                onClick={() => onDelete(e.id)}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#e2e8f0", fontSize: "0.85rem", padding: "0 0 0 4px", flexShrink: 0 }}
              >🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
