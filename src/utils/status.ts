import { LIMITS, type FieldKey } from "./constants";

export type Status = "ok" | "low" | "high";

export function getStatus(key: FieldKey, value: number): Status {
  const l = LIMITS[key];
  if (value < l.min) return "low";
  if (value > l.max) return "high";
  return "ok";
}

export function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function avg(arr: Array<Record<string, number>>, key: string): number {
  if (!arr.length) return 0;
  return arr.reduce((s, e) => s + e[key], 0) / arr.length;
}

export function pctOutOfRange(arr: Array<Record<string, number>>, key: FieldKey): number {
  if (!arr.length) return 0;
  return Math.round(
    (arr.filter((e) => getStatus(key, e[key]) !== "ok").length / arr.length) * 100
  );
}
