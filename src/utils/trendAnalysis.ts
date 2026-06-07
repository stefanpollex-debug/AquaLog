import { type PoolEntry } from "../hooks/usePoolEntries";
import { LIMITS, type FieldKey } from "./constants";
import { getStatus } from "./status";
import { minChlorByTemp, retestIntervalByTemp, formatRetestIn } from "./contextualRisk";

// ── Öffentliche Typen ─────────────────────────────────────────────

export type TrendSeverity = "good" | "info" | "warning" | "danger";
export type TrendType =
  | "value_trend"
  | "forecast"
  | "rain_correlation"
  | "usage_correlation"
  | "weekly_pattern";

export interface TrendResult {
  id:       string;
  type:     TrendType;
  severity: TrendSeverity;
  icon:     string;
  title:    string;
  message:  string;
  action?:  string;
}

// Mindestanzahl Einträge für die Analyse
export const MIN_ENTRIES = 5;

// ── Hilfsfunktionen ───────────────────────────────────────────────

const DAY_NAMES = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function daysBetween(d1: string, d2: string): number {
  return Math.abs(
    (new Date(d1 + "T12:00:00").getTime() - new Date(d2 + "T12:00:00").getTime()) / 86_400_000,
  );
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ── 1. Trend pro Messwert ─────────────────────────────────────────

function analyzeValueTrend(entries: PoolEntry[], field: FieldKey): TrendResult | null {
  const recent = entries.slice(0, 5);           // neuste 5
  if (recent.length < 3) return null;

  const asc  = [...recent].reverse();            // älteste → neuste
  const vals = asc.map(e => e[field] as number);
  const limit = LIMITS[field];

  // Schwellenwert pro Feld (unter dem eine Änderung als Rauschen gilt)
  const noise = field === "temp" ? 1.0 : 0.1;

  const diffs = vals.slice(1).map((v, i) => v - vals[i]);
  const rising  = diffs.filter(d => d >  noise).length;
  const falling = diffs.filter(d => d < -noise).length;
  const total   = diffs.length;

  const currentVal    = vals[vals.length - 1];
  const currentStatus = getStatus(field, currentVal);
  const avgVal        = mean(vals).toFixed(1);

  // Alle Werte stabil im OK-Bereich?
  const allOk  = asc.every(e => getStatus(field, e[field] as number) === "ok");
  const spread = Math.max(...vals) - Math.min(...vals);
  if (allOk && spread < noise * 3 && recent.length >= 4) {
    return {
      id: `stable_${field}`,
      type: "value_trend",
      severity: "good",
      icon: "✅",
      title: `${limit.label} stabil`,
      message: `Seit ${recent.length} Messungen im Idealbereich (Ø ${avgVal}${limit.unit})`,
    };
  }

  // Steigend: ≥ ⅔ der Differenzen positiv
  if (rising >= Math.ceil(total * 0.6)) {
    const avgRise = mean(diffs.filter(d => d > 0));
    const sev: TrendSeverity = currentStatus === "high" ? "danger"
      : avgRise > noise * 2     ? "warning" : "info";
    return {
      id: `rising_${field}`,
      type: "value_trend",
      severity: sev,
      icon: "📈",
      title: `${limit.label} steigt`,
      message:
        `Seit ${rising + 1} Messungen steigend (+${avgRise.toFixed(2)}${limit.unit}/Messung)` +
        (currentStatus === "high" ? " — Wert über OK-Bereich!" : ""),
      action: currentStatus === "high" ? "Jetzt korrigieren" : undefined,
    };
  }

  // Fallend: ≥ ⅔ der Differenzen negativ
  if (falling >= Math.ceil(total * 0.6)) {
    const avgFall = mean(diffs.filter(d => d < 0).map(Math.abs));
    const sev: TrendSeverity = currentStatus === "low" ? "danger"
      : avgFall > noise * 2   ? "warning" : "info";
    return {
      id: `falling_${field}`,
      type: "value_trend",
      severity: sev,
      icon: "📉",
      title: `${limit.label} fällt`,
      message:
        `Seit ${falling + 1} Messungen fallend (−${avgFall.toFixed(2)}${limit.unit}/Messung)` +
        (currentStatus === "low" ? " — Wert unter OK-Bereich!" : ""),
      action: currentStatus === "low"  ? "Jetzt nachkorrigieren"
        : field === "cl"               ? "Nachdosierung prüfen" : undefined,
    };
  }

  return null;
}

// ── 2. Prognose ───────────────────────────────────────────────────

function analyzeForecast(entries: PoolEntry[], field: FieldKey): TrendResult | null {
  const asc = entries.slice(0, 5).reverse();      // älteste → neuste
  if (asc.length < 3) return null;

  const dailyChanges: number[] = [];
  for (let i = 1; i < asc.length; i++) {
    const days = daysBetween(asc[i - 1].date, asc[i].date);
    if (days > 0 && days <= 10) {
      dailyChanges.push(((asc[i][field] as number) - (asc[i - 1][field] as number)) / days);
    }
  }
  if (!dailyChanges.length) return null;

  const dailyRate  = mean(dailyChanges);
  const currentVal = asc[asc.length - 1][field] as number;
  const limit      = LIMITS[field];

  if (getStatus(field, currentVal) !== "ok") return null; // schon außerhalb → keine Prognose

  const formatDays = (d: number) => `${Math.round(d)} Tag${Math.round(d) === 1 ? "" : "en"}`;

  if (dailyRate < -0.01) {
    const daysToMin = (currentVal - limit.min) / Math.abs(dailyRate);
    if (daysToMin > 0 && daysToMin <= 7) {
      return {
        id: `forecast_low_${field}`,
        type: "forecast",
        severity: daysToMin <= 2 ? "danger" : "warning",
        icon: "⏳",
        title: `${limit.label} Prognose`,
        message: `Bei aktuellem Abfall in ca. ${formatDays(daysToMin)} unter ${limit.min}${limit.unit}`,
        action: daysToMin <= 2 ? "Heute noch nachdosieren!" : "Bald nachdosieren",
      };
    }
  }

  if (dailyRate > 0.01) {
    const daysToMax = (limit.max - currentVal) / dailyRate;
    if (daysToMax > 0 && daysToMax <= 7) {
      return {
        id: `forecast_high_${field}`,
        type: "forecast",
        severity: daysToMax <= 2 ? "danger" : "warning",
        icon: "⏳",
        title: `${limit.label} Prognose`,
        message: `Bei aktuellem Anstieg in ca. ${formatDays(daysToMax)} über ${limit.max}${limit.unit}`,
        action: "Ursache prüfen",
      };
    }
  }

  return null;
}

// ── 3. Regen-Korrelation (echte mm-Daten, Fallback UV-Proxy) ─────

function analyzeRainCorrelation(entries: PoolEntry[]): TrendResult | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Echte Regendaten verfügbar?
  const withRain = sorted.filter(e => e.rainMm != null);
  const useRealMm = withRain.length >= 4;

  const phChanges: number[] = [];
  const clChanges: number[] = [];
  let rainyCount = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const isRainy = useRealMm
      ? (prev.rainMm ?? 0) >= 2          // ≥ 2 mm = nennenswerter Regen
      : (prev.uvIndex ?? 10) < 2;        // UV-Proxy (Fallback)

    if (isRainy) {
      const d = daysBetween(prev.date, curr.date);
      if (d <= 3) {
        phChanges.push(curr.ph - prev.ph);
        clChanges.push(curr.cl - prev.cl);
        rainyCount++;
      }
    }
  }

  if (rainyCount < 2) return null;

  const avgPh = phChanges.length >= 2 ? mean(phChanges) : 0;
  const avgCl = clChanges.length >= 2 ? mean(clChanges) : 0;
  const src   = useRealMm ? "Regentagen (≥2 mm)" : "trüben Tagen";

  if (avgPh < -0.2) {
    return {
      id: "rain_ph",
      type: "rain_correlation",
      severity: "info",
      icon: "🌧️",
      title: "Regen-Korrelation: pH",
      message: `Nach ${src} sinkt dein pH im Schnitt um ${Math.abs(avgPh).toFixed(1)} (${rainyCount} Fälle)`,
      action: "Nach Regen pH messen und ggf. korrigieren",
    };
  }

  if (avgCl < -0.25) {
    return {
      id: "rain_cl",
      type: "rain_correlation",
      severity: "info",
      icon: "🌧️",
      title: "Regen-Korrelation: Chlor",
      message: `Nach ${src} sinkt Chlor im Schnitt um ${Math.abs(avgCl).toFixed(1)} mg/l (${rainyCount} Fälle)`,
      action: "Nach Regen Chlor nachkorrigieren",
    };
  }

  return null;
}

// ── 4. Benutzungs-Korrelation ─────────────────────────────────────

const USAGE_KW = [
  "benutzt", "benutzung", "badegäste", "badegast", "gäste",
  "schwimmen", "gebadet", "genutzt", "nutzung", "personen", "familie",
];

function analyzeUsageCorrelation(entries: PoolEntry[]): TrendResult | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const clChanges: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const e    = sorted[i];
    const next = sorted[i + 1];
    const note = e.note?.toLowerCase() ?? "";
    if (USAGE_KW.some(kw => note.includes(kw))) {
      const d = daysBetween(e.date, next.date);
      if (d <= 3) clChanges.push(next.cl - e.cl);
    }
  }

  if (clChanges.length < 2) return null;

  const avg = mean(clChanges);
  if (avg >= -0.25) return null;

  return {
    id: "usage_cl",
    type: "usage_correlation",
    severity: "warning",
    icon: "👥",
    title: "Benutzungs-Korrelation",
    message: `Nach Benutzung sinkt Chlor durchschnittlich um ${Math.abs(avg).toFixed(1)} mg/l (${clChanges.length} Messungen)`,
    action: "Direkt nach Nutzung Chlor nachdosieren",
  };
}

// ── 5. Wochenmuster ───────────────────────────────────────────────

function analyzeWeeklyPattern(entries: PoolEntry[]): TrendResult | null {
  if (entries.length < 10) return null;

  const byDow: Record<number, number[]> = {};
  entries.forEach(e => {
    const dow = new Date(e.date + "T12:00:00").getDay();
    if (!byDow[dow]) byDow[dow] = [];
    byDow[dow].push(e.cl);
  });

  const avgs = Object.entries(byDow)
    .filter(([, v]) => v.length >= 2)
    .map(([dow, v]) => ({ dow: +dow, avg: mean(v), count: v.length }));

  if (avgs.length < 3) return null;

  const minDow = avgs.reduce((a, b) => a.avg < b.avg ? a : b);
  const maxDow = avgs.reduce((a, b) => a.avg > b.avg ? a : b);
  const diff   = maxDow.avg - minDow.avg;

  if (diff < 0.35) return null;

  const isMonday     = minDow.dow === 1;
  const dayName      = DAY_NAMES[minDow.dow];

  return {
    id: "weekly_pattern",
    type: "weekly_pattern",
    severity: "info",
    icon: "📅",
    title: "Wochenmuster erkannt",
    message: isMonday
      ? `Chlor ist montags am niedrigsten (Ø ${minDow.avg.toFixed(1)} mg/l) — Wochenendnutzung erkennbar`
      : `Chlor ist ${dayName}s am niedrigsten (Ø ${minDow.avg.toFixed(1)} mg/l, Schwankung ${diff.toFixed(1)} mg/l)`,
    action: `${dayName}s Chlor kontrollieren`,
  };
}

// ── Haupt-Export ──────────────────────────────────────────────────

const SEVERITY_ORDER: Record<TrendSeverity, number> = {
  danger: 0, warning: 1, info: 2, good: 3,
};

export function analyzeTrends(entries: PoolEntry[]): TrendResult[] {
  if (entries.length < MIN_ENTRIES) return [];

  const results: TrendResult[] = [];

  // 1. Wert-Trends
  for (const field of ["cl", "ph", "temp"] as FieldKey[]) {
    const r = analyzeValueTrend(entries, field);
    if (r) results.push(r);
  }

  // 2. Prognosen (nur Cl & pH, nicht Temperatur)
  for (const field of ["cl", "ph"] as FieldKey[]) {
    const r = analyzeForecast(entries, field);
    if (r) results.push(r);
  }

  // 3. Kontextuelle Temperatur-Chlor-Bewertung (überschreibt isolierte Ampel)
  const latestEntry = entries[0];
  if (latestEntry) {
    const temp   = latestEntry.temp;
    const cl     = latestEntry.cl;
    const minCl  = minChlorByTemp(temp);
    const retest = formatRetestIn(retestIntervalByTemp(temp));

    if (temp >= 35 && cl < 1.5) {
      results.push({
        id: "legionella_risk",
        type: "value_trend",
        severity: "danger",
        icon: "🦠",
        title: "Legionellen-Risiko",
        message: `Bei ${temp.toFixed(0)}°C muss Chlor ≥ 1,5 mg/l betragen (aktuell ${cl.toFixed(2)} mg/l). Spa nicht benutzen.`,
        action: "Chlor sofort erhöhen",
      });
    } else if (temp > 30 && cl < minCl) {
      results.push({
        id: "temp_cl_low",
        type: "value_trend",
        severity: temp > 34 ? "danger" : "warning",
        icon: "🌡️",
        title: "Chlor bei hoher Temperatur zu niedrig",
        message: `Bei ${temp.toFixed(0)}°C mindestens ${minCl.toFixed(1)} mg/l Chlor nötig (aktuell ${cl.toFixed(2)} mg/l). Nächste Messung in ${retest}.`,
        action: `Chlor auf ≥ ${minCl.toFixed(1)} mg/l erhöhen`,
      });
    } else if (temp > 30) {
      results.push({
        id: "temp_retest",
        type: "value_trend",
        severity: "info",
        icon: "⏱",
        title: `Nachmessintervall bei ${temp.toFixed(0)}°C`,
        message: `Bei dieser Temperatur baut sich Chlor schnell ab — nächste Messung in ${retest} empfohlen.`,
      });
    }
  }

  // 4. Regen-Korrelation
  const rain = analyzeRainCorrelation(entries);
  if (rain) results.push(rain);

  // 5. Benutzungs-Korrelation
  const usage = analyzeUsageCorrelation(entries);
  if (usage) results.push(usage);

  // 6. Wochenmuster
  const weekly = analyzeWeeklyPattern(entries);
  if (weekly) results.push(weekly);

  // Sortieren: danger → warning → info → good
  return results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
