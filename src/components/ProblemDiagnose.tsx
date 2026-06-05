import { useState } from "react";

interface Problem {
  id:       string;
  symptom:  string;
  icon:     string;
  cause:    string;
  params:   string;    // welche Werte typischerweise außer Kontrolle
  action:   string[];  // konkrete Schritte
  severity: "warning" | "danger" | "info";
}

const PROBLEMS: Problem[] = [
  {
    id:       "green_water",
    symptom:  "Grünes Wasser",
    icon:     "🟢",
    severity: "danger",
    cause:    "Algenbefall — Chlor war zu lange zu niedrig oder pH zu hoch.",
    params:   "Cl < 0,3 mg/l · pH > 7,8 · keine regelmäßige Algenvorbeugung",
    action: [
      "pH auf 7,2–7,4 korrigieren (pH-Minus)",
      "Stoßchlorierung: Cl auf 5–10 mg/l anheben",
      "Pumpe 24 Std. laufen lassen",
      "Algenreste absaugen und Filterkartuschen reinigen",
      "Danach Algenmittel vorbeugend zugeben",
      "⏰ Badepause bis Cl wieder unter 1,5 mg/l",
    ],
  },
  {
    id:       "cloudy_water",
    symptom:  "Trübes / milchiges Wasser",
    icon:     "🌫️",
    severity: "warning",
    cause:    "pH außerhalb Bereich, Kalkfällung oder zu viele organische Partikel (Sonnencreme, Hautschuppen).",
    params:   "pH > 7,6 oder < 7,0 · GH > 200 mg/l · zu viele Badegäste",
    action: [
      "pH messen und auf 7,2–7,4 einstellen",
      "Klärmittel (Flockungsmittel) zugeben — gemäß Produktbeschriftung",
      "Filterpumpe 24 Std. laufen lassen, dann Filterkartuschen reinigen",
      "Bei Kalk: GH messen, ggf. Teilwasserwechsel",
    ],
  },
  {
    id:       "chlorine_smell",
    symptom:  "Chlorgeruch / gerötete Augen",
    icon:     "👁️",
    severity: "warning",
    cause:    "Chloramine (gebundenes Chlor) — nicht zu viel Chlor, sondern zu wenig freies Chlor gegenüber organischer Last.",
    params:   "pH < 7,2 · Cl scheinbar OK, aber gebundenes Cl hoch · nach starker Nutzung",
    action: [
      "pH prüfen — muss 7,2–7,4 sein",
      "Stoßchlorierung durchführen: Cl auf 5–10 mg/l anheben",
      "Abdeckung öffnen, Pumpe 30 Min. laufen lassen",
      "⏰ 24–48 Std. Badepause bis Cl unter 1,5 mg/l",
      "Danach regelmäßig nach jeder Nutzung lüften",
    ],
  },
  {
    id:       "foam",
    symptom:  "Schaum / Schaumbildung",
    icon:     "🫧",
    severity: "info",
    cause:    "Organische Stoffe im Wasser: Sonnencreme, Körperlotion, Haarpflegemittel, Waschmittelreste in Badebekleidung.",
    params:   "Kein direkter Messwert — nach starker Nutzung oder neuem Wasser",
    action: [
      "Schaum-Ex (Entschäumer) direkt auf die Schaumfläche geben",
      "Badebekleidung ohne Waschmittel vorspülen",
      "Vor dem Baden duschen",
      "Bei starkem Schaum: Teilwasserwechsel empfohlen",
      "Filterkartuschen reinigen — sie sind oft der Schaum-Speicher",
    ],
  },
  {
    id:       "brown_water",
    symptom:  "Braunes / gelbliches Wasser",
    icon:     "🟤",
    severity: "warning",
    cause:    "Oxidiertes Eisen oder Mangan aus dem Leitungswasser — sichtbar nach dem Befüllen oder nach Chlorzugabe.",
    params:   "Metallgehalt im Füllwasser · Chlor oxidiert die Metalle sichtbar",
    action: [
      "Metallfällungsmittel / Sequestrant zugeben (z.B. Bayrol Metalex oder ähnlich)",
      "Filterpumpe 24 Std. laufen lassen",
      "Filterkartuschen reinigen — Eisen setzt sich dort ab",
      "Beim nächsten Befüllen vorbeugend Metallentferner zugeben",
    ],
  },
  {
    id:       "scale",
    symptom:  "Kalkflecken / weißer Belag",
    icon:     "⬜",
    severity: "info",
    cause:    "Gesamthärte (GH) zu hoch und/oder pH zu hoch — Kalk fällt bei Wärme aus.",
    params:   "GH > 200 mg/l · pH > 7,6 · Temperatur erhöht Kalkausfällung",
    action: [
      "pH auf 7,2–7,4 senken (pH-Minus)",
      "GH messen — bei >200 mg/l Teilwasserwechsel",
      "Kalkschutz-Mittel (Sequestrant) vorbeugend zugeben",
      "Sichtbare Ablagerungen mit Kalkreiniger entfernen",
    ],
  },
  {
    id:       "algae_despite_cl",
    symptom:  "Algen trotz OK-Chlorwert",
    icon:     "🌱",
    severity: "warning",
    cause:    "CYA (Isocyanursäure aus Trichlor-Tabs) zu hoch — blockiert die Chlorwirkung trotz messbarem Chlorgehalt.",
    params:   "CYA > 50 mg/l · bei langer Nutzung von Total Blue / Trichlortabs",
    action: [
      "Teilwasserwechsel (30–50%) mit frischem Wasser",
      "Auf Chlorgranulat (CYA-frei) umsteigen statt Trichlor-Tabs",
      "pH und Cl neu einstellen",
      "Vorbeugend: alle 3–4 Monate Wasserwechsel bei Nutzung von Trichlortabs",
    ],
  },
];

const SEVERITY_COLORS = {
  danger:  { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", badge: "#ef4444" },
  warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", badge: "#f59e0b" },
  info:    { bg: "#f0f9ff", border: "#0ea5e9", text: "#0369a1", badge: "#0ea5e9" },
};

export function ProblemDiagnose() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 4, fontSize: "0.95rem" }}>
        🔍 Problem-Diagnose
      </div>
      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: 14, lineHeight: 1.5 }}>
        Symptom antippen → Ursache und Maßnahmen
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PROBLEMS.map(p => {
          const isOpen = open === p.id;
          const c = SEVERITY_COLORS[p.severity];
          return (
            <div key={p.id} style={{ borderRadius: 12, overflow: "hidden", border: `1.5px solid ${isOpen ? c.border : "#e2e8f0"}` }}>
              <button
                onClick={() => setOpen(isOpen ? null : p.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  background: isOpen ? c.bg : "white",
                  border: "none", padding: "11px 14px", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{p.icon}</span>
                <span style={{ flex: 1, fontWeight: isOpen ? 700 : 500, fontSize: "0.85rem", color: isOpen ? c.text : "#374151" }}>
                  {p.symptom}
                </span>
                <span style={{
                  fontSize: "0.85rem", color: "#94a3b8",
                  transition: "transform 0.2s", display: "inline-block",
                  transform: isOpen ? "rotate(180deg)" : "none",
                }}>▼</span>
              </button>

              {isOpen && (
                <div style={{ background: c.bg, borderTop: `1px solid ${c.border}20`, padding: "12px 14px" }}>
                  {/* Ursache */}
                  <div style={{ fontSize: "0.8rem", color: c.text, fontWeight: 600, marginBottom: 4 }}>
                    Wahrscheinliche Ursache
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#374151", lineHeight: 1.6 }}>
                    {p.cause}
                  </p>

                  {/* Parameter */}
                  <div style={{ background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: "0.68rem", color: "#64748b", lineHeight: 1.6 }}>
                    Typische Messwerte: {p.params}
                  </div>

                  {/* Maßnahmen */}
                  <div style={{ fontSize: "0.8rem", color: c.text, fontWeight: 600, marginBottom: 6 }}>
                    Maßnahmen
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
                    {p.action.map((step, i) => (
                      <li key={i} style={{ fontSize: "0.78rem", color: "#374151", lineHeight: 1.55 }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
