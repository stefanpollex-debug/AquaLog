import { type ChemicalAddition, type ChemProduct } from "../hooks/usePoolEntries";

interface Props {
  value:    ChemicalAddition[];
  onChange: (v: ChemicalAddition[]) => void;
}

interface ProductDef {
  id:            ChemProduct;
  label:         string;
  shortLabel:    string;
  emoji:         string;
  unit:          ChemicalAddition["unit"];
  defaultAmount: number;
  step:          number;
  color:         string;
  hint?:         string;
}

export const CHEM_PRODUCTS: ProductDef[] = [
  {
    id:            "chlor_granulat",
    label:         "Steinbach Chlor Granulat Schnelllöslich",
    shortLabel:    "Chlor Granulat",
    emoji:         "🟢",
    unit:          "g",
    defaultAmount: 5,
    step:          1,
    color:         "#16a34a",
  },
  {
    id:            "total_blue",
    label:         "Steinbach Total Blue 20g",
    shortLabel:    "Total Blue",
    emoji:         "🔵",
    unit:          "Tab",
    defaultAmount: 1,
    step:          1,
    color:         "#1d4ed8",
    hint:          "Dosierschwimmer — Langzeitchlor",
  },
  {
    id:            "ph_plus",
    label:         "pH-Plus",
    shortLabel:    "pH-Plus",
    emoji:         "⬆️",
    unit:          "g",
    defaultAmount: 20,
    step:          5,
    color:         "#7c3aed",
  },
  {
    id:            "ph_minus",
    label:         "pH-Minus",
    shortLabel:    "pH-Minus",
    emoji:         "⬇️",
    unit:          "g",
    defaultAmount: 20,
    step:          5,
    color:         "#be123c",
  },
  {
    id:            "algenmittel",
    label:         "Algenmittel (z.B. Desalgin® JET)",
    shortLabel:    "Algenmittel",
    emoji:         "🌿",
    unit:          "ml",
    defaultAmount: 2,
    step:          1,
    color:         "#16a34a",
    hint:          "Vorbeugend alle 1–2 Wochen",
  },
  {
    id:            "klaermittel",
    label:         "Klärmittel / Flockungsmittel",
    shortLabel:    "Klärmittel",
    emoji:         "💎",
    unit:          "ml",
    defaultAmount: 2,
    step:          1,
    color:         "#0369a1",
    hint:          "Bei trübem Wasser",
  },
];

export function ChemLogInput({ value, onChange }: Props) {
  const isActive = (id: ChemProduct) => value.some(c => c.product === id);

  const toggle = (id: ChemProduct) => {
    if (isActive(id)) {
      onChange(value.filter(c => c.product !== id));
    } else {
      const p = CHEM_PRODUCTS.find(p => p.id === id)!;
      onChange([...value, { product: id, amount: p.defaultAmount, unit: p.unit }]);
    }
  };

  const setAmount = (id: ChemProduct, raw: string) => {
    const amount = parseFloat(raw) || 0;
    onChange(value.map(c => c.product === id ? { ...c, amount } : c));
  };

  return (
    <div>
      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", marginBottom: 8 }}>
        🧪 Chemikalie zugegeben? <span style={{ fontWeight: 400 }}>(optional)</span>
      </div>

      {/* 2 × N Toggle-Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {CHEM_PRODUCTS.map(p => {
          const active = isActive(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              style={{
                border:     `1.5px solid ${active ? p.color : "#e2e8f0"}`,
                borderRadius: 10,
                padding:    "9px 10px",
                background: active ? p.color + "18" : "white",
                cursor:     "pointer",
                display:    "flex",
                alignItems: "center",
                gap:        6,
                textAlign:  "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>{p.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize:   "0.78rem",
                  fontWeight: active ? 700 : 500,
                  color:      active ? p.color : "#374151",
                  lineHeight: 1.2,
                }}>
                  {p.shortLabel}
                </div>
                {p.hint && (
                  <div style={{ fontSize: "0.6rem", color: "#94a3b8", marginTop: 1 }}>{p.hint}</div>
                )}
              </div>
              {active && (
                <span style={{ fontSize: "0.7rem", color: p.color, fontWeight: 700, flexShrink: 0 }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mengen-Eingabe für aktive Produkte */}
      {value.length > 0 && (
        <div style={{ marginTop: 10, background: "#f8fafc", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 8 }}>Menge anpassen:</div>
          {value.map(chem => {
            const p = CHEM_PRODUCTS.find(p => p.id === chem.product)!;
            return (
              <div key={chem.product} style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
              }}>
                <span style={{ fontSize: "0.9rem", flexShrink: 0 }}>{p.emoji}</span>
                <span style={{ flex: 1, fontSize: "0.78rem", color: "#374151" }}>{p.label}</span>
                <input
                  type="number"
                  value={chem.amount}
                  min={0}
                  step={p.step}
                  onChange={e => setAmount(chem.product, e.target.value)}
                  style={{
                    width: 56, border: "1.5px solid #e2e8f0", borderRadius: 8,
                    padding: "4px 6px", fontSize: "0.88rem", textAlign: "right",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "0.72rem", color: "#64748b", width: 22, flexShrink: 0 }}>
                  {chem.unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
