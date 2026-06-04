export interface WaterAddition {
  id:          number;
  date:        string;    // "YYYY-MM-DD"
  litersAdded: number;
  note?:       string;
}

export interface WaterChangeRecord {
  additions:    WaterAddition[];
  intervalDays: number;   // Erinnerungsintervall (Tage seit letzter Zugabe)
}

export const INTERVAL_OPTIONS = [7, 14, 30, 60] as const;

export const DEFAULT_WATER_CHANGE: WaterChangeRecord = {
  additions:    [],
  intervalDays: 14,
};

export function lastAddition(record: WaterChangeRecord): WaterAddition | undefined {
  return record.additions[0];
}

export function daysSinceLastAddition(record: WaterChangeRecord): number | null {
  const last = lastAddition(record);
  if (!last) return null;
  const d   = new Date(last.date + "T12:00:00");
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Summe der zugefügten Liter (gesamt oder innerhalb der letzten X Tage) */
export function totalLitersAdded(record: WaterChangeRecord, withinDays?: number): number {
  const cutoff = withinDays
    ? new Date(Date.now() - withinDays * 86_400_000)
    : new Date(0);
  return record.additions
    .filter(a => new Date(a.date + "T12:00:00") >= cutoff)
    .reduce((sum, a) => sum + a.litersAdded, 0);
}

/**
 * Berechnet neue Cl- und pH-Werte nach Zugabe von Frischwasser.
 * Modell: Verdünnung + Mischung mit Leitungswasser (pH ~7,2).
 */
export function calcDilution(
  currentCl:        number,
  currentPh:        number,
  poolVolumeLiters: number,
  litersAdded:      number,
  freshWaterPh = 7.2,
): { newCl: number; newPh: number; dilutionPct: number } {
  const factor = Math.min(litersAdded / poolVolumeLiters, 1);
  return {
    newCl:       Math.max(0, currentCl * (1 - factor)),
    newPh:       currentPh * (1 - factor) + freshWaterPh * factor,
    dilutionPct: factor * 100,
  };
}

export type WaterStatus = "ok" | "warning" | "danger";

export function getWaterStatus(daysSince: number | null, intervalDays: number): WaterStatus {
  if (daysSince === null)                    return "danger";
  if (daysSince > intervalDays)              return "danger";
  if (daysSince > intervalDays * 0.7)        return "warning";
  return "ok";
}

export const STATUS_COLOR: Record<WaterStatus, string> = {
  ok:      "#22c55e",
  warning: "#f59e0b",
  danger:  "#ef4444",
};

export const STATUS_BG: Record<WaterStatus, string> = {
  ok:      "#f0fdf4",
  warning: "#fffbeb",
  danger:  "#fef2f2",
};
