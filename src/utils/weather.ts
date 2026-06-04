// ── Open-Meteo Response-Typen ────────────────────────────────────
export interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    precipitation: number;
    uv_index: number;
    weather_code: number;
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
    uv_index_max: number[];
  };
}

// ── App-interne Typen ─────────────────────────────────────────────
export interface DayForecast {
  date: string;
  tempMax: number;
  precipProbability: number; // 0–100 %
  precipSum: number;         // Tages-Niederschlag in mm
  uvMax: number;
}

export interface WeatherData {
  currentTemp: number;           // °C
  currentUv: number;             // 0–11+
  currentPrecipitation: number;  // mm
  weatherCode: number;           // WMO code
  forecast: DayForecast[];       // 3 Tage
  fetchedAt: number;             // Date.now()
}

// ── WMO Wetter-Code Tabelle ───────────────────────────────────────
const WMO_ICONS: Record<number, string> = {
  0: "☀️",
  1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  66: "🌧️", 67: "🌧️",
  71: "❄️",  73: "❄️",  75: "❄️",  77: "❄️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️",
  96: "⛈️", 99: "⛈️",
};

const WMO_LABELS: Record<number, string> = {
  0: "Sonnig",
  1: "Meist klar", 2: "Teilbewölkt", 3: "Bedeckt",
  45: "Neblig", 48: "Neblig",
  51: "Nieselregen", 53: "Nieselregen", 55: "Starker Nieselregen",
  56: "Gefrierender Regen", 57: "Gefrierender Regen",
  61: "Leichter Regen", 63: "Regen", 65: "Starker Regen",
  66: "Gefrierender Regen", 67: "Gefrierender Regen",
  71: "Leichter Schnee", 73: "Schnee", 75: "Starker Schnee", 77: "Schneegriesel",
  80: "Schauer", 81: "Schauer", 82: "Starke Schauer",
  85: "Schneeschauer", 86: "Starke Schneeschauer",
  95: "Gewitter",
  96: "Gewitter m. Hagel", 99: "Gewitter m. Hagel",
};

export function getWmoIcon(code: number): string {
  if (WMO_ICONS[code]) return WMO_ICONS[code];
  if (code <= 3)  return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "🌨️";
  return "⛈️";
}

export function getWmoLabel(code: number): string {
  return WMO_LABELS[code] ?? "Unbekannt";
}

export function isRainyCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

// ── Parser ────────────────────────────────────────────────────────
export function parseWeatherResponse(data: OpenMeteoResponse): WeatherData {
  return {
    currentTemp:          data.current.temperature_2m,
    currentUv:            data.current.uv_index,
    currentPrecipitation: data.current.precipitation,
    weatherCode:          data.current.weather_code,
    forecast: data.daily.time.map((date, i) => ({
      date,
      tempMax:            data.daily.temperature_2m_max[i],
      precipProbability:  data.daily.precipitation_probability_max[i],
      precipSum:          data.daily.precipitation_sum[i],
      uvMax:              data.daily.uv_index_max[i],
    })),
    fetchedAt: Date.now(),
  };
}

// ── Pool-Hinweise aus Wetterdaten ─────────────────────────────────
export function getWeatherPoolHints(w: WeatherData): string[] {
  const hints: string[] = [];
  const today = w.forecast[0];

  // UV
  const uv = Math.max(w.currentUv, today?.uvMax ?? 0);
  if (uv >= 6) {
    hints.push(
      `☀️ UV-Index ${uv.toFixed(1)} — Chlor baut sich heute schnell ab. Heute Abend Wasser nachmessen.`
    );
  }

  // Regen (aktuell oder heute hohe Regenwahrscheinlichkeit)
  const rainNow   = w.currentPrecipitation > 0 || isRainyCode(w.weatherCode);
  const rainToday = (today?.precipProbability ?? 0) >= 60;
  if (rainNow || rainToday) {
    hints.push(
      "🌧️ Regen erkannt — pH und Chlor können durch Verdünnung verändert sein. Nach dem Regen testen."
    );
  }

  // Hitze
  const maxTemp = Math.max(w.currentTemp, today?.tempMax ?? 0);
  if (maxTemp >= 28) {
    hints.push(
      `🌡️ Heiß heute (${maxTemp.toFixed(0)}°C) — Chlorverbrauch erhöht. Öfter messen und ggf. nachkorrigieren.`
    );
  }

  return hints;
}

// ── Forecast-Icon für 3-Tage-Vorschau ────────────────────────────
export function forecastIcon(day: DayForecast): string {
  if (day.precipProbability >= 60) return "🌧️";
  if (day.precipProbability >= 30) return "🌦️";
  if (day.uvMax >= 6)              return "☀️";
  return "⛅";
}
