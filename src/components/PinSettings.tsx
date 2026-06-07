import { useState } from "react";

interface Props {
  hasPin:      boolean;
  onSetPin:    (pin: string) => Promise<void>;
  onCheckPin:  (pin: string) => Promise<boolean>;
  onClearPin:  () => Promise<void>;
}

type Phase =
  | "idle"
  | "setup_enter"   | "setup_confirm"
  | "change_current"| "change_new"    | "change_confirm"
  | "remove_verify";

const PHASE_LABEL: Record<Phase, string> = {
  idle:           "",
  setup_enter:    "Neuen PIN eingeben",
  setup_confirm:  "PIN bestätigen",
  change_current: "Aktuellen PIN eingeben",
  change_new:     "Neuen PIN eingeben",
  change_confirm: "Neuen PIN bestätigen",
  remove_verify:  "Aktuellen PIN eingeben",
};

const NUM_BTN: React.CSSProperties = {
  padding: "13px 0",
  background: "white",
  border: "1.5px solid #e2e8f0",
  borderRadius: 10,
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "#1e293b",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

function actionBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: "9px 16px",
    background: bg, color,
    border: "none", borderRadius: 10,
    fontWeight: 600, fontSize: "0.82rem",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  };
}

export function PinSettings({ hasPin, onSetPin, onCheckPin, onClearPin }: Props) {
  const [phase,    setPhase]    = useState<Phase>("idle");
  const [current,  setCurrent]  = useState("");   // live digit input
  const [firstPin, setFirstPin] = useState("");   // stored first entry (for confirm)
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const reset = () => {
    setPhase("idle");
    setCurrent("");
    setFirstPin("");
    setError("");
  };

  const handleDigit = async (d: string) => {
    if (current.length >= 4) return;
    const next = current + d;
    setCurrent(next);
    setError("");
    if (next.length < 4) return;
    await processPin(next);
  };

  const handleDelete = () => {
    setCurrent(p => p.slice(0, -1));
    setError("");
  };

  const processPin = async (pin: string) => {
    switch (phase) {

      case "setup_enter":
        setFirstPin(pin);
        setCurrent("");
        setPhase("setup_confirm");
        break;

      case "setup_confirm":
        if (pin === firstPin) {
          await onSetPin(pin);
          setSuccess("PIN aktiviert ✓");
          setTimeout(reset, 1600);
        } else {
          setError("PINs stimmen nicht überein");
          setCurrent("");
          setFirstPin("");
          setPhase("setup_enter");
        }
        break;

      case "change_current": {
        const ok = await onCheckPin(pin);
        if (ok) {
          setCurrent("");
          setPhase("change_new");
        } else {
          setError("Falscher PIN");
          setCurrent("");
        }
        break;
      }

      case "change_new":
        setFirstPin(pin);
        setCurrent("");
        setPhase("change_confirm");
        break;

      case "change_confirm":
        if (pin === firstPin) {
          await onSetPin(pin);
          setSuccess("PIN geändert ✓");
          setTimeout(reset, 1600);
        } else {
          setError("PINs stimmen nicht überein");
          setCurrent("");
          setFirstPin("");
          setPhase("change_new");
        }
        break;

      case "remove_verify": {
        const ok = await onCheckPin(pin);
        if (ok) {
          await onClearPin();
          setSuccess("PIN deaktiviert ✓");
          setTimeout(() => { setSuccess(""); reset(); }, 1600);
        } else {
          setError("Falscher PIN");
          setCurrent("");
        }
        break;
      }
    }
  };

  // ── Success flash ──────────────────────────────────────────
  if (success) {
    return (
      <div style={{
        background: "#d1fae5", borderRadius: 14, padding: "14px 16px",
        textAlign: "center", color: "#065f46", fontWeight: 700, fontSize: "0.88rem",
      }}>
        ✅ {success}
      </div>
    );
  }

  return (
    <div>
      {/* Status header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>🔐 PIN-Schutz</div>
          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>
            {hasPin
              ? "Aktiv — App ist beim Start gesperrt"
              : "Deaktiviert — App startet ohne Sperre"}
          </div>
        </div>
        <div style={{
          background: hasPin ? "#d1fae5" : "#f1f5f9",
          color:      hasPin ? "#065f46" : "#64748b",
          borderRadius: 8, padding: "3px 10px",
          fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
        }}>
          {hasPin ? "AN" : "AUS"}
        </div>
      </div>

      {/* Idle: action buttons */}
      {phase === "idle" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!hasPin ? (
            <button onClick={() => { setCurrent(""); setPhase("setup_enter"); }} style={actionBtn("#0369a1", "white")}>
              PIN einrichten
            </button>
          ) : (
            <>
              <button onClick={() => { setCurrent(""); setPhase("change_current"); }} style={actionBtn("#0369a1", "white")}>
                PIN ändern
              </button>
              <button onClick={() => { setCurrent(""); setPhase("remove_verify"); }} style={actionBtn("#fee2e2", "#dc2626")}>
                PIN deaktivieren
              </button>
            </>
          )}
        </div>
      )}

      {/* Active phase: dots + mini numpad */}
      {phase !== "idle" && (
        <div style={{ background: "#f8fafc", borderRadius: 16, padding: "16px 12px", marginTop: 6 }}>
          {/* Phase label */}
          <div style={{ textAlign: "center", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: 14 }}>
            {PHASE_LABEL[phase]}
          </div>

          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 14 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{
                width: 14, height: 14, borderRadius: "50%",
                background: i < current.length ? "#0369a1" : "#e2e8f0",
                border: "2px solid " + (i < current.length ? "#0369a1" : "#cbd5e1"),
                transition: "all 0.12s ease",
              }} />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ textAlign: "center", color: "#dc2626", fontSize: "0.75rem", marginBottom: 10, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Mini numpad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[1,2,3,4,5,6,7,8,9].map(n => (
              <button key={n} onClick={() => handleDigit(String(n))} style={NUM_BTN}>{n}</button>
            ))}
            <div />
            <button onClick={() => handleDigit("0")} style={NUM_BTN}>0</button>
            <button onClick={handleDelete} style={{ ...NUM_BTN, background: "#e2e8f0", color: "#475569" }}>⌫</button>
          </div>

          {/* Cancel */}
          <button onClick={reset} style={{
            marginTop: 12, width: "100%", padding: "10px 0",
            background: "none", border: "1.5px solid #e2e8f0",
            borderRadius: 10, color: "#64748b",
            fontSize: "0.82rem", cursor: "pointer",
          }}>
            Abbrechen
          </button>
        </div>
      )}
    </div>
  );
}
