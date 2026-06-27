import { daysSince } from "./status";

export interface FilterEntry {
  id:    number;
  date:  string;               // "YYYY-MM-DD"
  type:  "clean" | "replace";
  note?: string;
}

export interface FilterSettings {
  cleanIntervalDays:   number;  // default 14
  replaceIntervalDays: number;  // default 90
}

export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  cleanIntervalDays:   14,
  replaceIntervalDays: 90,
};

export const CLEAN_INTERVAL_OPTIONS   = [7,  14, 21] as const;
export const REPLACE_INTERVAL_OPTIONS = [30, 60, 90] as const;

export function daysSinceEntry(entry: FilterEntry): number {
  return daysSince(entry.date);
}

export type FilterStatus = "ok" | "warning" | "danger";

export function getFilterStatus(daysSince: number, intervalDays: number): FilterStatus {
  const ratio = daysSince / intervalDays;
  if (ratio < 0.7) return "ok";
  if (ratio < 1.0) return "warning";
  return "danger";
}

export const FILTER_STATUS_COLOR: Record<FilterStatus, string> = {
  ok:      "#22c55e",
  warning: "#f59e0b",
  danger:  "#ef4444",
};

export const FILTER_STATUS_BG: Record<FilterStatus, string> = {
  ok:      "#f0fdf4",
  warning: "#fffbeb",
  danger:  "#fef2f2",
};
