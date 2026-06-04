export const LIMITS = {
  cl:   { min: 0.3, max: 1.5, step: 0.1, sliderMin: 0,  sliderMax: 2,  unit: "mg/l", label: "Chlor (Cl)",  color: "#0ea5e9" },
  ph:   { min: 6.6, max: 7.8, step: 0.1, sliderMin: 6,  sliderMax: 9,  unit: "",     label: "pH-Wert",     color: "#8b5cf6" },
  temp: { min: 18,  max: 32,  step: 0.5, sliderMin: 10, sliderMax: 40, unit: "°C",   label: "Temperatur",  color: "#f97316" },
} as const;

export type FieldKey = keyof typeof LIMITS;

export const POOL = {
  name: "Home Deluxe Spa DROP",
  volume: 0.95,
  type: "spa",
} as const;

export const FIRST_ENTRY = {
  date: "2026-05-26",
  cl: 1.0,
  ph: 7.2,
  temp: 26,
  note: "Erstbetrieb – Pool neu befüllt",
  id: 1748217600000,
};

export const DEFAULT_VALUES = { cl: 1.0, ph: 7.0, temp: 22 };

export const STALE_DAYS = 5;
