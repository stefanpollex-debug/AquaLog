import { type WeatherData, getWmoIcon, getWmoLabel, forecastIcon } from "../utils/weather";

interface Props {
  weather: WeatherData | null;
  loading: boolean;
  minutesAgo: number | null;
}

const DAY_NAMES = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function uvColor(uv: number) {
  if (uv >= 8) return "#dc2626";
  if (uv >= 6) return "#d97706";
  if (uv >= 3) return "#16a34a";
  return "#64748b";
}

function uvLabel(uv: number) {
  if (uv >= 8) return "Sehr hoch";
  if (uv >= 6) return "Hoch";
  if (uv >= 3) return "Mittel";
  return "Niedrig";
}

export function WeatherWidget({ weather, loading, minutesAgo }: Props) {
  if (loading && !weather) {
    return (
      <div style={{ background: "white", borderRadius: 18, padding: "14px 18px", boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
        <div style={{ color: "#94a3b8", fontSize: "0.82rem" }}>🌤️ Wetterdaten werden geladen…</div>
      </div>
    );
  }
  if (!weather) return null;

  const isOffline = minutesAgo !== null && minutesAgo > 60;

  return (
    <div style={{ background: "white", borderRadius: 18, padding: "16px 18px 14px", boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>

      {/* Titelzeile */}
      <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#94a3b8", marginBottom: 10, letterSpacing: "0.03em" }}>
        📍 ESPELKAMP — AKTUELL
      </div>

      {/* Aktuelles Wetter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: "3rem", lineHeight: 1 }}>{getWmoIcon(weather.weatherCode)}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.8rem", color: "#1e293b", lineHeight: 1 }}>
              {weather.currentTemp.toFixed(1)}°C
            </div>
            <div style={{ fontSize: "0.73rem", color: "#64748b", marginTop: 3 }}>
              {getWmoLabel(weather.weatherCode)}
            </div>
          </div>
        </div>

        {/* UV-Index */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, fontSize: "1.4rem", color: uvColor(weather.currentUv), lineHeight: 1 }}>
            UV {weather.currentUv.toFixed(1)}
          </div>
          <div style={{ fontSize: "0.7rem", color: uvColor(weather.currentUv), marginTop: 2 }}>
            {uvLabel(weather.currentUv)}
          </div>
          {weather.currentPrecipitation > 0 && (
            <div style={{ fontSize: "0.68rem", color: "#0ea5e9", marginTop: 4 }}>
              💧 {weather.currentPrecipitation.toFixed(1)} mm
            </div>
          )}
        </div>
      </div>

      {/* 3-Tage-Vorschau */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {weather.forecast.map((day, i) => {
          const dow   = DAY_NAMES[new Date(day.date + "T12:00:00").getDay()];
          const label = i === 0 ? "Heute" : i === 1 ? "Morgen" : dow;
          return (
            <div key={day.date} style={{
              background: "#f8fafc", borderRadius: 10,
              padding: "8px 6px", textAlign: "center",
            }}>
              <div style={{ fontSize: "0.62rem", color: "#94a3b8", marginBottom: 3, fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: "1.4rem", lineHeight: 1, marginBottom: 3 }}>{forecastIcon(day)}</div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>{day.tempMax.toFixed(0)}°</div>
              <div style={{ fontSize: "0.6rem", color: "#94a3b8" }}>💧{day.precipProbability}%</div>
              <div style={{ fontSize: "0.6rem", color: uvColor(day.uvMax) }}>UV {day.uvMax.toFixed(0)}</div>
            </div>
          );
        })}
      </div>

      {/* Offline / Timestamp */}
      {isOffline ? (
        <div style={{ marginTop: 10, fontSize: "0.67rem", color: "#f59e0b", textAlign: "center" }}>
          📴 Offline-Modus — Stand: vor {minutesAgo} Minuten
        </div>
      ) : minutesAgo !== null && minutesAgo > 2 ? (
        <div style={{ marginTop: 8, fontSize: "0.6rem", color: "#cbd5e1", textAlign: "right" }}>
          Aktualisiert vor {minutesAgo} Min.
        </div>
      ) : null}
    </div>
  );
}
