import { describe, it, expect } from "vitest";
import { getLimitsForPoolType, LIMITS } from "./constants";

describe("getLimitsForPoolType", () => {
  it("Whirlpool / Spa hat ein engeres Cl-Zielband als der Standard-Fallback", () => {
    const spa = getLimitsForPoolType("Whirlpool / Spa");
    expect(spa.cl.min).toBe(0.3);
    expect(spa.cl.max).toBe(1.5);
  });

  it("Whirlpool / Spa hat eine Ideal- und Gefahrenzone für Cl hinterlegt", () => {
    const spa = getLimitsForPoolType("Whirlpool / Spa");
    expect(spa.cl.ideal).toEqual({ min: 0.6, max: 1.0 });
    expect(spa.cl.danger?.high).toBe(3.0);
  });

  it("Whirlpool / Spa hat ein Outdoor-Temperaturband (18-32°C), keine Whirlpool-Temperaturen", () => {
    const spa = getLimitsForPoolType("Whirlpool / Spa");
    expect(spa.temp.min).toBe(18);
    expect(spa.temp.max).toBe(32);
    expect(spa.temp.danger?.high).toBe(37);
  });

  it("andere Pool-Typen (z.B. Einbaupool) nutzen die Freibad-Werte, nicht die Spa-Werte", () => {
    const freibad = getLimitsForPoolType("Einbaupool");
    expect(freibad.cl.min).toBe(0.5);
    expect(freibad.cl.max).toBe(3.0);
    expect(freibad.cl.danger).toBeUndefined();
    expect(freibad.temp.min).toBe(20);
    expect(freibad.temp.max).toBe(28);
  });

  it("unbekannter Pool-Typ fällt auf die Freibad-Werte zurück, crasht nicht", () => {
    expect(() => getLimitsForPoolType("Irgendwas Unbekanntes")).not.toThrow();
    const fallback = getLimitsForPoolType("Irgendwas Unbekanntes");
    expect(fallback.cl.min).toBe(0.5);
  });

  it("KH/GH bleiben für alle Pool-Typen identisch (nicht pool-typ-spezifisch)", () => {
    const spa     = getLimitsForPoolType("Whirlpool / Spa");
    const freibad = getLimitsForPoolType("Einbaupool");
    expect(spa.kh).toEqual(freibad.kh);
    expect(spa.gh).toEqual(freibad.gh);
  });

  it("KH-Warnzone (100-120) ist für alle Pool-Typen vorhanden", () => {
    const spa = getLimitsForPoolType("Whirlpool / Spa");
    expect(spa.kh.warningZone).toEqual({ min: 100, max: 120 });
  });

  it("liefert für jeden Aufruf ein neues Objekt (kein gemeinsam mutierbarer State)", () => {
    const a = getLimitsForPoolType("Whirlpool / Spa");
    const b = getLimitsForPoolType("Whirlpool / Spa");
    expect(a).not.toBe(b);
    expect(a.cl).not.toBe(b.cl);
  });
});

describe("LIMITS (statische Basis-Defaults)", () => {
  it("enthält alle 5 erwarteten Felder", () => {
    expect(Object.keys(LIMITS).sort()).toEqual(["cl", "gh", "kh", "ph", "temp"]);
  });

  it("jedes Feld hat sliderMin <= min <= max <= sliderMax", () => {
    for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
      const l = LIMITS[key];
      expect(l.sliderMin).toBeLessThanOrEqual(l.min);
      expect(l.min).toBeLessThanOrEqual(l.max);
      expect(l.max).toBeLessThanOrEqual(l.sliderMax);
    }
  });
});
