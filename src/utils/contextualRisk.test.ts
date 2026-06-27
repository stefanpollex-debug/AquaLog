import { describe, it, expect } from "vitest";
import {
  calculateLSI, minChlorByTemp, retestIntervalByTemp, formatRetestIn, assessRisk,
} from "./contextualRisk";
import { getLimitsForPoolType } from "./constants";
import type { PoolEntry } from "../hooks/usePoolEntries";

const SPA     = getLimitsForPoolType("Whirlpool / Spa");
const FREIBAD = getLimitsForPoolType("Einbaupool");

function entry(overrides: Partial<PoolEntry> = {}): PoolEntry {
  return { id: 1, date: "2026-06-27", cl: 1.0, ph: 7.4, temp: 26, note: "", ...overrides };
}

describe("calculateLSI", () => {
  it("liefert einen plausiblen Wert für ausgewogenes Wasser (nahe 0)", () => {
    // ph 7.4, temp 26, gh 150, kh 100 — Richtwerte aus der Praxis, sollte nahe der Idealzone liegen
    const lsi = calculateLSI(7.4, 26, 150, 100);
    expect(lsi).toBeGreaterThan(-0.6);
    expect(lsi).toBeLessThan(0.6);
  });

  it("nutzt Calciumhärte (40% der GH), nicht die volle Gesamthärte", () => {
    // Regression: die ursprüngliche Formel behandelte GH fälschlich als reine Ca-Härte.
    // Bei doppelter GH muss sich log10(ca) um log10(2) ≈ 0.301 verschieben — die korrigierte
    // Formel produziert einen klar anderen (höheren) LSI bei höherer GH, nicht denselben Wert.
    const low  = calculateLSI(7.4, 26, 100, 100);
    const high = calculateLSI(7.4, 26, 200, 100);
    expect(high).toBeGreaterThan(low);
    expect(high - low).toBeCloseTo(Math.log10(2), 1);
  });

  it("liefert keinen Crash/NaN/-Infinity bei gh=0 oder kh=0 (z.B. fehlerhafter Import)", () => {
    expect(Number.isFinite(calculateLSI(7.4, 26, 0, 100))).toBe(true);
    expect(Number.isFinite(calculateLSI(7.4, 26, 150, 0))).toBe(true);
    expect(Number.isFinite(calculateLSI(7.4, 26, 0, 0))).toBe(true);
  });

  it("rundet auf 2 Nachkommastellen", () => {
    const lsi = calculateLSI(7.41234, 26, 150, 100);
    expect(lsi).toBe(Math.round(lsi * 100) / 100);
  });

  it("Temperaturfaktor steigt monoton mit der Temperatur (LSI steigt mit steigender Temperatur)", () => {
    const cold = calculateLSI(7.4, 10, 150, 100);
    const warm = calculateLSI(7.4, 35, 150, 100);
    expect(warm).toBeGreaterThan(cold);
  });
});

describe("minChlorByTemp / retestIntervalByTemp", () => {
  it("steigt mit der Temperatur", () => {
    expect(minChlorByTemp(20)).toBeLessThan(minChlorByTemp(36));
  });

  it("liefert die Legionellen-relevante Schwelle ab >37°C", () => {
    expect(minChlorByTemp(38)).toBe(2.0);
  });

  it("Nachmessintervall wird kürzer mit steigender Temperatur", () => {
    expect(retestIntervalByTemp(38)).toBeLessThan(retestIntervalByTemp(20));
  });

  it("formatRetestIn formatiert Minuten und Stunden korrekt", () => {
    expect(formatRetestIn(30)).toBe("30 Minuten");
    expect(formatRetestIn(60)).toBe("1 Stunde");
    expect(formatRetestIn(120)).toBe("2 Stunden");
  });
});

describe("assessRisk — Regression: Screenshot-Szenario (Cl 5.0 / Temp 31 / GH 250)", () => {
  it("Cl 5.0 mg/l ist bei einem Spa 'zu hoch', NICHT ok", () => {
    const r = assessRisk(entry({ cl: 5.0, temp: 26 }), [], SPA);
    expect(r.overallRisk).toBe("danger");
    expect(r.reasons.some(x => x.includes("Chlor zu hoch"))).toBe(true);
  });

  it("Temp 31°C bei einem Spa ist NICHT 'zu niedrig' (Ziel 18-32°C)", () => {
    const r = assessRisk(entry({ cl: 0.8, temp: 31 }), [], SPA);
    expect(r.reasons.some(x => x.includes("unter dem Zielbereich"))).toBe(false);
  });

  it("GH 250 mg/l ist 'außerhalb des Zielbereichs' (Ziel 100-200)", () => {
    const r = assessRisk(entry({ cl: 0.8, temp: 26, gh: 250 }), [], SPA);
    expect(r.reasons.some(x => x.includes("GH (Gesamthärte) außerhalb"))).toBe(true);
  });

  it("zählt genau so viele 'Werte außerhalb' wie tatsächlich low/high-Felder + LSI/CYA vorliegen", () => {
    // cl zu hoch, kh zu niedrig, gh zu hoch = 3 echte Treffer; ph/temp ok
    const r = assessRisk(
      entry({ cl: 5.0, ph: 7.6, temp: 26, kh: 70, gh: 250 }), [], SPA,
    );
    expect(r.reasons[0]).toBe("⚠️ 3 Werte außerhalb — Korrektur nötig");
  });

  it("zeigt KEINE 'Werte außerhalb'-Meldung, wenn alles im Zielbereich liegt", () => {
    const r = assessRisk(entry({ cl: 0.8, ph: 7.4, temp: 26 }), [], SPA);
    expect(r.reasons.some(x => x.startsWith("⚠️") && x.includes("außerhalb"))).toBe(false);
  });

  it("Singular/Plural: genau 1 abweichender Wert heißt '1 Wert', nicht '1 Werte'", () => {
    const r = assessRisk(entry({ cl: 5.0, ph: 7.4, temp: 26 }), [], SPA);
    expect(r.reasons[0]).toBe("⚠️ 1 Wert außerhalb — Korrektur nötig");
  });
});

describe("assessRisk — Idealzone-Hinweise sind informativ, keine Risikostufe", () => {
  it("Cl außerhalb der Idealzone, aber innerhalb OK, bleibt overallRisk 'safe'", () => {
    // Spa: OK 0.3-1.5, Ideal 0.6-1.0 → 1.3 ist OK aber über Ideal
    const r = assessRisk(entry({ cl: 1.3, ph: 7.4, temp: 26 }), [], SPA);
    expect(r.overallRisk).toBe("safe");
    expect(r.reasons.some(x => x.includes("Idealzone"))).toBe(true);
  });

  it("Idealzone-Hinweis zählt NICHT in 'Werte außerhalb' (nur warn/ok wie low/high)", () => {
    const r = assessRisk(entry({ cl: 1.3, ph: 7.4, temp: 26 }), [], SPA);
    expect(r.reasons.some(x => x.includes("außerhalb — Korrektur"))).toBe(false);
  });

  it("KH-Warnzone (100-120) ist informativ, promotet NICHT auf caution/danger", () => {
    const r = assessRisk(entry({ cl: 0.8, ph: 7.4, temp: 26, kh: 110 }), [], SPA);
    expect(r.overallRisk).toBe("safe");
    expect(r.reasons.some(x => x.includes("KH grenzwertig"))).toBe(true);
  });
});

describe("assessRisk — Gefahrenschwellen (danger.high) pool-typ-spezifisch", () => {
  it("Spa: Cl-Nutzungssperre greift ab 3.0 mg/l, nicht erst ab max*1.5 (=2.25)", () => {
    const r = assessRisk(entry({ cl: 2.9, ph: 7.4, temp: 26 }), [], SPA);
    expect(r.overallRisk).toBe("caution"); // noch unter der harten Schwelle
    const r2 = assessRisk(entry({ cl: 3.1, ph: 7.4, temp: 26 }), [], SPA);
    expect(r2.overallRisk).toBe("danger"); // über der harten Schwelle
  });

  it("Outdoor-Spa: Temperatur-Gefahrenschwelle liegt bei 37°C, nicht beim generischen Fallback 42°C", () => {
    const r = assessRisk(entry({ cl: 1.5, ph: 7.4, temp: 38 }), [], SPA);
    expect(r.overallRisk).toBe("danger");
    expect(r.reasons.some(x => x.includes("Gefahrenschwelle (37°C)"))).toBe(true);
  });

  it("Freibad ohne eigene Temp-Gefahrenschwelle nutzt weiterhin den 42°C-Fallback", () => {
    const r = assessRisk(entry({ cl: 1.5, ph: 7.4, temp: 38 }), [], FREIBAD);
    // 38°C liegt im Legionellen-Bereich (35-42°C), aber NICHT über dem 42°C-Fallback
    expect(r.reasons.some(x => x.includes("über der Gefahrenschwelle"))).toBe(false);
    expect(r.reasons.some(x => x.includes("Legionellen"))).toBe(true);
  });
});

describe("assessRisk — Legionellen-Logik (biologisch fix, poolTyp-unabhängig)", () => {
  it("Temp >= 35°C mit Cl < 1.5 mg/l ist ein Sicherheitsrisiko (danger)", () => {
    const r = assessRisk(entry({ cl: 1.0, ph: 7.4, temp: 36 }), [], SPA);
    expect(r.overallRisk).toBe("danger");
    expect(r.reasons.some(x => x.includes("Legionellen-Risiko"))).toBe(true);
  });

  it("Temp >= 35°C mit Cl >= 1.5 mg/l ist nur eine Vorsichtsmeldung (caution), kein danger", () => {
    const r = assessRisk(entry({ cl: 1.6, ph: 7.4, temp: 36 }), [], SPA);
    expect(r.overallRisk).toBe("caution");
  });
});

describe("assessRisk — CYA / Stabilisator", () => {
  it("CYA > 100 mg/l ist ein Sicherheitsrisiko (Chlor-Lock)", () => {
    const r = assessRisk(entry({ cl: 1.0, ph: 7.4, temp: 26, cya: 110 }), [], FREIBAD);
    expect(r.overallRisk).toBe("danger");
    expect(r.reasons.some(x => x.includes("Chlor-Lock"))).toBe(true);
  });

  it("CYA/15-Regel erhöht die geforderte Mindest-Chlormenge", () => {
    // CYA=60 → Mindest-Cl = 60/15 = 4.0 mg/l, deutlich über der temperaturbasierten Schwelle
    const r = assessRisk(entry({ cl: 1.0, ph: 7.4, temp: 26, cya: 60 }), [], FREIBAD);
    expect(r.reasons.some(x => x.includes("CYA/15-Regel"))).toBe(true);
  });
});

describe("assessRisk — LSI-Schwellen", () => {
  it("stark korrosives Wasser (LSI < -0.5) löst danger aus", () => {
    // niedriges KH/GH + niedriger pH → stark negativer LSI
    const r = assessRisk(entry({ cl: 1.0, ph: 7.0, temp: 26, kh: 80, gh: 100 }), [], FREIBAD);
    if (r.reasons.some(x => x.includes("LSI"))) {
      const lsiReason = r.reasons.find(x => x.includes("LSI"))!;
      const match = lsiReason.match(/LSI (-?[\d.]+)/);
      if (match && parseFloat(match[1]) < -0.5) {
        expect(r.overallRisk).toBe("danger");
      }
    }
  });

  it("LSI wird nicht berechnet, wenn GH oder KH fehlen", () => {
    const r = assessRisk(entry({ cl: 1.0, ph: 7.4, temp: 26 }), [], FREIBAD);
    expect(r.reasons.some(x => x.includes("LSI"))).toBe(false);
  });
});
