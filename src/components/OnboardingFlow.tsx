import { useState } from "react";
import { COLORS, GRADIENT, RADIUS } from "../utils/theme";

interface Props {
  onComplete: () => Promise<void>;
  onSetPin:   (pin: string) => Promise<void>;
}

type PinPhase = "idle" | "enter" | "confirm" | "done";

const SLIDES = [
  {
    emoji: "🏊",
    title: "Willkommen bei\nAquaLog",
    body:  "Dein persönlicher Pool-Assistent. Chlor, pH und Temperatur immer im Blick — mit KI-Auswertung und automatischen Wetter-Daten.",
    cta:   "Los geht's 🚀",
    skip:  false,
  },
  {
    emoji: "📸",
    title: "Teststreifen\nabfotografieren",
    body:  "Einfach den Teststreifen in die Kamera halten — die KI erkennt deine Messwerte automatisch. Kein manuelles Tippen nötig.",
    cta:   "Weiter",
    skip:  true,
  },
  {
    emoji: "📊",
    title: "Verlauf &\nTrends",
    body:  "Sieh wie sich deine Wasserwerte entwickeln. AquaLog erkennt Muster, warnt bei Risiken und schlägt Maßnahmen vor.",
    cta:   "Weiter",
    skip:  true,
  },
] as const;

const PIN_SLIDE = SLIDES.length; // index 3

const NUM_BTN: React.CSSProperties = {
  width: 64, height: 64, borderRadius: "50%",
  background: "rgba(255,255,255,0.2)",
  border: "1.5px solid rgba(255,255,255,0.25)",
  color: "white", fontSize: "1.35rem", fontWeight: 600,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  WebkitTapHighlightColor: "transparent",
  transition: "background 0.1s",
};

export function OnboardingFlow({ onComplete, onSetPin }: Props) {
  const [slide,      setSlide]      = useState(0);
  const [pinPhase,   setPinPhase]   = useState<PinPhase>("idle");
  const [pin,        setPin]        = useState("");
  const [firstPin,   setFirstPin]   = useState("");
  const [pinError,   setPinError]   = useState("");
  const [finishing,  setFinishing]  = useState(false);

  const handleComplete = async () => {
    setFinishing(true);
    await onComplete();
  };

  const next = () => setSlide(s => s + 1);

  // ── PIN numpad ───────────────────────────────────────────────────────────
  const handleDigit = async (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setPinError("");
    if (next.length < 4) return;

    if (pinPhase === "enter") {
      setFirstPin(next);
      setPin("");
      setPinPhase("confirm");
    } else if (pinPhase === "confirm") {
      if (next === firstPin) {
        await onSetPin(next);
        setPin("");
        setPinPhase("done");
      } else {
        setPinError("PINs stimmen nicht überein");
        setPin("");
        setFirstPin("");
        setPinPhase("enter");
      }
    }
  };

  const handlePinDelete = () => {
    setPin(p => p.slice(0, -1));
    setPinError("");
  };

  // ── Numpad grid ──────────────────────────────────────────────────────────
  const NumPad = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 64px)", gridTemplateRows: "repeat(4, 64px)", gap: 12, margin: "0 auto" }}>
      {[1,2,3,4,5,6,7,8,9].map(n => (
        <button key={n} onClick={() => handleDigit(String(n))} style={NUM_BTN}>{n}</button>
      ))}
      <div />
      <button onClick={() => handleDigit("0")} style={NUM_BTN}>0</button>
      <button onClick={handlePinDelete} style={{ ...NUM_BTN, background: "rgba(255,255,255,0.1)", fontSize: "1.2rem" }}>⌫</button>
    </div>
  );

  // ── PIN dots ─────────────────────────────────────────────────────────────
  const PinDots = () => (
    <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 20 }}>
      {[0,1,2,3].map(i => (
        <div key={i} style={{
          width: 18, height: 18, borderRadius: "50%",
          background: i < pin.length ? "white" : "rgba(255,255,255,0.25)",
          border: "2px solid " + (i < pin.length ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)"),
          transition: "all 0.12s ease",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: GRADIENT.onboarding,
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "env(safe-area-inset-top, 48px) 24px env(safe-area-inset-bottom, 40px)",
      zIndex: 500, overflowY: "auto",
    }}>
      <style>{`
        @keyframes obFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Progress dots ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 0, alignSelf: "center" }}>
        {[...SLIDES, null].map((_, i) => (
          <div key={i} style={{
            width: i === slide ? 28 : 8, height: 8, borderRadius: 4,
            background: i === slide ? "white" : "rgba(255,255,255,0.32)",
            transition: "all 0.35s ease",
          }} />
        ))}
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        width: "100%", maxWidth: 360, padding: "24px 0",
      }}>

        {/* Regular slide */}
        {slide < PIN_SLIDE && (
          <div key={slide} style={{ textAlign: "center", animation: "obFadeIn 0.4s ease" }}>
            <div style={{ fontSize: "5rem", marginBottom: 28, lineHeight: 1, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.15))" }}>
              {SLIDES[slide].emoji}
            </div>
            <h1 style={{
              color: "white", fontSize: "1.8rem", fontWeight: 800,
              margin: "0 0 18px", lineHeight: 1.2, whiteSpace: "pre-line",
              textShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}>
              {SLIDES[slide].title}
            </h1>
            <p style={{
              color: "rgba(255,255,255,0.84)", fontSize: "0.96rem",
              lineHeight: 1.7, margin: 0,
            }}>
              {SLIDES[slide].body}
            </p>
          </div>
        )}

        {/* PIN slide */}
        {slide === PIN_SLIDE && (
          <div key="pin" style={{ width: "100%", textAlign: "center", animation: "obFadeIn 0.4s ease" }}>

            {pinPhase === "idle" && (
              <>
                <div style={{ fontSize: "4.5rem", marginBottom: 22, lineHeight: 1 }}>🔐</div>
                <h2 style={{ color: "white", fontSize: "1.55rem", fontWeight: 800, margin: "0 0 14px", lineHeight: 1.2 }}>
                  App mit PIN schützen?
                </h2>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", lineHeight: 1.65, margin: "0 0 28px" }}>
                  Verhindert unerwünschten Zugriff auf deine Pool-Daten. Du kannst den PIN jederzeit in den Einstellungen ändern oder deaktivieren.
                </p>
                <button
                  onClick={() => setPinPhase("enter")}
                  style={{
                    width: "100%", padding: "15px 0",
                    background: "white", color: COLORS.primary,
                    border: "none", borderRadius: RADIUS.btn,
                    fontWeight: 800, fontSize: "1rem",
                    cursor: "pointer", marginBottom: 12,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                  }}
                >
                  🔒 PIN einrichten
                </button>
              </>
            )}

            {(pinPhase === "enter" || pinPhase === "confirm") && (
              <>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.85rem", fontWeight: 600, marginBottom: 20, letterSpacing: "0.02em" }}>
                  {pinPhase === "enter" ? "Neuen PIN eingeben" : "PIN bestätigen"}
                </div>
                <PinDots />
                {pinError && (
                  <div style={{ color: "#fca5a5", fontSize: "0.8rem", marginBottom: 14, fontWeight: 500 }}>
                    {pinError}
                  </div>
                )}
                <NumPad />
                <button
                  onClick={() => { setPinPhase("idle"); setPin(""); setFirstPin(""); setPinError(""); }}
                  style={{
                    marginTop: 20, background: "none", border: "none",
                    color: "rgba(255,255,255,0.45)", fontSize: "0.8rem",
                    cursor: "pointer", padding: "8px 20px",
                  }}
                >
                  Abbrechen
                </button>
              </>
            )}

            {pinPhase === "done" && (
              <>
                <div style={{ fontSize: "4rem", marginBottom: 20, lineHeight: 1 }}>✅</div>
                <h2 style={{ color: "white", fontSize: "1.45rem", fontWeight: 800, margin: "0 0 12px" }}>
                  PIN gespeichert!
                </h2>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.9rem", lineHeight: 1.65, margin: 0 }}>
                  Die App ist jetzt beim Start geschützt. Du kannst den PIN jederzeit in ⚙️ Einstellungen ändern.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom actions ─────────────────────────────────────────── */}
      <div style={{ width: "100%", maxWidth: 360 }}>

        {slide < PIN_SLIDE && (
          <>
            <button onClick={next} style={{
              width: "100%", padding: "16px 0",
              background: "white", color: COLORS.primary,
              border: "none", borderRadius: RADIUS.btn,
              fontWeight: 800, fontSize: "1rem", cursor: "pointer",
              boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
              marginBottom: SLIDES[slide].skip ? 10 : 0,
            }}>
              {SLIDES[slide].cta}
            </button>
            {SLIDES[slide].skip && (
              <button onClick={handleComplete} disabled={finishing} style={{
                width: "100%", padding: "12px 0",
                background: "none", border: "none",
                color: "rgba(255,255,255,0.48)", fontSize: "0.84rem",
                cursor: "pointer",
              }}>
                Überspringen
              </button>
            )}
          </>
        )}

        {slide === PIN_SLIDE && pinPhase === "idle" && (
          <button onClick={handleComplete} disabled={finishing} style={{
            width: "100%", padding: "14px 0",
            background: "none",
            border: "1.5px solid rgba(255,255,255,0.3)",
            borderRadius: RADIUS.btn,
            color: "rgba(255,255,255,0.62)", fontSize: "0.9rem",
            cursor: "pointer",
          }}>
            Jetzt nicht — App starten
          </button>
        )}

        {slide === PIN_SLIDE && pinPhase === "done" && (
          <button onClick={handleComplete} disabled={finishing} style={{
            width: "100%", padding: "16px 0",
            background: "white", color: COLORS.primary,
            border: "none", borderRadius: RADIUS.btn,
            fontWeight: 800, fontSize: "1rem", cursor: "pointer",
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          }}>
            App starten 🚀
          </button>
        )}
      </div>
    </div>
  );
}
