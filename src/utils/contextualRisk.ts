import type { PoolEntry } from "../hooks/usePoolEntries";
import { LIMITS, type ActiveLimits } from "./constants";

// ── Öffentliche Typen ─────────────────────────────────────────────────────────

export interface RiskAssessment {
  overallRisk: "safe" | "caution" | "danger";
  reasons: string[];
  urgentActions: string[];
  retestIn: number;   // Minuten bis zur nächsten empfohlenen Messung
}

// ── Temperatur-Schwellenwerte ─────────────────────────────────────────────────

/** Mindest-Chlorgehalt in mg/l — steigt exponentiell mit der Wassertemperatur */
export const minChlorByTemp = (temp: number): number => {
  if (temp <= 26) return 0.3;
  if (temp <= 30) return 0.6;
  if (temp <= 34) return 1.0;
  if (temp <= 37) return 1.5;
  return 2.0; // über 37°C
};

/** Empfohlenes Nachmessintervall in Minuten */
export const retestIntervalByTemp = (temp: number): number => {
  if (temp <= 26) return 1440; // 24 Stunden
  if (temp <= 30) return 720;  // 12 Stunden
  if (temp <= 34) return 240;  //  4 Stunden
  if (temp <= 37) return 120;  //  2 Stunden
  return 60;                   //  1 Stunde
};

/** Formatiert Minuten als lesbare Zeitspanne (z.B. "2 Stunden" / "24 Stunden") */
export function formatRetestIn(minutes: number): string {
  if (minutes < 60)  return `${minutes} Minuten`;
  const h = minutes / 60;
  return h === 1 ? "1 Stunde" : `${h} Stunden`;
}

// ── Langelier Sättigungs-Index ────────────────────────────────────────────────

const TF_TABLE: [number, number][] = [
  [0, 0.00], [5, 0.07], [10, 0.13], [15, 0.21], [20, 0.30],
  [25, 0.38], [30, 0.47], [35, 0.56], [40, 0.65], [45, 0.73],
];

function tempFactor(temp: number): number {
  if (temp <= TF_TABLE[0][0]) return TF_TABLE[0][1];
  if (temp >= TF_TABLE[TF_TABLE.length - 1][0]) return TF_TABLE[TF_TABLE.length - 1][1];
  for (let i = 0; i < TF_TABLE.length - 1; i++) {
    const [t0, f0] = TF_TABLE[i];
    const [t1, f1] = TF_TABLE[i + 1];
    if (temp <= t1) return f0 + ((temp - t0) / (t1 - t0)) * (f1 - f0);
  }
  return TF_TABLE[TF_TABLE.length - 1][1];
}

/** LSI = pH + Tf(temp) + log₁₀(GH) + log₁₀(KH) − 12.1 */
export function calculateLSI(ph: number, temp: number, gh: number, kh: number): number {
  return ph + tempFactor(temp) + Math.log10(gh) + Math.log10(kh) - 12.1;
}

// ── Kern-Engine ───────────────────────────────────────────────────────────────

/** Bewertet das Risiko kontextabhängig — Temperatur wirkt als Multiplikator auf Chlor-Anforderungen.
 *  @param entry         Aktuelle Messung (neuester Eintrag)
 *  @param recentEntries Alle Einträge (inkl. entry), neuste zuerst — für Trend-Erkennung
 *  @param limits        Pool-typ-spezifische Grenzwerte (optional, Fallback: LIMITS)
 */
export function assessRisk(
  entry: PoolEntry,
  recentEntries: PoolEntry[] = [],
  limits?: ActiveLimits,
): RiskAssessment {
  const activeLimits = limits ?? LIMITS;
  const reasons: string[] = [];
  const urgentActions: string[] = [];
  let maxRisk: RiskAssessment["overallRisk"] = "safe";

  const promote = (to: RiskAssessment["overallRisk"]) => {
    if (to === "danger") maxRisk = "danger";
    else if (to === "caution" && maxRisk === "safe") maxRisk = "caution";
  };

  const { temp, cl, ph, cya, gh, kh } = entry;
  const tempMinCl = minChlorByTemp(temp);
  const cyaMinCl  = cya && cya > 0 ? cya / 15 : 0;
  const minCl     = Math.max(tempMinCl, cyaMinCl);

  // ── 1. Temperatur-Grenzwerte ────────────────────────────────────────────

  if (temp > 42) {
    // Kritisch — jenseits jeder Nutzung
    promote("danger");
    reasons.push(`🚨 Wassertemperatur ${temp.toFixed(0)}°C ist gefährlich hoch — Spa sofort ausschalten`);
    urgentActions.push("Spa sofort ausschalten und kontrolliert abkühlen lassen");

  } else if (temp >= 35) {
    // Legionellen-Wachstumsbereich 35–42°C
    if (cl < 1.5) {
      promote("danger");
      reasons.push(
        `🦠 Legionellen-Risiko: Bei ${temp.toFixed(0)}°C reicht Chlor unter 1,5 mg/l nicht aus ` +
        `(aktuell ${cl.toFixed(2)} mg/l)`
      );
      urgentActions.push("Chlor sofort auf ≥ 1,5 mg/l erhöhen — Spa NICHT benutzen");
    } else {
      promote("caution");
    }
    reasons.push(
      `🦠 Achtung: Wassertemperatur im Legionellen-Wachstumsbereich (35–42°C). ` +
      `Chlor muss mindestens 1,5 mg/l betragen. ` +
      `Nicht einatmen, nicht benutzen bis Temperatur unter 32°C.`
    );

  } else if (temp > 32) {
    promote("caution");
    reasons.push(`⚠️ Spa-Temperatur zu hoch (${temp.toFixed(0)}°C) — Nutzung nicht empfohlen`);
  }

  // ── 2. Chlor mit Temperatur-Kontext ────────────────────────────────────

  if (cl < minCl) {
    const deficit = (minCl - cl).toFixed(2);
    if (cl < minCl * 0.5) {
      promote("danger");
      reasons.push(
        `🚨 Chlor kritisch niedrig: Bei ${temp.toFixed(0)}°C mindestens ${minCl.toFixed(1)} mg/l nötig ` +
        `(aktuell ${cl.toFixed(2)} mg/l, Defizit: ${deficit} mg/l)`
      );
      urgentActions.push(`Chlor sofort auf ≥ ${minCl.toFixed(1)} mg/l erhöhen`);
    } else {
      promote("caution");
      reasons.push(
        `⚠️ Chlor zu niedrig für ${temp.toFixed(0)}°C: ` +
        `Mindestens ${minCl.toFixed(1)} mg/l empfohlen ` +
        `(aktuell ${cl.toFixed(2)} mg/l)`
      );
      if (!urgentActions.some(a => a.includes("Chlor"))) {
        urgentActions.push(`Chlor auf ≥ ${minCl.toFixed(1)} mg/l erhöhen`);
      }
    }
  }

  // Chlor zu hoch — obere Grenze aus activeLimits, damit Dot und Banner konsistent sind
  if (cl > activeLimits.cl.max) {
    if (cl > activeLimits.cl.max * 1.5) {
      promote("danger");
      reasons.push(
        `🚨 Chlor zu hoch (${cl.toFixed(2)} mg/l) — nicht sicher zum Baden. ` +
        `Maximum: ${activeLimits.cl.max} mg/l`
      );
      urgentActions.push("Wasser verdünnen oder Teilwasserwechsel vornehmen");
    } else {
      promote("caution");
      reasons.push(
        `⚠️ Chlor erhöht (${cl.toFixed(2)} mg/l) — Idealbereich: ` +
        `${activeLimits.cl.min}–${activeLimits.cl.max} mg/l`
      );
    }
  }

  // ── 3. Fallender Cl-Trend bei hoher Temperatur ─────────────────────────

  if (temp > 30 && recentEntries.length >= 3) {
    const asc  = recentEntries.slice(0, 5).reverse(); // älteste → neuste
    const vals  = asc.map(e => e.cl);
    const diffs = vals.slice(1).map((v, i) => v - vals[i]);
    const fallingCount = diffs.filter(d => d < -0.05).length;

    if (fallingCount >= Math.ceil(diffs.length * 0.6)) {
      const drops  = diffs.filter(d => d < 0);
      const avgDrop = drops.reduce((s, d) => s - d, 0) / drops.length;
      const interval = formatRetestIn(retestIntervalByTemp(temp));
      promote(temp > 34 ? "danger" : "caution");
      reasons.push(
        `⚠️ Chlor baut sich bei ${temp.toFixed(0)}°C schnell ab ` +
        `(sinkt Ø ${avgDrop.toFixed(2)} mg/l/Messung) — in ${interval} nachmessen`
      );
    }
  }

  // ── 4. pH-Kontext — Schwellen aus activeLimits für Konsistenz mit Dot-Indikator ──

  if (ph < activeLimits.ph.min) {
    promote("caution");
    reasons.push(
      `⚠️ pH zu niedrig (${ph.toFixed(2)}) — Wasser zu sauer, Hautreizungen möglich. ` +
      `Idealbereich: ${activeLimits.ph.min}–${activeLimits.ph.max}`
    );
    urgentActions.push(`pH mit pH-Plus auf ${activeLimits.ph.min}–${activeLimits.ph.max} anheben`);
  } else if (ph > activeLimits.ph.max) {
    promote("caution");
    reasons.push(
      `⚠️ pH zu hoch (${ph.toFixed(2)}) — Chlor verliert an Wirkung. ` +
      `Idealbereich: ${activeLimits.ph.min}–${activeLimits.ph.max}`
    );
    urgentActions.push(`pH mit pH-Minus auf ${activeLimits.ph.min}–${activeLimits.ph.max} absenken`);
    if (ph > 8.0 && temp > 30) {
      promote("danger");
      reasons.push(
        `🚨 pH ${ph.toFixed(2)} + Temperatur ${temp.toFixed(0)}°C: ` +
        `Chlor wirkt kaum noch — sofort korrigieren`
      );
    }
  }

  // ── 5. CYA / Stabilisator ──────────────────────────────────────────────

  if (cya != null && cya > 0) {
    if (cya > 100) {
      promote("danger");
      reasons.push(
        `🚨 Stabilisator (CYA) zu hoch (${cya} mg/l) — Chlor-Lock: Chlor wirkt kaum noch. ` +
        `Teilwasserwechsel nötig (Ziel: 30–50 mg/l)`
      );
      urgentActions.push("30–50% Wasser ablassen und mit Frischwasser auffüllen");
    } else if (cya > 90) {
      promote("caution");
      reasons.push(
        `⚠️ Stabilisator (CYA) erhöht (${cya} mg/l) — Chlorwirkung reduziert. ` +
        `Idealbereich: 30–50 mg/l`
      );
    }
    if (cyaMinCl > tempMinCl && cl < cyaMinCl) {
      const needed = cyaMinCl.toFixed(1);
      promote("caution");
      reasons.push(
        `⚠️ Bei CYA=${cya} mg/l mindestens ${needed} mg/l freies Chlor nötig ` +
        `(CYA/15-Regel) — aktuell ${cl.toFixed(2)} mg/l`
      );
      urgentActions.push(`Chlor auf mindestens ${needed} mg/l erhöhen`);
    }
  }

  // ── 6. LSI — Langelier Sättigungs-Index ───────────────────────────────

  if (gh != null && kh != null && gh > 0 && kh > 0) {
    const lsi = calculateLSI(ph, temp, gh, kh);
    if (lsi < -0.5) {
      promote("danger");
      reasons.push(
        `🚨 LSI ${lsi.toFixed(2)}: Wasser stark korrosiv — greift Pumpe, Heizung und Dichtungen an. ` +
        `KH erhöhen (Ziel: 80–120 mg/l)`
      );
      urgentActions.push("KH (Alkalinität) erhöhen, um LSI in den Bereich −0,3 bis +0,3 zu bringen");
    } else if (lsi < -0.3) {
      promote("caution");
      reasons.push(
        `⚠️ LSI ${lsi.toFixed(2)}: Wasser leicht korrosiv — KH oder GH leicht erhöhen`
      );
    } else if (lsi > 0.5) {
      promote("danger");
      reasons.push(
        `🚨 LSI ${lsi.toFixed(2)}: Wasser stark kalkbildend — starke Ablagerungen an Heizung und Oberflächen.`
      );
      urgentActions.push("pH absenken oder KH reduzieren (Teilwasserwechsel)");
    } else if (lsi > 0.3) {
      promote("caution");
      reasons.push(
        `⚠️ LSI ${lsi.toFixed(2)}: Wasser leicht kalkbildend — Ablagerungen möglich`
      );
    }
  }

  // ── 7. Alles OK ───────────────────────────────────────────────────────

  if (maxRisk === "safe") {
    reasons.push(`Alle Werte sicher für ${temp.toFixed(0)}°C Wassertemperatur`);
  }

  return {
    overallRisk: maxRisk,
    reasons,
    urgentActions,
    retestIn: retestIntervalByTemp(temp),
  };
}
