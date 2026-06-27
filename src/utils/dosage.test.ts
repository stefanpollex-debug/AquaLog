import { describe, it, expect } from "vitest";
import { calcDose, getTipWithDose } from "./dosage";
import { getLimitsForPoolType } from "./constants";

describe("calcDose", () => {
  it("berechnet eine positive Dosierung unabhängig vom Vorzeichen der Änderung", () => {
    expect(calcDose("chlor", -2, 1)).toBe(calcDose("chlor", 2, 1));
  });

  it("skaliert linear mit dem Volumen", () => {
    expect(calcDose("chlor", 1, 2)).toBe(calcDose("chlor", 1, 1) * 2);
  });
});

describe("getTipWithDose", () => {
  it("gibt null zurück für status 'ok' (keine Aktion nötig)", () => {
    expect(getTipWithDose("cl", "ok", 1.0, 1)).toBeNull();
  });

  it("gibt null zurück für status 'warn' (grenzwertig, aber keine Dosierungsempfehlung)", () => {
    // Regression: 'warn' ist ein 4. Status-Wert — darf nicht versehentlich wie 'low'/'high'
    // behandelt werden und eine falsche Dosierung vorschlagen.
    expect(getTipWithDose("kh", "warn", 110, 1)).toBeNull();
  });

  it("nutzt die pool-typ-spezifischen Grenzwerte für den Zieltext, nicht die statischen Defaults", () => {
    const spa = getLimitsForPoolType("Whirlpool / Spa");
    const tip = getTipWithDose("cl", "low", 0.1, 1, spa);
    expect(tip).toContain("0.3"); // Spa-Minimum, nicht das statische 0.5
  });

  it("liefert für 'low' einen Tipp mit einer positiven Dosierungsmenge", () => {
    const tip = getTipWithDose("cl", "low", 0.1, 1);
    expect(tip).toMatch(/\d+g Chlorgranulat/);
  });

  it("liefert für 'high' einen Tipp ohne Dosierungsangabe (Verdünnung statt Chemikalie)", () => {
    const tip = getTipWithDose("cl", "high", 5.0, 1);
    expect(tip).toContain("Chlor zu hoch");
  });
});
