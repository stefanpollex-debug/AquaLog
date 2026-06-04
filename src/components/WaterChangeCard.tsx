import { useState } from "react";
import {
  type WaterChangeRecord, INTERVAL_OPTIONS,
  daysUntilNextChange, getWaterChangeStatus,
  STATUS_COLOR, STATUS_BG,
} from "../utils/waterChange";

interface Props {
  record:   WaterChangeRecord | null;
  onSave:   (r: WaterChangeRecord) => void;
  onReset:  () => void;
}

function notifState(): "idle" | "granted" | "denied" {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied")  return "denied";
  return "idle";
}

export function WaterChangeCard({ record, onSave, onReset }: Props) {
  const [setupDate,     setSetupDate]     = useState(new Date().toISOString().slice(0, 10));
  const [setupInterval, setSetupInterval] = useState<number>(90);
  const [notif,         setNotif]         = useState(notifState);

  const requestNotif = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotif(perm === "granted" ? "granted" : "denied");
  };

  /* ── Erstkonfiguration ──────────────────────────────────────── */
  if (!record) {
    return (
      <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 4, fontSize: "0.95rem" }}>🚿 Wasseraustausch</div>
        <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 14 }}>
          Wann wurde das Wasser zuletzt gewechselt?
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 4 }}>
            Datum letzter Austausch
          </label>
          <input
            type="date" value={setupDate}
            onChange={(e) => setSetupDate(e.target.value)}
            style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "8px 12px", fontSize: "0.9rem", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Intervall</div>
          <div style={{ display: "flex", gap: 8 }}>
            {INTERVAL_OPTIONS.map((d) => (
              <button key={d} onClick={() => setSetupInterval(d)} style={{
                flex: 1, padding: "8px 0",
                border:      `1.5px solid ${setupInterval === d ? "#0369a1" : "#e2e8f0"}`,
                borderRadius: 10,
                background:  setupInterval === d ? "#e0f2fe" : "white",
                color:       setupInterval === d ? "#0369a1" : "#64748b",
                fontWeight:  setupInterval === d ? 700 : 500,
                fontSize: "0.82rem", cursor: "pointer",
              }}>
                {d} Tage
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onSave({ date: setupDate, intervalDays: setupInterval })}
          style={{
            width: "100%", padding: "11px",
            background: "linear-gradient(90deg,#0369a1,#0ea5e9)",
            color: "white", border: "none", borderRadius: 12,
            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}
        >
          💾 Speichern
        </button>
      </div>
    );
  }

  /* ── Countdown-Karte ────────────────────────────────────────── */
  const daysLeft = daysUntilNextChange(record);
  const status   = getWaterChangeStatus(daysLeft);
  const color    = STATUS_COLOR[status];
  const bg       = STATUS_BG[status];
  const lastDate = new Date(record.date + "T12:00:00")
    .toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  const nextDate = new Date(
    new Date(record.date + "T12:00:00").getTime() + record.intervalDays * 86_400_000
  ).toLocaleDateString("de-DE", { day: "numeric", month: "long" });

  return (
    <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 14, fontSize: "0.95rem" }}>🚿 Wasseraustausch</div>

      {/* Countdown */}
      <div style={{
        background: bg, borderRadius: 14, padding: "16px 18px", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 18,
      }}>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: "2.4rem", color, lineHeight: 1 }}>
            {Math.max(0, daysLeft)}
          </div>
          <div style={{ fontSize: "0.6rem", color, fontWeight: 700, marginTop: 2, letterSpacing: "0.05em" }}>TAGE</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.88rem", marginBottom: 3 }}>
            {daysLeft <= 0 ? "⚠️ Wasseraustausch fällig!" : "bis zum nächsten Austausch"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
            Letzter Austausch: {lastDate}
          </div>
          {daysLeft > 0 && (
            <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 1 }}>
              Fällig am: {nextDate}
            </div>
          )}
        </div>
      </div>

      {/* Intervall-Auswahl */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Intervall</div>
        <div style={{ display: "flex", gap: 6 }}>
          {INTERVAL_OPTIONS.map((d) => (
            <button key={d} onClick={() => onSave({ ...record, intervalDays: d })} style={{
              flex: 1, padding: "7px 0",
              border:      `1.5px solid ${record.intervalDays === d ? "#0369a1" : "#e2e8f0"}`,
              borderRadius: 8,
              background:  record.intervalDays === d ? "#e0f2fe" : "white",
              color:       record.intervalDays === d ? "#0369a1" : "#64748b",
              fontWeight:  record.intervalDays === d ? 700 : 500,
              fontSize: "0.8rem", cursor: "pointer",
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        style={{
          width: "100%", padding: "10px",
          background: "#f0f9ff", border: "1.5px solid #bae6fd",
          borderRadius: 12, fontWeight: 700, color: "#0369a1",
          cursor: "pointer", fontSize: "0.88rem",
        }}
      >
        ✅ Wasser gewechselt — Datum zurücksetzen
      </button>

      {/* Benachrichtigungen */}
      {notif === "idle" && (
        <button
          onClick={requestNotif}
          style={{
            width: "100%", marginTop: 8, padding: "9px",
            background: "white", border: "1.5px solid #e2e8f0",
            borderRadius: 12, fontWeight: 600, color: "#64748b",
            cursor: "pointer", fontSize: "0.78rem",
          }}
        >
          🔔 Erinnerungen aktivieren
        </button>
      )}
      {notif === "granted" && (
        <div style={{ marginTop: 8, fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>
          🔔 Benachrichtigungen aktiv — 14 Tage vor Fälligkeit
        </div>
      )}
    </div>
  );
}
