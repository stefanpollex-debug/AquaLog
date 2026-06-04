import { LIMITS, type FieldKey } from "./constants";
import { type Status } from "./status";

type Product = "ph_plus" | "ph_minus" | "chlor";

// g pro m³ pro Einheit (pH in 0.1er-Schritten, Cl in mg/l)
// Richtwert für gängige Produkte (BAYROL, Steinbach u.ä.)
const FACTORS: Record<Product, number> = { ph_plus: 5, ph_minus: 5, chlor: 5 };

export function calcDose(product: Product, targetChange: number, volumeM3: number): number {
  return Math.round(FACTORS[product] * Math.abs(targetChange) * volumeM3);
}

export function getTipWithDose(
  key: FieldKey,
  status: Status,
  currentValue: number,
  volume: number
): string | null {
  const target = LIMITS[key];
  const L = Math.round(volume * 1000);

  if (key === "cl" && status === "low") {
    const delta = target.min - currentValue + 0.3;
    const dose = calcDose("chlor", delta, volume);
    return `⚠️ Chlor zu niedrig: Stoßchlorierung nötig. Für ${L} L jetzt ca. ${dose}g Chlorgranulat zugeben. Pool umwälzen, 4 Std. warten, dann erneut messen.`;
  }
  if (key === "cl" && status === "high")
    return `⚠️ Chlor zu hoch (${currentValue} mg/l): Spa 24–48 Std. nicht nutzen, Abdeckung offen lassen. Chlor baut sich von selbst ab.`;
  if (key === "ph" && status === "low") {
    const dose = calcDose("ph_plus", (7.2 - currentValue) / 0.1, volume);
    return `⚠️ pH zu niedrig (${currentValue}): pH-Plus zugeben. Für ${L} L ca. ${dose}g langsam einrühren, 1 Std. umwälzen, dann nachmessen.`;
  }
  if (key === "ph" && status === "high") {
    const dose = calcDose("ph_minus", (currentValue - 7.2) / 0.1, volume);
    return `⚠️ pH zu hoch (${currentValue}): pH-Minus zugeben. Für ${L} L ca. ${dose}g einrühren, 1 Std. warten, nachmessen. Immer pH vor Chlor korrigieren!`;
  }
  if (key === "temp" && status === "low") return `ℹ️ Wassertemperatur niedrig: Chlorbedarf sinkt. Heizung prüfen.`;
  if (key === "temp" && status === "high")
    return `⚠️ Wassertemperatur hoch (${currentValue}°C): Chlorverbrauch stark erhöht – täglich kontrollieren.`;
  return null;
}
