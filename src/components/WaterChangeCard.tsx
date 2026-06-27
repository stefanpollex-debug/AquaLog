import { useState } from "react";
import {
  type WaterChangeRecord, INTERVAL_OPTIONS, FULL_INTERVAL_OPTIONS,
  lastAddition, lastFullChange, daysSinceLastAddition, daysSinceLastFullChange,
  totalLitersAdded, calcDilution, getWaterStatus, STATUS_COLOR, STATUS_BG,
} from "../utils/waterChange";

interface Props {
  record:           WaterChangeRecord;
  onAdd:            (litersAdded: number, note?: string) => void;
  onDelete:         (id: number) => void;
  onAddFullChange:  (note?: string) => void;
  onDeleteFullChange: (id: number) => void;
  onSaveRecord:     (r: WaterChangeRecord) => void;
  poolVolume:       number;    // Liter
  lastCl?:          number;    // aktueller Cl-Messwert für Verdünnungsberechnung
  lastPh?:          number;    // aktueller pH-Messwert
}

function notifState(): "idle" | "granted" | "denied" {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied")  return "denied";
  return "idle";
}

export function WaterChangeCard({
  record, onAdd, onDelete, onAddFullChange, onDeleteFullChange, onSaveRecord,
  poolVolume, lastCl, lastPh,
}: Props) {
  const [litersInput, setLitersInput] = useState<string>("");
  const [noteInput,   setNoteInput]   = useState("");
  const [saved,       setSaved]       = useState(false);
  const [notif,       setNotif]       = useState(notifState());
  const [fullNote,    setFullNote]    = useState("");
  const [fullSaved,   setFullSaved]   = useState(false);

  const fullDaysSince = daysSinceLastFullChange(record);
  const fullStatus    = getWaterStatus(fullDaysSince, record.fullChangeIntervalDays);
  const fullColor     = STATUS_COLOR[fullStatus];
  const fullBg        = STATUS_BG[fullStatus];
  const lastFull       = lastFullChange(record);
  const recentFull     = record.fullChanges.slice(0, 5);

  const handleFullChange = () => {
    onAddFullChange(fullNote.trim() || undefined);
    setFullNote("");
    setFullSaved(true);
    setTimeout(() => setFullSaved(false), 2000);
  };

  const liters     = parseFloat(litersInput) || 0;
  const daysSince  = daysSinceLastAddition(record);
  const status     = getWaterStatus(daysSince, record.intervalDays);
  const color      = STATUS_COLOR[status];
  const bg         = STATUS_BG[status];
  const last       = lastAddition(record);
  const totalL     = totalLitersAdded(record);
  const totalPct   = Math.min(100, (totalL / poolVolume) * 100);
  const recent     = record.additions.slice(0, 5);

  // Verdünnungsvorschau
  const dilution = liters > 0 && lastCl !== undefined && lastPh !== undefined
    ? calcDilution(lastCl, lastPh, poolVolume, liters)
    : null;

  const handleSave = () => {
    if (liters <= 0) return;
    onAdd(liters, noteInput.trim() || undefined);
    setLitersInput("");
    setNoteInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const requestNotif = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotif(perm === "granted" ? "granted" : "denied");
  };

  return (
    <div>
      {/* ── Teilwasserwechsel — die tatsächlich genutzte Methode ── */}
      <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 14, fontSize: "0.95rem" }}>
        💧 Teilwasserwechsel
      </div>

      <div style={{
        background: bg, borderRadius: 14, padding: "14px 16px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          {daysSince !== null ? (
            <>
              <div style={{ fontWeight: 900, fontSize: "2.2rem", color, lineHeight: 1 }}>{daysSince}</div>
              <div style={{ fontSize: "0.58rem", color, fontWeight: 700, marginTop: 2, letterSpacing: "0.05em" }}>TAGE</div>
            </>
          ) : (
            <div style={{ fontSize: "1.8rem" }}>💧</div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem", marginBottom: 2 }}>
            {daysSince === null
              ? "Noch kein Eintrag"
              : daysSince > record.intervalDays
                ? "⚠️ Teilwechsel empfohlen"
                : `seit letzter Zugabe`}
          </div>
          {last && (
            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
              Letzter Eintrag: {new Date(last.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })} · {last.litersAdded} L
            </div>
          )}
          {totalL > 0 && (
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>
              Gesamt: {totalL} L = {totalPct.toFixed(0)} % des Poolvolumens erneuert
            </div>
          )}
        </div>
      </div>

      {/* ── Eingabe: Liter ──────────────────────────────────── */}
      <div style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
          Wieviel Liter Frischwasser zugegeben?
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <input
            type="number" min={1} max={poolVolume} step={5}
            value={litersInput}
            onChange={e => setLitersInput(e.target.value)}
            placeholder="z.B. 50"
            style={{
              flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 10,
              padding: "9px 12px", fontSize: "1.05rem", fontWeight: 700,
              boxSizing: "border-box", outline: "none",
            }}
          />
          <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: 600, flexShrink: 0 }}>
            Liter
          </span>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", flexShrink: 0 }}>
            / {poolVolume} L
          </span>
        </div>

        {/* Schnellauswahl */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {[10, 25, 50, 100].map(l => (
            <button key={l} onClick={() => setLitersInput(String(l))} style={{
              flex: 1, padding: "5px 0", fontSize: "0.72rem",
              border:     `1px solid ${litersInput === String(l) ? "#0369a1" : "#e2e8f0"}`,
              borderRadius: 6,
              background: litersInput === String(l) ? "#e0f2fe" : "white",
              color:      litersInput === String(l) ? "#0369a1" : "#64748b",
              fontWeight: litersInput === String(l) ? 700 : 400,
              cursor: "pointer",
            }}>{l} L</button>
          ))}
        </div>

        {/* Verdünnungsvorschau */}
        {dilution && (
          <div style={{
            background: "#fff",  border: "1px solid #e2e8f0",
            borderRadius: 10, padding: "10px 12px", marginBottom: 8,
          }}>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>
              Verdünnung nach Zugabe ({dilution.dilutionPct.toFixed(1)} %):
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Chlor (Cl)</div>
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{lastCl!.toFixed(2)} mg/l</div>
                <div style={{ fontSize: "0.75rem", color: "#0ea5e9", fontWeight: 700 }}>→ {dilution.newCl.toFixed(2)} mg/l</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>pH-Wert</div>
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{lastPh!.toFixed(2)}</div>
                <div style={{ fontSize: "0.75rem", color: "#a855f7", fontWeight: 700 }}>→ {dilution.newPh.toFixed(2)}</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#64748b" }}>Frischwasser</div>
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>{liters} L</div>
                <div style={{ fontSize: "0.75rem", color: "#22c55e", fontWeight: 700 }}>= {dilution.dilutionPct.toFixed(1)} %</div>
              </div>
            </div>
            <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 6, fontStyle: "italic" }}>
              Leitungswasser pH ~7,2 angenommen. Werte nach dem Auffüllen neu messen.
            </div>
          </div>
        )}

        <input
          type="text" value={noteInput}
          onChange={e => setNoteInput(e.target.value)}
          placeholder="Notiz (optional)"
          style={{
            width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10,
            padding: "8px 12px", fontSize: "0.85rem",
            boxSizing: "border-box", marginBottom: 8,
          }}
        />

        <button
          onClick={handleSave} disabled={liters <= 0}
          style={{
            width: "100%", padding: "10px",
            background: liters > 0 ? "linear-gradient(90deg,#0369a1,#0ea5e9)" : "#e2e8f0",
            color: liters > 0 ? "white" : "#94a3b8",
            border: "none", borderRadius: 10, fontWeight: 700,
            cursor: liters > 0 ? "pointer" : "not-allowed", fontSize: "0.9rem",
          }}
        >
          💧 {liters > 0 ? `${liters} L speichern` : "Menge eingeben"}
        </button>

        {saved && (
          <div style={{ marginTop: 8, background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.78rem", color: "#065f46", fontWeight: 600, textAlign: "center" }}>
            ✅ Gespeichert!
          </div>
        )}
      </div>

      {/* ── Erinnerungs-Intervall ────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
          Erinnerung alle
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {INTERVAL_OPTIONS.map(d => (
            <button key={d} onClick={() => onSaveRecord({ ...record, intervalDays: d })} style={{
              flex: 1, padding: "7px 0",
              border:     `1.5px solid ${record.intervalDays === d ? "#0369a1" : "#e2e8f0"}`,
              borderRadius: 8,
              background: record.intervalDays === d ? "#e0f2fe" : "white",
              color:      record.intervalDays === d ? "#0369a1" : "#64748b",
              fontWeight: record.intervalDays === d ? 700 : 500,
              fontSize: "0.78rem", cursor: "pointer",
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Benachrichtigungen ───────────────────────────────── */}
      {notif === "idle" && (
        <button onClick={requestNotif} style={{
          width: "100%", marginBottom: 14, padding: "8px",
          background: "white", border: "1.5px solid #e2e8f0",
          borderRadius: 10, fontWeight: 600, color: "#64748b",
          cursor: "pointer", fontSize: "0.78rem",
        }}>
          🔔 Erinnerungen aktivieren
        </button>
      )}
      {notif === "granted" && (
        <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 10, textAlign: "center" }}>
          🔔 Erinnerungen aktiv
        </div>
      )}

      {/* ── Verlauf ──────────────────────────────────────────── */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Letzte Einträge</div>
          {recent.map((a, i) => (
            <div key={a.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
              borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
            }}>
              <span style={{ fontSize: "0.85rem" }}>💧</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0ea5e9" }}>{a.litersAdded} L</span>
              <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                {new Date(a.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
              </span>
              {a.note && (
                <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontStyle: "italic", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  · {a.note}
                </span>
              )}
              <button
                onClick={() => onDelete(a.id)}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#e2e8f0", fontSize: "0.85rem", padding: "0 0 0 4px", flexShrink: 0 }}
              >🗑️</button>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* ── Kompletter Wasserwechsel — bisher nicht genutzt, aber verfügbar
          falls doch mal ein Drain & Refill gemacht wird ── */}
      <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 14, fontSize: "0.95rem" }}>
          🔄 Kompletter Wasserwechsel
        </div>

        <div style={{
          background: fullBg, borderRadius: 14, padding: "14px 16px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            {fullDaysSince !== null ? (
              <>
                <div style={{ fontWeight: 900, fontSize: "2.2rem", color: fullColor, lineHeight: 1 }}>{fullDaysSince}</div>
                <div style={{ fontSize: "0.58rem", color: fullColor, fontWeight: 700, marginTop: 2, letterSpacing: "0.05em" }}>TAGE</div>
              </>
            ) : (
              <div style={{ fontSize: "1.8rem" }}>🔄</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem", marginBottom: 2 }}>
              {fullDaysSince === null
                ? "Noch nie komplett gewechselt"
                : fullDaysSince > record.fullChangeIntervalDays
                  ? "⚠️ Kompletter Wechsel empfohlen"
                  : "seit letztem kompletten Wechsel"}
            </div>
            {lastFull && (
              <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
                Letzter Wechsel: {new Date(lastFull.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                {lastFull.note ? ` · ${lastFull.note}` : ""}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleFullChange}
          style={{
            width: "100%", padding: "12px",
            background: "linear-gradient(90deg,#0369a1,#0ea5e9)",
            color: "white", border: "none", borderRadius: 10,
            fontWeight: 700, cursor: "pointer", fontSize: "0.92rem", marginBottom: 8,
          }}
        >
          ✅ Heute komplett gewechselt — Pool neu befüllt
        </button>

        <input
          type="text" value={fullNote}
          onChange={e => setFullNote(e.target.value)}
          placeholder="Notiz (optional, z.B. Algen entfernt)"
          style={{
            width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10,
            padding: "8px 12px", fontSize: "0.85rem",
            boxSizing: "border-box", marginBottom: 8,
          }}
        />

        {fullSaved && (
          <div style={{ background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.78rem", color: "#065f46", fontWeight: 600, textAlign: "center", marginBottom: 8 }}>
            ✅ Gespeichert — Vergiss nicht, nach dem Befüllen frisch zu messen!
          </div>
        )}

        {/* Erinnerungs-Intervall */}
        <div style={{ marginBottom: recentFull.length > 0 ? 14 : 0 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
            Erinnerung alle
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {FULL_INTERVAL_OPTIONS.map(d => (
              <button key={d} onClick={() => onSaveRecord({ ...record, fullChangeIntervalDays: d })} style={{
                flex: 1, padding: "7px 0",
                border:     `1.5px solid ${record.fullChangeIntervalDays === d ? "#0369a1" : "#e2e8f0"}`,
                borderRadius: 8,
                background: record.fullChangeIntervalDays === d ? "#e0f2fe" : "white",
                color:      record.fullChangeIntervalDays === d ? "#0369a1" : "#64748b",
                fontWeight: record.fullChangeIntervalDays === d ? 700 : 500,
                fontSize: "0.78rem", cursor: "pointer",
              }}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {recentFull.length > 0 && (
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Letzte komplette Wechsel</div>
            {recentFull.map((c, i) => (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
              }}>
                <span style={{ fontSize: "0.85rem" }}>🔄</span>
                <span style={{ fontSize: "0.72rem", color: "#475569" }}>
                  {new Date(c.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                </span>
                {c.note && (
                  <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontStyle: "italic", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    · {c.note}
                  </span>
                )}
                <button
                  onClick={() => onDeleteFullChange(c.id)}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#e2e8f0", fontSize: "0.85rem", padding: "0 0 0 4px", flexShrink: 0 }}
                >🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
