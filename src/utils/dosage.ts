import { LIMITS, type FieldKey } from "./constants";
import { type Status } from "./status";

type Product = "ph_plus" | "ph_minus" | "chlor" | "kh_plus";

// g pro m³ pro Einheit
// Chlorgranulat: ~5g / (1 mg/l · m³)
// pH-Plus/Minus: ~5g / (0.1 pH · m³)
// Natriumhydrogencarbonat (KH+): ~17g / (10 mg/l · m³)
const FACTORS: Record<Product, number> = {
  ph_plus:  5,
  ph_minus: 5,
  chlor:    5,
  kh_plus:  17,
};

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
    const delta = target.min - currentValue + 0.5;
    const dose = calcDose("chlor", delta, volume);
    return `⚠️ Chlor zu niedrig (${currentValue} mg/l): Stoßchlorierung nötig. Für ${L} L jetzt ca. ${dose}g Chlorgranulat zugeben. Spa 30 Min. umwälzen, dann erneut messen. Erst wieder nutzen wenn Cl 3–5 mg/l.`;
  }
  if (key === "cl" && status === "high")
    return `⚠️ Chlor zu hoch (${currentValue} mg/l): Spa 24–48 Std. nicht nutzen, Abdeckung offen lassen. Chlor baut sich von selbst ab. Erst wieder nutzen wenn Cl unter 5 mg/l.`;
  if (key === "ph" && status === "low") {
    const dose = calcDose("ph_plus", (7.4 - currentValue) / 0.1, volume);
    return `⚠️ pH zu niedrig (${currentValue}): Erhöht die Korrosionsgefahr und reizt Haut/Augen. pH-Plus zugeben: Für ${L} L ca. ${dose}g langsam einrühren, 30 Min. umwälzen, nachmessen. Ziel: 7,2–7,6.`;
  }
  if (key === "ph" && status === "high") {
    const dose = calcDose("ph_minus", (currentValue - 7.4) / 0.1, volume);
    return `⚠️ pH zu hoch (${currentValue}): Chlorwirkung stark reduziert! pH-Minus zugeben: Für ${L} L ca. ${dose}g einrühren, 30 Min. warten, nachmessen. Immer pH vor Chlor korrigieren!`;
  }
  if (key === "temp" && status === "low")
    return `ℹ️ Wassertemperatur niedrig (${currentValue}°C): Spa noch nicht auf Betriebstemperatur (35–40°C). Chlorbedarf steigt beim Aufheizen.`;
  if (key === "temp" && status === "high")
    return `⚠️ Wassertemperatur sehr hoch (${currentValue}°C): Chlorverbrauch stark erhöht, täglich messen. Über 40°C ist medizinisch bedenklich.`;
  if (key === "kh" && status === "low") {
    const delta = (target.min - currentValue) / 10;
    const dose = calcDose("kh_plus", delta, volume);
    return `⚠️ Alkalinität zu niedrig (${currentValue} mg/l): pH wird instabil! Natriumhydrogencarbonat (Alkalinität Plus) zugeben: Für ${L} L ca. ${dose}g, umwälzen, 2 Std. warten, KH und pH nachmessen.`;
  }
  if (key === "kh" && status === "high")
    return `ℹ️ Alkalinität zu hoch (${currentValue} mg/l): pH wird träge und schwer zu korrigieren. Teilwasserwechsel empfohlen. Keine direkte Chemikalien zur KH-Senkung im Spa.`;
  return null;
}
