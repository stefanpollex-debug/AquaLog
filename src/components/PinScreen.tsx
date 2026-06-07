import { useState, useEffect } from "react";
import { clear } from "idb-keyval";

interface Props {
  attempts:    number;
  lockedUntil: number | null;
  onVerify:    (pin: string) => Promise<boolean>;
}

const BTN: React.CSSProperties = {
  width: 72, height: 72, borderRadius: "50%",
  background: "rgba(255,255,255,0.18)",
  border: "1.5px solid rgba(255,255,255,0.22)",
  color: "white", fontSize: "1.5rem", fontWeight: 600,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  WebkitTapHighlightColor: "transparent",
  transition: "background 0.1s",
};

export function PinScreen({ attempts, lockedUntil, onVerify }: Props) {
  const [pin,       setPin]       = useState("");
  const [error,     setError]     = useState("");
  const [shake,     setShake]     = useState(false);
  const [lockSecs,  setLockSecs]  = useState(0);
  const [showForgot, setShowForgot] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  // Lockout countdown
  useEffect(() => {
    if (!lockedUntil) { setLockSecs(0); return; }
    const tick = () => {
      const s = Math.ceil((lockedUntil - Date.now()) / 1000);
      setLockSecs(s > 0 ? s : 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleDigit = async (d: string) => {
    if (lockSecs > 0 || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");

    if (next.length === 4) {
      const ok = await onVerify(next);
      if (!ok) {
        setError("Falscher PIN");
        triggerShake();
        setTimeout(() => { setPin(""); setError(""); }, 700);
      }
      // If ok → App re-renders and replaces this screen
    }
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
    setError("");
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    await clear();
    window.location.reload();
  };

  const locked = lockSecs > 0;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "linear-gradient(160deg,#0369a1 0%,#0284c7 55%,#0ea5e9 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      zIndex: 1000, userSelect: "none", WebkitUserSelect: "none",
    }}>
      <style>{`
        @keyframes pinShake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-10px)}
          30%{transform:translateX(10px)}
          45%{transform:translateX(-7px)}
          60%{transform:translateX(7px)}
          75%{transform:translateX(-4px)}
          90%{transform:translateX(4px)}
        }
      `}</style>

      {/* Logo */}
      <div style={{ fontSize: "3rem", marginBottom: 6, lineHeight: 1 }}>🏊</div>
      <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "white", letterSpacing: "-0.02em" }}>
        AquaLog
      </div>
      <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)", marginTop: 4, marginBottom: 44 }}>
        PIN eingeben
      </div>

      {/* Dots */}
      <div style={{
        display: "flex", gap: 22, marginBottom: 20,
        animation: shake ? "pinShake 0.55s ease" : undefined,
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 20, height: 20, borderRadius: "50%",
            background: i < pin.length
              ? (error ? "rgba(252,165,165,0.9)" : "white")
              : "rgba(255,255,255,0.25)",
            border: "2px solid " + (i < pin.length
              ? (error ? "rgba(252,100,100,0.7)" : "rgba(255,255,255,0.8)")
              : "rgba(255,255,255,0.3)"),
            transition: "all 0.12s ease",
            boxShadow: i < pin.length && !error ? "0 0 8px rgba(255,255,255,0.4)" : "none",
          }} />
        ))}
      </div>

      {/* Status */}
      <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
        {locked ? (
          <span style={{ color: "#fde68a", fontSize: "0.88rem", fontWeight: 600 }}>
            🔒 Gesperrt — noch {lockSecs}s
          </span>
        ) : error ? (
          <span style={{ color: "#fca5a5", fontSize: "0.85rem" }}>{error}</span>
        ) : attempts > 0 && attempts < MAX_TRIES ? (
          <span style={{ color: "rgba(253,230,138,0.85)", fontSize: "0.8rem" }}>
            Noch {MAX_TRIES - attempts} Versuch{MAX_TRIES - attempts !== 1 ? "e" : ""} bis zur Sperre
          </span>
        ) : null}
      </div>

      {/* Numpad */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 72px)",
        gridTemplateRows: "repeat(4, 72px)",
        gap: 14,
        opacity: locked ? 0.35 : 1,
        transition: "opacity 0.3s",
      }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n}
            onClick={() => handleDigit(String(n))}
            disabled={locked}
            style={BTN}
          >
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => handleDigit("0")} disabled={locked} style={BTN}>0</button>
        <button onClick={handleDelete} disabled={locked}
          style={{ ...BTN, fontSize: "1.25rem", background: "rgba(255,255,255,0.1)" }}
        >⌫</button>
      </div>

      {/* Forgot link */}
      {!showForgot && !deleting && (
        <button
          onClick={() => setShowForgot(true)}
          style={{
            marginTop: 44, background: "none", border: "none",
            color: "rgba(255,255,255,0.45)", fontSize: "0.8rem",
            cursor: "pointer", padding: "8px 20px",
            textDecoration: "underline", textUnderlineOffset: 3,
          }}
        >
          PIN vergessen?
        </button>
      )}

      {/* Confirm delete */}
      {showForgot && !deleting && (
        <div style={{
          marginTop: 28,
          background: "rgba(0,0,0,0.32)",
          borderRadius: 20, padding: "20px 22px",
          maxWidth: 290, textAlign: "center",
        }}>
          <div style={{ color: "white", fontWeight: 700, fontSize: "0.95rem", marginBottom: 10 }}>
            ⚠️ Alle Daten löschen?
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.78rem", lineHeight: 1.65, marginBottom: 18 }}>
            Alle Pool-Messungen, Einstellungen und der PIN werden unwiderruflich gelöscht.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowForgot(false)} style={{
              flex: 1, padding: "11px 0",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: 12, color: "white",
              fontSize: "0.85rem", cursor: "pointer",
            }}>
              Abbrechen
            </button>
            <button onClick={handleDeleteAll} style={{
              flex: 1, padding: "11px 0",
              background: "#dc2626", border: "none",
              borderRadius: 12, color: "white",
              fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
            }}>
              Alles löschen
            </button>
          </div>
        </div>
      )}

      {deleting && (
        <div style={{ marginTop: 32, color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}>
          Wird gelöscht…
        </div>
      )}
    </div>
  );
}

const MAX_TRIES = 3;
