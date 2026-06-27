/** Engere "Idealzone" innerhalb von min–max + harte Gefahrenschwelle, die unabhängig
 *  vom min/max-Multiplikator gilt. Optional — nur wo eine Quelle die Werte liefert. */
export interface IdealRange { min: number; max: number; }
export interface DangerThreshold { low?: number; high?: number; }

export interface FieldLimit {
  min: number; max: number; step: number;
  sliderMin: number; sliderMax: number;
  unit: string; label: string; color: string;
  ideal?: IdealRange;
  danger?: DangerThreshold;
  /** Engere Zone INNERHALB von min–max, die technisch noch "ok" ist, aber als
   *  grenzwertig markiert wird (gelb statt grün) — z.B. KH am oberen Rand. */
  warningZone?: IdealRange;
}

export const LIMITS: Record<"cl" | "ph" | "temp" | "kh" | "gh", FieldLimit> = {
  cl:   { min: 0.5, max: 1.5, step: 0.1,  sliderMin: 0,   sliderMax: 5,   unit: "mg/l", label: "Chlor (Cl)",       color: "#0ea5e9" },
  ph:   { min: 7.2, max: 7.6, step: 0.05, sliderMin: 6.5, sliderMax: 8.5, unit: "",     label: "pH-Wert",          color: "#8b5cf6" },
  temp: { min: 20,  max: 28,  step: 0.5,  sliderMin: 10,  sliderMax: 45,  unit: "°C",   label: "Temperatur",       color: "#f97316" },
  // KH 120 ist oberes Limit — 100–120 mg/l als grenzwertig markiert (gelb statt grün),
  // da pH bei Annäherung an 120 zunehmend träge/schwer korrigierbar wird.
  kh:   { min: 80,  max: 120, step: 5,    sliderMin: 20,  sliderMax: 250, unit: "mg/l", label: "Alkalinität (KH)", color: "#10b981", warningZone: { min: 100, max: 120 } },
  gh:   { min: 100, max: 200, step: 10,   sliderMin: 50,  sliderMax: 500, unit: "mg/l", label: "Gesamthärte (GH)", color: "#f472b6" },
};

export type FieldKey = keyof typeof LIMITS;

/** Pool-typ-spezifische Grenzwerte — überschreibt min/max (+ optional ideal/danger), Slider-Ranges bleiben gleich */
export function getLimitsForPoolType(poolType: string): Record<FieldKey, FieldLimit> {
  if (poolType === "Whirlpool / Spa") {
    return {
      ...LIMITS,
      // Richtwerte für einen privaten Erholungs-/Erfrischungspool (kein beheizter
      // Whirlpool, kein öffentliches Becken nach DIN 19643) — 0.3–1.5 mg/l Zielband,
      // 0.6–1.0 mg/l Idealzone, ab 3.0 mg/l harte Nutzungssperre.
      cl: {
        ...LIMITS.cl, min: 0.3, max: 1.5,
        ideal:  { min: 0.6, max: 1.0 },
        danger: { high: 3.0 },
      },
      ph:   { ...LIMITS.ph,   min: 7.2, max: 7.8 },
      // Unbeheizter Außenpool zum Erholen/Erfrischen, kein Whirlpool — 18–32°C
      // Zielband, 24–28°C Idealzone, ab 37°C harte Gefahrenschwelle (Legionellen-Bereich).
      temp: {
        ...LIMITS.temp, min: 18, max: 32,
        ideal:  { min: 24, max: 28 },
        danger: { high: 37 },
      },
    };
  }
  return {
    ...LIMITS,
    cl:   { ...LIMITS.cl,   min: 0.5, max: 3.0 },
    ph:   { ...LIMITS.ph,   min: 7.2, max: 7.6 },
    temp: { ...LIMITS.temp, min: 20,  max: 28  },
  };
}

export type ActiveLimits = Record<FieldKey, FieldLimit>;

export const POOL = {
  name: "Home Deluxe Spa DROP",
  volume: 0.95,
  type: "pool",
} as const;

// Demo-Eintrag für brandneue Installationen (nur sichtbar wenn entries_spa leer ist).
// Werte bewusst in der Idealzone — eine Sicherheitswarnung als allererster Eindruck
// wäre ein schlechter Einstieg. cl=3.5/temp=38 (alte Werte) lagen inzwischen über den
// korrigierten Spa-Gefahrenschwellen (Cl >3.0, Temp >37°C) und hätten sofort eine
// "Pool nicht benutzen"-Warnung ausgelöst.
export const FIRST_ENTRY = {
  date: "2026-05-26",
  cl: 0.8,
  ph: 7.4,
  temp: 26,
  kh: 90,
  note: "Erstbetrieb – Pool neu befüllt",
  id: 1748217600000,
};

export const DEFAULT_VALUES = { cl: 1.0, ph: 7.4, temp: 24, kh: 100, gh: 150 };

// Kühlwasser-Pool bei 23–25°C: alle 5–6 Tage messen reicht
export const STALE_DAYS = 6;
