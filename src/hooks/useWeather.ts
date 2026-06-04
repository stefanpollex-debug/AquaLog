import { useState, useEffect, useRef } from "react";
import { get, set } from "idb-keyval";
import { type WeatherData, parseWeatherResponse } from "../utils/weather";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast" +
  "?latitude=52.3167&longitude=8.6167" +
  "&current=temperature_2m,precipitation,uv_index,weather_code" +
  "&daily=temperature_2m_max,precipitation_probability_max,precipitation_sum,uv_index_max" +
  "&timezone=Europe%2FBerlin&forecast_days=3";

const CACHE_KEY  = "weather_cache";
const REFRESH_MS = 30 * 60 * 1000; // 30 Minuten

export function useWeather() {
  const [weather,  setWeather]  = useState<WeatherData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWeather = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res    = await fetch(WEATHER_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data   = await res.json();
      const parsed = parseWeatherResponse(data);
      setWeather(parsed);
      await set(CACHE_KEY, parsed);
    } catch {
      // Netzwerkfehler → gecachte Daten bleiben erhalten
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Zuerst Cache laden (sofort sichtbar)
    get<WeatherData>(CACHE_KEY).then((cached) => {
      if (cached) {
        setWeather(cached);
        fetchWeather(true);   // stilles Update im Hintergrund
      } else {
        fetchWeather(false);  // erster Start → sichtbares Loading
      }
    });

    // 2. Alle 30 Minuten automatisch aktualisieren
    intervalRef.current = setInterval(() => fetchWeather(true), REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const minutesAgo = weather
    ? Math.floor((Date.now() - weather.fetchedAt) / 60_000)
    : null;

  return { weather, loading, minutesAgo };
}
