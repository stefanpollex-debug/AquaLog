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

/** Differenz in vollen Kalendertagen (lokal), NICHT in 24h-Blöcken seit "jetzt".
 *  Ein Mittags-Anker (T12:00:00) würde das ursprüngliche UTC-Problem nur auf ein
 *  kleineres Zeitfenster verschieben: eine "heute"-Messung am Vormittag (vor 12 Uhr
 *  lokal) würde bis Mittag weiterhin -1 statt 0 anzeigen. Stattdessen werden beide
 *  Zeitpunkte auf lokale Mitternacht normiert — die Uhrzeit spielt dann keine Rolle mehr. */
export function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target    = new Date(y, m - 1, d);
  const now       = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((todayLocal.getTime() - target.getTime()) / 86400000);
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
