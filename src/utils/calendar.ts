import { type PoolEntry } from "../hooks/usePoolEntries";
import { getStatus } from "./status";
import { type FieldKey, type ActiveLimits } from "./constants";

export interface MonthRef { year: number; month: number; }

/** Flat array of 42 cells (6 × 7). null = leere Zelle. Woche beginnt Montag. */
export function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0=So, 1=Mo …
  const offset   = firstDow === 0 ? 6 : firstDow - 1; // Mo-basiert
  const days     = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= days; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

/** Alle Monate mit Einträgen + aktueller Monat, aufsteigend sortiert. */
export function getAvailableMonths(entries: PoolEntry[]): MonthRef[] {
  const set = new Set<string>();
  const now = new Date();
  set.add(`${now.getFullYear()}-${now.getMonth()}`);
  entries.forEach(e => {
    const d = new Date(e.date + "T12:00:00");
    set.add(`${d.getFullYear()}-${d.getMonth()}`);
  });
  return Array.from(set)
    .map(s => { const [y, m] = s.split("-").map(Number); return { year: y, month: m }; })
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

/** Farbe eines Tages basierend auf wie viele Werte außerhalb OK-Bereich. */
export function getDayColor(entry: PoolEntry | undefined, limits?: ActiveLimits): string | null {
  if (!entry) return null;
  const bad = (["cl", "ph", "temp"] as FieldKey[])
    .filter(k => getStatus(k, entry[k] as number, limits) !== "ok").length;
  if (bad === 0) return "#22c55e";
  if (bad === 1) return "#f59e0b";
  return "#ef4444";
}

/** YYYY-MM-DD aus 0-indiziertem Monat. */
export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const MONTH_NAMES = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export const WEEKDAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
