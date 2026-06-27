import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DEFAULT_WATER_CHANGE, lastAddition, lastFullChange,
  daysSinceLastFullChange,
  getWaterStatus, calcDilution,
  type WaterChangeRecord,
} from "./waterChange";

function recordWith(overrides: Partial<WaterChangeRecord>): WaterChangeRecord {
  return { ...DEFAULT_WATER_CHANGE, ...overrides };
}

describe("DEFAULT_WATER_CHANGE", () => {
  it("startet mit leeren Listen für Teil- UND komplette Wechsel", () => {
    expect(DEFAULT_WATER_CHANGE.additions).toEqual([]);
    expect(DEFAULT_WATER_CHANGE.fullChanges).toEqual([]);
  });
});

describe("lastAddition / lastFullChange", () => {
  it("sind unabhängig voneinander — ein kompletter Wechsel zählt nicht als Teilwechsel", () => {
    const record = recordWith({
      additions:   [],
      fullChanges: [{ id: 1, date: "2026-06-20" }],
    });
    expect(lastAddition(record)).toBeUndefined();
    expect(lastFullChange(record)?.date).toBe("2026-06-20");
  });
});

describe("daysSinceLastFullChange — Zeitzonen-sicher (gleiche Logik wie daysSince)", () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });

  it("liefert null, wenn noch nie ein kompletter Wechsel eingetragen wurde", () => {
    expect(daysSinceLastFullChange(DEFAULT_WATER_CHANGE)).toBeNull();
  });

  it("liefert 0 für einen heute (lokal) eingetragenen Wechsel, auch kurz nach Mitternacht", () => {
    vi.setSystemTime(new Date("2026-06-26T22:30:00.000Z")); // 27.06. 00:30 lokal
    const record = recordWith({ fullChanges: [{ id: 1, date: "2026-06-27" }] });
    expect(daysSinceLastFullChange(record)).toBe(0);
  });

  it("zählt mehrere Tage korrekt", () => {
    vi.setSystemTime(new Date("2026-07-04T10:00:00.000Z")); // 04.07. lokal
    const record = recordWith({ fullChanges: [{ id: 1, date: "2026-06-27" }] });
    expect(daysSinceLastFullChange(record)).toBe(7);
  });

  it("nutzt immer den NEUESTEN kompletten Wechsel (additions[0]), nicht den ältesten", () => {
    vi.setSystemTime(new Date("2026-06-30T10:00:00.000Z"));
    const record = recordWith({
      fullChanges: [
        { id: 2, date: "2026-06-29" }, // neuester zuerst (wie addFullChange es einfügt)
        { id: 1, date: "2026-06-20" },
      ],
    });
    expect(daysSinceLastFullChange(record)).toBe(1);
  });
});

describe("getWaterStatus (gemeinsam für Teil- und komplette Wechsel genutzt)", () => {
  it("danger ohne jeden Eintrag", () => {
    expect(getWaterStatus(null, 14)).toBe("danger");
  });

  it("ok kurz nach dem Wechsel", () => {
    expect(getWaterStatus(1, 14)).toBe("ok");
  });

  it("warning ab 70% des Intervalls", () => {
    expect(getWaterStatus(10, 14)).toBe("warning"); // 10/14 ≈ 71%
  });

  it("danger sobald das Intervall überschritten ist", () => {
    expect(getWaterStatus(15, 14)).toBe("danger");
  });
});

describe("calcDilution", () => {
  it("100% Wechsel verdünnt vollständig auf den Frischwasser-pH, Cl auf 0", () => {
    const r = calcDilution(3.0, 7.6, 950, 950);
    expect(r.newCl).toBe(0);
    expect(r.newPh).toBeCloseTo(7.2, 5);
    expect(r.dilutionPct).toBe(100);
  });

  it("0 Liter Zugabe verändert nichts", () => {
    const r = calcDilution(1.0, 7.4, 950, 0);
    expect(r.newCl).toBe(1.0);
    expect(r.newPh).toBeCloseTo(7.4, 5);
  });

  it("kappt den Verdünnungsfaktor bei über 100% (mehr zugegeben als Poolvolumen)", () => {
    const r = calcDilution(3.0, 7.6, 950, 2000);
    expect(r.dilutionPct).toBe(100);
    expect(r.newCl).toBe(0);
  });
});
