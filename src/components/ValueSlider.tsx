import { LIMITS, type FieldKey, type ActiveLimits } from "../utils/constants";
import { getStatus } from "../utils/status";
import { StatusBadge } from "./StatusBadge";

interface Props {
  field: FieldKey;
  value: number;
  touched: boolean;
  onChange: (v: number) => void;
  limits?: ActiveLimits;
}

export function ValueSlider({ field, value, touched, onChange, limits }: Props) {
  const base = LIMITS[field];           // step, sliderMin, sliderMax, unit, label, color
  const l    = (limits ?? LIMITS)[field]; // min, max (pool-type-aware)
  const pct = ((value - base.sliderMin) / (base.sliderMax - base.sliderMin)) * 100;
  const okL = ((l.min  - base.sliderMin) / (base.sliderMax - base.sliderMin)) * 100;
  const okR = ((l.max  - base.sliderMin) / (base.sliderMax - base.sliderMin)) * 100;
  const st  = getStatus(field, value, limits);
  const thumb = st === "ok" ? "#22c55e" : st === "low" ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: "1.15rem", color: touched ? "#1e293b" : "#94a3b8" }}>
          {touched ? `${value.toFixed(1)}${base.unit}` : "— nicht gesetzt"}
        </span>
        {touched
          ? <StatusBadge status={st} />
          : <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>Slider bewegen zum Setzen</span>
        }
      </div>
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: 8, borderRadius: 8, overflow: "hidden",
          background: `linear-gradient(to right,#fee2e2 0%,#fee2e2 ${okL}%,#d1fae5 ${okL}%,#d1fae5 ${okR}%,#fee2e2 ${okR}%,#fee2e2 100%)`,
          opacity: touched ? 1 : 0.4,
        }} />
        {touched && (
          <div style={{
            position: "absolute", left: 0, width: `${pct}%`, height: 8, borderRadius: 8,
            background: thumb, transition: "width 0.1s, background 0.2s", opacity: 0.75,
          }} />
        )}
        <input
          type="range" min={base.sliderMin} max={base.sliderMax} step={base.step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, height: 28, cursor: "pointer", zIndex: 2 }}
        />
        <div style={{
          position: "absolute",
          left: touched ? `calc(${pct}% - 11px)` : "calc(50% - 11px)",
          width: 22, height: 22, borderRadius: "50%",
          background: touched ? thumb : "#cbd5e1",
          border: "3px solid white",
          boxShadow: touched ? `0 2px 8px ${thumb}88` : "0 1px 4px #0001",
          transition: "left 0.1s, background 0.2s", pointerEvents: "none", zIndex: 1,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
        <span>{base.sliderMin}{base.unit}</span>
        <span style={{ color: "#22c55e", fontWeight: 600 }}>OK: {l.min}–{l.max}</span>
        <span>{base.sliderMax}{base.unit}</span>
      </div>
    </div>
  );
}
