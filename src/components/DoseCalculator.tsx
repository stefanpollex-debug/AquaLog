import { useState } from "react";
import { calcDose } from "../utils/dosage";

interface Props {
  volumeLiters: number;
  currentCl?: number;
  currentPh?: number;
  currentKh?: number;
  currentGh?: number;
}

function WaitBadge({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, background: "#f1f5f9", borderRadius: 7, padding: "5px 9px", fontSize: "0.67rem", color: "#475569" }}>
      <span>⏰</span><span>{text}</span>
    </div>
  );
}

export function DoseCalculator({ volumeLiters, currentCl, currentPh, currentKh, currentGh }: Props) {
  const volumeM3 = volumeLiters / 1000;

  const [clCurrent, setClCurrent] = useState(currentCl ?? 0.3);
  const [clTarget,  setClTarget]  = useState(1.0);
  const [phCurrent, setPhCurrent] = useState(currentPh ?? 7.5);
  const [phTarget,  setPhTarget]  = useState(7.4);
  const [khCurrent, setKhCurrent] = useState(currentKh ?? 60);
  const [khTarget,  setKhTarget]  = useState(100);
  const [ghCurrent, setGhCurrent] = useState(currentGh ?? 100);
  const [ghTarget,  setGhTarget]  = useState(150);

  const clDelta     = clTarget - clCurrent;
  const phDelta     = phTarget - phCurrent;
  const phSteps     = Math.abs(phDelta) / 0.1;
  const clDose      = clDelta  >  0.05 ? calcDose("chlor",    clDelta,  volumeM3) : 0;
  const phPlusDose  = phDelta  >  0.05 ? calcDose("ph_plus",  phSteps,  volumeM3) : 0;
  const phMinusDose = phDelta  < -0.05 ? calcDose("ph_minus", phSteps,  volumeM3) : 0;

  const khDelta   = khCurrent < khTarget - 5 ? (khTarget - khCurrent) / 10 : 0;
  const khDose    = khDelta > 0 ? calcDose("kh_plus", khDelta, volumeM3) : 0;
  const khTooHigh = khCurrent > 130;

  const ghDelta   = ghCurrent < ghTarget - 10 ? (ghTarget - ghCurrent) / 10 : 0;
  const ghDose    = ghDelta > 0 ? calcDose("gh_plus", ghDelta, volumeM3) : 0;
  const ghTooHigh = ghCurrent > 250;

  function SliderRow({
    label, value, onChange, min, max, step, unit,
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step: number; unit: string;
  }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: "0.7rem", color: "#64748b", width: 56, flexShrink: 0 }}>{label}</span>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: "#0369a1" }}
        />
        <span style={{ fontSize: "0.85rem", fontWeight: 700, width: 56, textAlign: "right", flexShrink: 0, color: "#1e293b" }}>
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
    );
  }

  function ResultBox({ dose, productName, bg, color }: { dose: number; productName: string; bg: string; color: string }) {
    if (dose <= 0) return (
      <div style={{ marginTop: 6, background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#065f46" }}>
        ✓ Zielwert erreicht
      </div>
    );
    return (
      <div style={{ marginTop: 6, background: bg, borderRadius: 8, padding: "8px 12px" }}>
        <span style={{ fontWeight: 800, fontSize: "1.05rem", color }}>{dose} g</span>
        <span style={{ fontSize: "0.72rem", color: "#475569", marginLeft: 6 }}>{productName}</span>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 16, fontSize: "0.95rem" }}>
        ⚗️ Dosierrechner
        <span style={{ fontWeight: 400, fontSize: "0.73rem", color: "#94a3b8", marginLeft: 8 }}>{volumeLiters} L</span>
      </div>

      {/* ── Chlor Granulat (Schnellkorrektur) ──────────────────── */}
      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 12px 10px", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#15803d", marginBottom: 8 }}>
          🟢 Schnellkorrektur — Chlor Granulat
        </div>
        <SliderRow label="Aktuell" value={clCurrent} onChange={setClCurrent} min={0}   max={5}   step={0.1} unit=" mg/l" />
        <SliderRow label="Ziel"    value={clTarget}  onChange={setClTarget}  min={0}   max={5}   step={0.1} unit=" mg/l" />
        {clDelta < -0.05 ? (
          <div style={{ marginTop: 6, background: "#fef9c3", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#713f12" }}>
            ⏳ Abbauwarten — Abdeckung öffnen, Pool 24–48 Std. lüften
          </div>
        ) : (
          <>
            <ResultBox dose={clDose} productName="Steinbach Chlor Granulat Schnelllöslich" bg="#dcfce7" color="#15803d" />
            {clDose > 0 && <WaitBadge text="Pumpe 30 Min. → prüfen wenn Cl unter 5 mg/l (bei Stoßchl.: 24–48 Std. Badepause)" />}
          </>
        )}
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 6 }}>
          Zielbereich Kühlwasser-Pool: 0,5–1,5 mg/l · Immer pH zuerst korrigieren
        </div>
      </div>

      {/* ── Total Blue (Dauerchlorierung) ───────────────────────── */}
      <div style={{ background: "#eff6ff", borderRadius: 12, padding: "12px 12px 10px", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#1d4ed8", marginBottom: 6 }}>
          🔵 Dauerchlorierung — Total Blue 20g
        </div>
        <div style={{ fontSize: "0.78rem", color: "#374151", lineHeight: 1.5, marginBottom: 6 }}>
          Tab in Dosierschwimmer geben — löst sich langsam auf.
        </div>
        <div style={{ background: "#dbeafe", borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1d4ed8" }}>1 Tab</span>
          <span style={{ fontSize: "0.72rem", color: "#475569", marginLeft: 6 }}>Steinbach Total Blue 20g alle 1–2 Wochen</span>
        </div>
        <WaitBadge text="Kein Badeverbot, aber 30 Min. nach dem Einlegen abwarten" />
        <div style={{ marginTop: 8, background: "#fef3c7", borderRadius: 8, padding: "8px 10px", fontSize: "0.68rem", color: "#92400e", lineHeight: 1.5 }}>
          ⚠️ Trichlor-Tabs enthalten Isocyanursäure (CYA). Bei kühlem Wasser ist die Chlorstabilität höher — Cl regelmäßig messen und Einlegeintervall anpassen. Alle 3–4 Monate Teilwasserwechsel empfohlen.
        </div>
      </div>

      {/* ── pH ─────────────────────────────────────────────────── */}
      <div style={{ background: "#f5f3ff", borderRadius: 12, padding: "12px 12px 10px", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#6d28d9", marginBottom: 8 }}>
          🟣 pH-Wert
        </div>
        <SliderRow label="Aktuell" value={phCurrent} onChange={setPhCurrent} min={6.5} max={8.5} step={0.1} unit="" />
        <SliderRow label="Ziel"    value={phTarget}  onChange={setPhTarget}  min={6.5} max={8.5} step={0.1} unit="" />
        {phPlusDose  > 0 && (
          <>
            <ResultBox dose={phPlusDose}  productName="pH-Plus einrühren"  bg="#ede9fe" color="#5b21b6" />
            <WaitBadge text="Pumpe 30 Min. → 1 Std. Badepause → pH nachmessen" />
          </>
        )}
        {phMinusDose > 0 && (
          <>
            <ResultBox dose={phMinusDose} productName="pH-Minus einrühren" bg="#fce7f3" color="#9d174d" />
            <WaitBadge text="Pumpe 30 Min. → 4 Std. Badepause → pH nachmessen" />
          </>
        )}
        {phPlusDose === 0 && phMinusDose === 0 && (
          <div style={{ marginTop: 6, background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#065f46" }}>
            ✓ Zielwert erreicht
          </div>
        )}
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 6 }}>
          Zielbereich Pool: 7,2–7,6 · Erst pH korrigieren, dann Chlor zugeben
        </div>
      </div>

      {/* ── Alkalinität KH ─────────────────────────────────────── */}
      <div style={{ background: "#f0fdf4", borderRadius: 12, padding: "12px 12px 10px", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#065f46", marginBottom: 8 }}>
          🟤 Alkalinität (KH)
        </div>
        <SliderRow label="Aktuell" value={khCurrent} onChange={setKhCurrent} min={20}  max={250} step={5}  unit=" mg/l" />
        <SliderRow label="Ziel"    value={khTarget}  onChange={setKhTarget}  min={80}  max={120} step={5}  unit=" mg/l" />
        {khTooHigh ? (
          <div style={{ marginTop: 6, background: "#fef9c3", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#713f12" }}>
            ⚠️ KH zu hoch: Teilwasserwechsel empfohlen. Keine Chemikalien zur KH-Senkung im Pool.
          </div>
        ) : khDose > 0 ? (
          <>
            <div style={{ marginTop: 6, background: "#d1fae5", borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#065f46" }}>{khDose} g</span>
              <span style={{ fontSize: "0.72rem", color: "#475569", marginLeft: 6 }}>Natriumhydrogencarbonat (Alkalinität-Plus)</span>
            </div>
            <WaitBadge text="Pumpe 30 Min. → 2 Std. warten → KH + pH nachmessen" />
          </>
        ) : (
          <div style={{ marginTop: 6, background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#065f46" }}>
            ✓ Alkalinität im Zielbereich
          </div>
        )}
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 6 }}>
          Zielbereich Pool: 80–120 mg/l · Nach Zugabe pH ebenfalls prüfen
        </div>
      </div>

      {/* ── Gesamthärte GH ─────────────────────────────────────── */}
      <div style={{ background: "#fdf2f8", borderRadius: 12, padding: "12px 12px 10px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#9d174d", marginBottom: 8 }}>
          🩷 Gesamthärte (GH)
        </div>
        <SliderRow label="Aktuell" value={ghCurrent} onChange={setGhCurrent} min={50}  max={500} step={10} unit=" mg/l" />
        <SliderRow label="Ziel"    value={ghTarget}  onChange={setGhTarget}  min={100} max={200} step={10} unit=" mg/l" />
        {ghTooHigh ? (
          <div style={{ marginTop: 6, background: "#fef9c3", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#713f12" }}>
            ⚠️ GH zu hoch: Kalkausfällungen möglich. Teilwasserwechsel empfohlen.
          </div>
        ) : ghDose > 0 ? (
          <>
            <div style={{ marginTop: 6, background: "#fce7f3", borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#9d174d" }}>{ghDose} g</span>
              <span style={{ fontSize: "0.72rem", color: "#475569", marginLeft: 6 }}>Calciumchlorid-Granulat (GH-Plus)</span>
            </div>
            <WaitBadge text="Pumpe 30 Min. → 1 Std. Badepause → GH + pH nachmessen" />
          </>
        ) : (
          <div style={{ marginTop: 6, background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#065f46" }}>
            ✓ Gesamthärte im Zielbereich
          </div>
        )}
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 6 }}>
          Zielbereich Pool: 100–200 mg/l · Zu weiches Wasser greift Heizung und Dichtungen an
        </div>
      </div>

      <div style={{ fontSize: "0.65rem", color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
        ⚠️ Richtwerte für Steinbach-Produkte. Herstellerangaben auf der Verpackung beachten.
      </div>
    </div>
  );
}
