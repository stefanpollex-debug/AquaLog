import { LIMITS, type FieldKey, type ActiveLimits } from "./constants";

export type Status = "ok" | "low" | "high" | "warn";

export function getStatus(key: FieldKey, value: number, limits?: ActiveLimits): Status {
  const l = (limits ?? LIMITS)[key];
  if (value < l.min) return "low";
  if (value > l.max) return "high";
  if (l.warningZone && value >= l.warningZone.min && value <= l.warningZone.max) return "warn";
  return "ok";
}

/** Heutiges Datum als YYYY-MM-DD in LOKALER Zeit — NICHT toISOString().slice(0,10) verwenden,
 *  das ist UTC-basiert und liefert in Zeitzonen östlich von UTC (z.B. MESZ) kurz nach lokaler
 *  Mitternacht noch das Vortagesdatum (UTC hat dann noch nicht auf den neuen Tag gewechselt). */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysSince(dateStr: string): number {
  // "T12:00:00" (ohne Z) verankert die Zeit lokal statt UTC-Mitternacht — sonst
  // zeigt die App in Zeitzonen östlich von UTC (z.B. MESZ) bei "heute"-Einträgen
  // kurz nach lokaler Mitternacht fälschlich -1 Tage an (Date.now() ist dann noch
  // vor UTC-Mitternacht desselben Kalendertags).
  return Math.floor((Date.now() - new Date(dateStr + "T12:00:00").getTime()) / 86400000);
}

export function avg(arr: Array<Record<string, number>>, key: string): number {
  if (!arr.length) return 0;
  return arr.reduce((s, e) => s + e[key], 0) / arr.length;
}

export function pctOutOfRange(arr: Array<Record<string, number>>, key: FieldKey, limits?: ActiveLimits): number {
  if (!arr.length) return 0;
  return Math.round(
    (arr.filter((e) => getStatus(key, e[key], limits) !== "ok").length / arr.length) * 100
  );
}
