import { useState, useEffect } from "react";
import { type PoolProfile } from "../hooks/usePoolProfile";

interface Props {
  profile: PoolProfile;
  onSave: (p: PoolProfile) => void;
  onClose: () => void;
}

const POOL_TYPES   = ["Frame Pool", "Stahlwandpool", "Einbaupool", "Whirlpool / Spa", "Aufstellpool"];
const FILTER_TYPES = ["Kartuschenfilter", "Sandfilter", "Diatomeenerde", "Kein Filter"];
const SANITIZERS   = ["Chlor (Granulat)", "Salzelektrolyse", "Aktivsauerstoff", "Brom"];
const LOCATIONS    = ["Vollsonnig (>6h)", "Halbschattig (3–6h)", "Schattig (<3h)"];
const USAGE        = ["Täglich", "2–3× pro Woche", "Nur am Wochenende", "Gelegentlich"];

export function PoolProfileSheet({ profile, onSave, onClose }: Props) {
  const [form, setForm] = useState<PoolProfile>(profile);

  useEffect(() => { setForm(profile); }, [profile]);

  const upd = <K extends keyof PoolProfile>(key: K, val: PoolProfile[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const inputStyle: React.CSSProperties = {
    width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10,
    padding: "10px 12px", fontSize: "0.9rem", boxSizing: "border-box",
    background: "white",
  };

  function SelectRow({ label, field, opts }: { label: string; field: keyof PoolProfile; opts: string[] }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
          {label}
        </label>
        <select value={form[field] as string} onChange={(e) => upd(field, e.target.value)} style={inputStyle}>
          {opts.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 40 }} />

      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        maxWidth: 480, margin: "0 auto",
        background: "white", borderRadius: "22px 22px 0 0",
        padding: "0 20px 40px", zIndex: 50,
        maxHeight: "88vh", overflowY: "auto",
        animation: "slideUp 0.22s ease",
      }}>
        <style>{`@keyframes slideUp{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "#e2e8f0", margin: "14px auto 20px" }} />

        <div style={{ fontWeight: 800, fontSize: "1rem", color: "#1e293b", marginBottom: 20 }}>
          ⚙️ Pool-Profil
        </div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
            Pool-Name
          </label>
          <input type="text" value={form.name} onChange={(e) => upd("name", e.target.value)} style={inputStyle} />
        </div>

        {/* Volume */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: "0.73rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
            Wasservolumen (Liter)
          </label>
          <input
            type="number" value={form.volumeLiters}
            onChange={(e) => upd("volumeLiters", parseFloat(e.target.value) || 1000)}
            min={50} max={500000} step={50} style={inputStyle}
          />
          <div style={{ fontSize: "0.67rem", color: "#94a3b8", marginTop: 3 }}>
            Steht auf der Verpackung oder im Handbuch
          </div>
        </div>

        <SelectRow label="Poolart"                field="poolType"        opts={POOL_TYPES}   />
        <SelectRow label="Filtertyp"              field="filterType"      opts={FILTER_TYPES} />
        <SelectRow label="Desinfektionsmittel"    field="sanitizer"       opts={SANITIZERS}   />
        <SelectRow label="Standort (Sonne)"       field="location"        opts={LOCATIONS}    />
        <SelectRow label="Nutzungshäufigkeit"     field="usageFrequency"  opts={USAGE}        />

        <button
          onClick={() => { onSave(form); onClose(); }}
          style={{
            width: "100%", padding: 14, marginTop: 6,
            background: "linear-gradient(90deg,#0369a1,#0ea5e9)",
            color: "white", border: "none", borderRadius: 12,
            fontWeight: 700, fontSize: "1rem", cursor: "pointer",
          }}
        >
          ✓ Profil speichern
        </button>
      </div>
    </>
  );
}
