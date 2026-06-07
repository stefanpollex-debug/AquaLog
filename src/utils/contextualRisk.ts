import type { PoolEntry } from "../hooks/usePoolEntries";

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

// ── Kern-Engine ───────────────────────────────────────────────────────────────

/** Bewertet das Risiko kontextabhängig — Temperatur wirkt als Multiplikator auf Chlor-Anforderungen.
 *  @param entry         Aktuelle Messung (neuester Eintrag)
 *  @param recentEntries Alle Einträge (inkl. entry), neuste zuerst — für Trend-Erkennung
 */
export function assessRisk(
  entry: PoolEntry,
  recentEntries: PoolEntry[] = [],
): RiskAssessment {
  const reasons: string[] = [];
  const urgentActions: string[] = [];
  let maxRisk: RiskAssessment["overallRisk"] = "safe";

  const promote = (to: RiskAssessment["overallRisk"]) => {
    if (to === "danger") maxRisk = "danger";
    else if (to === "caution" && maxRisk === "safe") maxRisk = "caution";
  };

  const { temp, cl, ph } = entry;
  const minCl = minChlorByTemp(temp);

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

  // ── 4. pH-Kontext ─────────────────────────────────────────────────────

  if (ph < 7.0) {
    promote("caution");
    reasons.push(`⚠️ pH zu niedrig (${ph.toFixed(2)}) — Wasser zu sauer, Desinfektionswirkung reduziert`);
  } else if (ph > 7.8) {
    promote("caution");
    reasons.push(`⚠️ pH zu hoch (${ph.toFixed(2)}) — Chlor verliert bei hohem pH stark an Wirkung`);
    if (ph > 8.0 && temp > 30) {
      promote("danger");
      reasons.push(
        `🚨 pH ${ph.toFixed(2)} + Temperatur ${temp.toFixed(0)}°C: ` +
        `Chlor wirkt kaum noch — sofort korrigieren`
      );
      urgentActions.push("pH mit pH-Minus sofort auf 7,2–7,6 senken");
    }
  }

  // ── 5. Alles OK ───────────────────────────────────────────────────────

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
