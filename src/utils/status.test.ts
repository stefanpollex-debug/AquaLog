import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getStatus, localToday, daysSince, avg, pctOutOfRange } from "./status";
import { getLimitsForPoolType, LIMITS } from "./constants";

describe("getStatus", () => {
  it("returns ok within range", () => {
    expect(getStatus("cl", 1.0)).toBe("ok");
  });

  it("returns low below min", () => {
    expect(getStatus("cl", 0.1)).toBe("low");
  });

  it("returns high above max", () => {
    expect(getStatus("cl", 10)).toBe("high");
  });

  it("returns warn inside a configured warningZone (KH 100-120)", () => {
    expect(getStatus("kh", 110)).toBe("warn");
    expect(getStatus("kh", 120)).toBe("warn"); // Grenzwert inklusive
  });

  it("does not return warn just below the warningZone", () => {
    expect(getStatus("kh", 99)).toBe("ok");
  });

  it("respects pool-type-specific limits (Spa vs. Freibad) instead of the static default", () => {
    const spa     = getLimitsForPoolType("Whirlpool / Spa");
    const freibad = getLimitsForPoolType("Einbaupool");
    // 2.0 mg/l ist für ein Spa "ok" (Ziel 0.3-1.5... eigentlich "high", siehe unten),
    // aber zeigt den Punkt: Spa und Freibad dürfen nicht denselben Status liefern.
    expect(getStatus("cl", 2.0, spa)).toBe("high");      // Spa-Limit 0.3-1.5
    expect(getStatus("cl", 2.0, freibad)).toBe("ok");     // Freibad-Limit 0.5-3.0
  });
});

describe("localToday / daysSince — Zeitzonen-Regression", () => {
  const ORIGINAL_TZ = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Berlin"; // UTC+1/+2 — der Fall, der den Bug ausgelöst hat
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = ORIGINAL_TZ;
  });

  it("localToday() liefert das lokale Datum, nicht das UTC-Datum kurz nach Mitternacht", () => {
    // 2026-06-27T00:30 Berlin-Sommerzeit (UTC+2) = 2026-06-26T22:30 UTC.
    // Ein UTC-basiertes "heute" (wie das alte toISOString().slice(0,10)) hätte
    // hier fälschlich "2026-06-26" geliefert.
    vi.setSystemTime(new Date("2026-06-26T22:30:00.000Z"));
    expect(localToday()).toBe("2026-06-27");
  });

  it("daysSince() liefert 0 für eine 'heute' (lokal) datierte Messung — direkt nach Mitternacht", () => {
    vi.setSystemTime(new Date("2026-06-26T22:30:00.000Z")); // = 27.06. 00:30 lokal
    expect(daysSince("2026-06-27")).toBe(0);
  });

  it("daysSince() liefert 0 für eine 'heute' (lokal) datierte Messung — am Vormittag (vor 12 Uhr)", () => {
    // Regression: ein T12:00:00-Anker hätte hier noch -1 geliefert, da "jetzt"
    // vor dem Mittags-Anker des gleichen Kalendertags liegt.
    vi.setSystemTime(new Date("2026-06-27T06:00:00.000Z")); // = 27.06. 08:00 lokal
    expect(daysSince("2026-06-27")).toBe(0);
  });

  it("daysSince() liefert 0 für eine 'heute' (lokal) datierte Messung — kurz vor Mitternacht", () => {
    vi.setSystemTime(new Date("2026-06-27T21:55:00.000Z")); // = 27.06. 23:55 lokal
    expect(daysSince("2026-06-27")).toBe(0);
  });

  it("daysSince() zählt echte Kalendertage korrekt, unabhängig von der Uhrzeit", () => {
    vi.setSystemTime(new Date("2026-07-03T05:00:00.000Z")); // = 03.07. 07:00 lokal
    expect(daysSince("2026-06-27")).toBe(6);
  });

  it("daysSince() liefert nie ein negatives Ergebnis für ein Datum von heute oder früher", () => {
    vi.setSystemTime(new Date("2026-06-27T00:05:00.000Z")); // = 27.06. 02:05 lokal
    expect(daysSince("2026-06-27")).toBeGreaterThanOrEqual(0);
  });
});

describe("avg / pctOutOfRange", () => {
  it("avg gibt 0 für ein leeres Array zurück (kein NaN)", () => {
    expect(avg([], "cl")).toBe(0);
  });

  it("avg berechnet den Durchschnitt korrekt", () => {
    expect(avg([{ cl: 1 }, { cl: 2 }, { cl: 3 }], "cl")).toBe(2);
  });

  it("pctOutOfRange zählt 'warn' korrekt als außerhalb (nicht 'ok')", () => {
    const entries = [{ kh: 110 }, { kh: 90 }]; // 1× warn, 1× ok
    expect(pctOutOfRange(entries, "kh")).toBe(50);
  });

  it("pctOutOfRange gibt 0 für ein leeres Array zurück", () => {
    expect(pctOutOfRange([], "cl")).toBe(0);
  });
});

describe("LIMITS / FieldLimit Grunddaten", () => {
  it("jedes Feld hat min <= max", () => {
    for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
      const l = LIMITS[key];
      expect(l.min).toBeLessThanOrEqual(l.max);
    }
  });
});
