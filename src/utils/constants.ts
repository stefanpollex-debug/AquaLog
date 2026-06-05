export const LIMITS = {
  cl:   { min: 3.0, max: 5.0, step: 0.1,  sliderMin: 0,   sliderMax: 10,  unit: "mg/l", label: "Chlor (Cl)",      color: "#0ea5e9" },
  ph:   { min: 7.2, max: 7.6, step: 0.05, sliderMin: 6.5, sliderMax: 8.5, unit: "",     label: "pH-Wert",         color: "#8b5cf6" },
  temp: { min: 35,  max: 40,  step: 0.5,  sliderMin: 10,  sliderMax: 45,  unit: "°C",   label: "Temperatur",      color: "#f97316" },
  kh:   { min: 80,  max: 120, step: 5,    sliderMin: 20,  sliderMax: 250,  unit: "mg/l", label: "Alkalinität (KH)", color: "#10b981" },
} as const;

export type FieldKey = keyof typeof LIMITS;

export const POOL = {
  name: "Home Deluxe Spa DROP",
  volume: 0.95,
  type: "spa",
} as const;

export const FIRST_ENTRY = {
  date: "2026-05-26",
  cl: 3.5,
  ph: 7.4,
  temp: 38,
  kh: 90,
  note: "Erstbetrieb – Pool neu befüllt",
  id: 1748217600000,
};

export const DEFAULT_VALUES = { cl: 3.0, ph: 7.4, temp: 38, kh: 100 };

// Für Whirlpool/Spa mit hoher Wassertemperatur: alle 2–3 Tage messen
export const STALE_DAYS = 3;
