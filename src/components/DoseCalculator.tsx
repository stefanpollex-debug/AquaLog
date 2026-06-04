import { useState } from "react";
import { calcDose } from "../utils/dosage";

interface Props {
  volumeLiters: number;
  currentCl?: number;
  currentPh?: number;
}

export function DoseCalculator({ volumeLiters, currentCl, currentPh }: Props) {
  const volumeM3 = volumeLiters / 1000;

  const [clCurrent, setClCurrent] = useState(currentCl ?? 0.5);
  const [clTarget,  setClTarget]  = useState(1.0);
  const [phCurrent, setPhCurrent] = useState(currentPh ?? 7.5);
  const [phTarget,  setPhTarget]  = useState(7.2);

  const clDelta      = clTarget - clCurrent;
  const phDelta      = phTarget - phCurrent;
  const phSteps      = Math.abs(phDelta) / 0.1;
  const clDose       = clDelta  >  0.05 ? calcDose("chlor",    clDelta,  volumeM3) : 0;
  const phPlusDose   = phDelta  >  0.05 ? calcDose("ph_plus",  phSteps,  volumeM3) : 0;
  const phMinusDose  = phDelta  < -0.05 ? calcDose("ph_minus", phSteps,  volumeM3) : 0;

  // Total Blue: Steinbach empfiehlt 1 Tab (20g) pro ~1000L pro Woche im Dosierschwimmer
  const totalBlueTabs = Math.max(1, Math.round(volumeLiters / 1000));

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
          {value.toFixed(1)}{unit}
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
        <SliderRow label="Aktuell" value={clCurrent} onChange={setClCurrent} min={0}   max={3}   step={0.1} unit=" mg/l" />
        <SliderRow label="Ziel"    value={clTarget}  onChange={setClTarget}  min={0}   max={3}   step={0.1} unit=" mg/l" />
        {clDelta < -0.05 ? (
          <div style={{ marginTop: 6, background: "#fef9c3", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#713f12" }}>
            ⏳ Abbauwarten — Abdeckung öffnen, Pool lüften
          </div>
        ) : (
          <ResultBox dose={clDose} productName="Steinbach Chlor Granulat Schnelllöslich" bg="#dcfce7" color="#15803d" />
        )}
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
          <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1d4ed8" }}>{totalBlueTabs} Tab</span>
          <span style={{ fontSize: "0.72rem", color: "#475569", marginLeft: 6 }}>Steinbach Total Blue 20g pro Woche</span>
        </div>
        <div style={{ fontSize: "0.65rem", color: "#94a3b8", marginTop: 6 }}>
          Nach 3–4 Tagen Cl messen und ggf. nachjustieren
        </div>
      </div>

      {/* ── pH ─────────────────────────────────────────────────── */}
      <div style={{ background: "#f5f3ff", borderRadius: 12, padding: "12px 12px 10px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#6d28d9", marginBottom: 8 }}>
          🟣 pH-Wert
        </div>
        <SliderRow label="Aktuell" value={phCurrent} onChange={setPhCurrent} min={6.0} max={9.0} step={0.1} unit="" />
        <SliderRow label="Ziel"    value={phTarget}  onChange={setPhTarget}  min={6.0} max={9.0} step={0.1} unit="" />
        {phPlusDose  > 0 && <ResultBox dose={phPlusDose}  productName="pH-Plus einrühren"  bg="#ede9fe" color="#5b21b6" />}
        {phMinusDose > 0 && <ResultBox dose={phMinusDose} productName="pH-Minus einrühren" bg="#fce7f3" color="#9d174d" />}
        {phPlusDose === 0 && phMinusDose === 0 && (
          <div style={{ marginTop: 6, background: "#d1fae5", borderRadius: 8, padding: "7px 10px", fontSize: "0.75rem", color: "#065f46" }}>
            ✓ Zielwert erreicht
          </div>
        )}
      </div>

      <div style={{ fontSize: "0.65rem", color: "#94a3b8", textAlign: "center", lineHeight: 1.5 }}>
        ⚠️ Richtwerte für Steinbach-Produkte. Herstellerangaben auf der Verpackung beachten.
      </div>
    </div>
  );
}
