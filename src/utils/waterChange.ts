export interface WaterChangeRecord {
  date:         string;  // "YYYY-MM-DD"
  intervalDays: number;  // 60 | 90 | 120
}

export const INTERVAL_OPTIONS = [60, 90, 120] as const;

/** Tage seit dem letzten Austausch */
export function daysSinceWaterChange(record: WaterChangeRecord): number {
  const last = new Date(record.date + "T12:00:00");
  const now  = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

/** Verbleibende Tage bis zum nächsten Austausch (negativ = überfällig) */
export function daysUntilNextChange(record: WaterChangeRecord): number {
  return record.intervalDays - daysSinceWaterChange(record);
}

export type WaterChangeStatus = "ok" | "warning" | "danger";

export function getWaterChangeStatus(daysLeft: number): WaterChangeStatus {
  if (daysLeft > 30) return "ok";
  if (daysLeft >= 10) return "warning";
  return "danger";
}

export const STATUS_COLOR: Record<WaterChangeStatus, string> = {
  ok:      "#22c55e",
  warning: "#f59e0b",
  danger:  "#ef4444",
};

export const STATUS_BG: Record<WaterChangeStatus, string> = {
  ok:      "#f0fdf4",
  warning: "#fffbeb",
  danger:  "#fef2f2",
};
