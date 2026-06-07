import type { PoolEntry } from "../hooks/usePoolEntries";

// ── Typen ────────────────────────────────────────────────────────────────────

export interface CrossProfileInsight {
  type: "tap_to_spa" | "rain_to_spa" | "combined" | "info";
  title: string;
  body: string;
  confidence: number;   // 0–1  (1 = hohe Datenbasis)
  samplesUsed: number;
}

export interface LearnedCorrelation {
  id: string;
  profilePair: "tap_spa" | "rain_spa";
  field: "cl" | "ph";
  avgDelta: number;    // mittlerer Unterschied Spa − Quelle
  stdDev: number;
  samples: number;
  updatedAt: string;   // ISO-8601
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function sd(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = avg(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ── Korrelationsberechnung ───────────────────────────────────────────────────

/** Berechnet gelernte Korrelationen aus den drei Profilen.
 *  Wird in IndexedDB (Schlüssel "learned_correlations") gespeichert. */
export function computeCorrelations(
  spaEntries: PoolEntry[],
  tapEntries: PoolEntry[],
): LearnedCorrelation[] {
  const result: LearnedCorrelation[] = [];
  if (!spaEntries.length || !tapEntries.length) return result;

  const spaPhAvg = avg(spaEntries.map(e => e.ph));
  const spaClAvg = avg(spaEntries.map(e => e.cl));

  // pH-Delta: Spa Ø − Tap Ø
  const tapPhDeltas = tapEntries.map(e => spaPhAvg - e.ph);
  result.push({
    id: "tap_spa_ph",
    profilePair: "tap_spa",
    field: "ph",
    avgDelta: avg(tapPhDeltas),
    stdDev: sd(tapPhDeltas),
    samples: tapEntries.length,
    updatedAt: new Date().toISOString(),
  });

  // Cl-Delta: Spa Ø − Tap Ø
  const tapClDeltas = tapEntries.map(e => spaClAvg - e.cl);
  result.push({
    id: "tap_spa_cl",
    profilePair: "tap_spa",
    field: "cl",
    avgDelta: avg(tapClDeltas),
    stdDev: sd(tapClDeltas),
    samples: tapEntries.length,
    updatedAt: new Date().toISOString(),
  });

  return result;
}

// ── Insights-Generierung ─────────────────────────────────────────────────────

/** Erzeugt verständliche Insights aus den drei Wasserprofilen. */
export function analyzeProfiles(
  spaEntries: PoolEntry[],
  tapEntries: PoolEntry[],
  rainEntries: PoolEntry[],
): CrossProfileInsight[] {
  const insights: CrossProfileInsight[] = [];

  // ── Leitungswasser ────────────────────────────────────────────────────────

  if (tapEntries.length === 0) {
    insights.push({
      type: "info",
      title: "Leitungswasser noch nicht erfasst",
      body: "Trage deinen Leitungswasser-pH und -Chlorgehalt ein. AquaLog kann dann vorhersagen, wie sich ein Wasserwechsel auf deinen Spa auswirkt.",
      confidence: 0,
      samplesUsed: 0,
    });
  } else {
    const tapPhAvg = avg(tapEntries.map(e => e.ph));
    const tapClAvg = avg(tapEntries.map(e => e.cl));
    const spaPhAvg = spaEntries.length ? avg(spaEntries.map(e => e.ph)) : null;

    const n = tapEntries.length;
    let body = `Dein Leitungswasser: Ø pH ${tapPhAvg.toFixed(2)} · Ø Cl ${tapClAvg.toFixed(2)} mg/l (${n} Messung${n > 1 ? "en" : ""}).`;

    if (spaPhAvg !== null) {
      const phDiff = spaPhAvg - tapPhAvg;
      if (phDiff > 0.3) {
        body += ` Das Leitungswasser ist saurer als dein Spa (Spa Ø pH ${spaPhAvg.toFixed(2)}). Nach einem Wasserwechsel wird der pH leicht sinken — pH-Plus bereithalten.`;
      } else if (phDiff < -0.3) {
        body += ` Das Leitungswasser hat einen höheren pH als dein Spa (Spa Ø ${spaPhAvg.toFixed(2)}). Nach dem Wasserwechsel kann der pH leicht steigen — ggf. pH-Minus bereithalten.`;
      } else {
        body += ` pH ähnlich wie dein Spa — beim Wasserwechsel ist kaum eine pH-Verschiebung zu erwarten.`;
      }
    }

    if (tapClAvg < 0.1) {
      body += " Leitungswasser enthält kaum Chlor — nach dem Wasserwechsel Cl nachgeben.";
    }

    insights.push({
      type: "tap_to_spa",
      title: "Leitungswasser → Spa",
      body,
      confidence: Math.min(n / 5, 1),
      samplesUsed: n,
    });
  }

  // ── Regenwasser (explizite Einträge) ─────────────────────────────────────

  if (rainEntries.length === 0) {
    insights.push({
      type: "info",
      title: "Regenwasser noch nicht gemessen",
      body: "Optional: Miss den pH von Regenwasser in deiner Region. Regen hat typisch pH 5,5–6,5 und senkt den Spa-pH — besonders nach längerem Regen.",
      confidence: 0,
      samplesUsed: 0,
    });
  } else {
    const rainPhAvg = avg(rainEntries.map(e => e.ph));
    const spaPhAvg  = spaEntries.length ? avg(spaEntries.map(e => e.ph)) : null;
    const n = rainEntries.length;

    let body = `Gemessenes Regenwasser: Ø pH ${rainPhAvg.toFixed(2)} (${n} Messung${n > 1 ? "en" : ""}).`;

    if (spaPhAvg !== null) {
      if (rainPhAvg < 6.5) {
        body += ` Das ist deutlich saurer als dein Spa (Spa Ø pH ${spaPhAvg.toFixed(2)}). Starker Regen senkt deinen pH — nach Regentagen messen und ggf. pH-Plus zugeben.`;
      } else if (rainPhAvg < spaPhAvg - 0.2) {
        body += ` Leicht saurer als dein Spa (Spa Ø ${spaPhAvg.toFixed(2)}) — nach intensivem Regen pH prüfen.`;
      } else {
        body += ` pH liegt nahe deinem Spa-Wert — Regen hat bei dir kaum Einfluss auf den pH.`;
      }
    }

    insights.push({
      type: "rain_to_spa",
      title: "Regenwasser → Spa",
      body,
      confidence: Math.min(n / 3, 1),
      samplesUsed: n,
    });
  }

  // ── Regen-Effekt aus Spa-Messverlauf (rainMm in Spa-Einträgen) ───────────

  const rainySpas = spaEntries.filter(e => (e.rainMm ?? 0) >= 5);
  const drySpas   = spaEntries.filter(e => (e.rainMm ?? 0) < 1);

  if (rainySpas.length >= 2 && drySpas.length >= 2) {
    const avgRainyPh = avg(rainySpas.map(e => e.ph));
    const avgDryPh   = avg(drySpas.map(e => e.ph));
    const phDrop = avgDryPh - avgRainyPh;

    if (Math.abs(phDrop) >= 0.1) {
      const direction = phDrop > 0 ? `${phDrop.toFixed(2)} niedriger` : `${Math.abs(phDrop).toFixed(2)} höher`;
      const advice = phDrop > 0.2
        ? " Nach Regentagen pH prüfen und ggf. pH-Plus zugeben."
        : " Der Effekt ist gering — Regen hat bei dir wenig Einfluss.";
      insights.push({
        type: "rain_to_spa",
        title: "Regen-Effekt (aus Messverlauf)",
        body: `An deinen ${rainySpas.length} Regentagen war der Spa-pH Ø ${direction} als an trockenen Tagen (${avgDryPh.toFixed(2)} vs. ${avgRainyPh.toFixed(2)}).${advice}`,
        confidence: Math.min(rainySpas.length / 5, 0.9),
        samplesUsed: rainySpas.length + drySpas.length,
      });
    }
  }

  // ── Kombinations-Insight ──────────────────────────────────────────────────

  if (tapEntries.length >= 3 && (rainEntries.length >= 2 || rainySpas.length >= 3)) {
    insights.push({
      type: "combined",
      title: "Kombinations-Modell aktiv",
      body: "Du hast genug Daten für eine kombinierte Analyse. Bei gleichzeitigem Wasserwechsel und Regen können pH-Verschiebungen kumulieren. AquaLog berücksichtigt beide Effekte automatisch.",
      confidence: Math.min((tapEntries.length + rainySpas.length) / 10, 0.85),
      samplesUsed: tapEntries.length + rainySpas.length,
    });
  }

  return insights;
}

// ── Smart-Reminder-Logik ─────────────────────────────────────────────────────

export interface SmartReminder {
  id: string;
  severity: "info" | "warn";
  text: string;
}

/** Erzeugt Erinnerungen basierend auf Wetterdaten + Messstand */
export function getSmartReminders(
  spaEntries: PoolEntry[],
  tapEntries: PoolEntry[],
  lastRainMm: number,           // heutiger Niederschlag aus Wetter-API
): SmartReminder[] {
  const reminders: SmartReminder[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const last  = spaEntries[0];

  // Starkregen gestern / heute → pH prüfen
  if (lastRainMm >= 10) {
    const lastDate = last?.date ?? "";
    if (lastDate < today) {
      reminders.push({
        id: "heavy_rain",
        severity: "warn",
        text: `🌧️ ${lastRainMm.toFixed(0)} mm Regen heute — pH im Spa prüfen (Regen ist sauer und senkt den pH).`,
      });
    }
  } else if (lastRainMm >= 3) {
    reminders.push({
      id: "light_rain",
      severity: "info",
      text: `🌦️ ${lastRainMm.toFixed(0)} mm Regen — nach dem nächsten Spa-Besuch pH kontrollieren.`,
    });
  }

  // Kein Leitungswasser-Profil → Onboarding-Tipp
  if (tapEntries.length === 0) {
    reminders.push({
      id: "no_tap_data",
      severity: "info",
      text: "💡 Messe deinen Leitungswasser-pH — dann kann AquaLog Wasserwechsel-Auswirkungen vorhersagen.",
    });
  }

  return reminders;
}
