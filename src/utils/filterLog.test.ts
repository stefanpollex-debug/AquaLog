import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { daysSinceEntry, getFilterStatus, type FilterEntry } from "./filterLog";

describe("daysSinceEntry — Zeitzonen-Regression (gleicher Fehler wie in status.ts/waterChange.ts)", () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });

  it("liefert 0 für einen heute (lokal) eingetragenen Filtertermin, auch vormittags", () => {
    vi.setSystemTime(new Date("2026-06-27T06:00:00.000Z")); // 27.06. 08:00 lokal
    const entry: FilterEntry = { id: 1, date: "2026-06-27", type: "clean" };
    expect(daysSinceEntry(entry)).toBe(0);
  });

  it("zählt mehrere Tage korrekt", () => {
    vi.setSystemTime(new Date("2026-07-04T10:00:00.000Z"));
    const entry: FilterEntry = { id: 1, date: "2026-06-27", type: "clean" };
    expect(daysSinceEntry(entry)).toBe(7);
  });
});

describe("getFilterStatus", () => {
  it("ok unter 70% des Intervalls", () => {
    expect(getFilterStatus(5, 14)).toBe("ok");
  });
  it("warning zwischen 70% und 100%", () => {
    expect(getFilterStatus(11, 14)).toBe("warning");
  });
  it("danger ab 100% des Intervalls", () => {
    expect(getFilterStatus(15, 14)).toBe("danger");
  });
});
