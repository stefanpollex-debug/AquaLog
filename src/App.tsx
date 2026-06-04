import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

import { usePoolEntries }    from "./hooks/usePoolEntries";
import { usePoolProfile }    from "./hooks/usePoolProfile";
import { useWeather }        from "./hooks/useWeather";
import { LIMITS, STALE_DAYS, type FieldKey } from "./utils/constants";
import { getStatus, daysSince }              from "./utils/status";
import { getTipWithDose }                    from "./utils/dosage";
import { getWeatherPoolHints, getWmoIcon }   from "./utils/weather";

import { PhotoScanner }      from "./components/PhotoScanner";
import { ValueSlider }       from "./components/ValueSlider";
import { StatCard }          from "./components/StatCard";
import { DeleteConfirm }     from "./components/DeleteConfirm";
import { StatusBadge }       from "./components/StatusBadge";
import { TrafficLight }      from "./components/TrafficLight";
import { CalendarHeatmap }   from "./components/CalendarHeatmap";
import { SwimmingReadiness } from "./components/SwimmingReadiness";
import { PoolProfileSheet }  from "./components/PoolProfileSheet";
import { DoseCalculator }    from "./components/DoseCalculator";
import { AiWaterReport }     from "./components/AiWaterReport";
import { WeatherWidget }     from "./components/WeatherWidget";
import { TrendsView }        from "./components/TrendsView";
import { ChemLogInput }      from "./components/ChemLogInput";
import { type PoolEntry, type ChemicalAddition } from "./hooks/usePoolEntries";

type Tab = "eingabe" | "verlauf" | "trends" | "hinweise";

const DEFAULT_VALUES = { cl: 1.0, ph: 7.0, temp: 22 };
const FIELD_LABELS: Record<FieldKey, string> = {
  cl: "🟦 Chlor (Cl)", ph: "🟣 pH-Wert", temp: "🟠 Temperatur",
};

export default function App() {
  const { entries, loaded, addEntry, deleteEntry } = usePoolEntries();
  const { profile, saveProfile }                   = usePoolProfile();
  const { weather, loading: wxLoading, minutesAgo } = useWeather();

  const [form, setForm]       = useState({ date: new Date().toISOString().slice(0, 10), note: "", ...DEFAULT_VALUES });
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({ cl: false, ph: false, temp: false });
  const [tab, setTab]         = useState<Tab>("eingabe");
  const [saved, setSaved]     = useState(false);
  const [chemicals, setChemicals]          = useState<ChemicalAddition[]>([]);
  const [deleteTarget, setDeleteTarget]    = useState<PoolEntry | null>(null);
  const [showList, setShowList]            = useState(false);
  const [showProfileSheet, setShowProfile] = useState(false);

  const touch = (k: FieldKey, v: number) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleAiResult = ({ cl, ph, temp }: { cl: number; ph: number; temp: number | null }) => {
    setForm((f) => ({ ...f, cl, ph, ...(temp != null ? { temp } : {}) }));
    setTouched((t) => ({ ...t, cl: true, ph: true, ...(temp != null ? { temp: true } : {}) }));
  };

  const canSave = touched.cl && touched.ph && touched.temp;

  const handleAdd = () => {
    if (!canSave) return;
    addEntry({
      date: form.date,
      cl:   +form.cl,
      ph:   +form.ph,
      temp: +form.temp,
      note: form.note,
      // Wetter automatisch speichern (Temp + UV + heutiger Tages-Niederschlag)
      ...(weather ? {
        outTemp: weather.currentTemp,
        uvIndex: weather.currentUv,
        rainMm:  weather.forecast[0]?.precipSum ?? weather.currentPrecipitation,
      } : {}),
      // Chemikalien
      ...(chemicals.length > 0 ? { chemicals } : {}),
    });
    setForm({ date: new Date().toISOString().slice(0, 10), note: "", ...DEFAULT_VALUES });
    setTouched({ cl: false, ph: false, temp: false });
    setChemicals([]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const last          = entries[0];
  const chartData     = [...entries].reverse().slice(-20);
  const daysSinceLast = last ? daysSince(last.date) : null;
  const staleWarn     = daysSinceLast !== null && daysSinceLast >= STALE_DAYS;
  const volumeM3      = profile.volumeLiters / 1000;

  const poolTips = last
    ? (["cl", "ph", "temp"] as FieldKey[])
        .map((k) => {
          const st = getStatus(k, last[k]);
          return st !== "ok" ? getTipWithDose(k, st, last[k], volumeM3) : null;
        })
        .filter(Boolean)
    : [];

  const weatherHints = weather ? getWeatherPoolHints(weather) : [];

  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#e0f2fe,#bae6fd)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#0369a1", fontWeight: 600 }}>Lade Daten…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 100%)", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px" }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ background: "linear-gradient(135deg,#0369a1,#0284c7)", padding: "20px 20px 16px", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>🏊 Pool Bericht</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 2 }}>
                {profile.name} · {profile.volumeLiters} L
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {daysSinceLast !== null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }}>{daysSinceLast}</div>
                  <div style={{ fontSize: "0.65rem", opacity: 0.8 }}>Tage seit letzter<br />Messung</div>
                </div>
              )}
              <button
                onClick={() => setShowProfile(true)}
                style={{
                  background: "rgba(255,255,255,0.15)", border: "none",
                  borderRadius: 10, padding: "6px 8px", cursor: "pointer",
                  fontSize: "1.1rem", lineHeight: 1, color: "white", marginTop: 2,
                }}
              >⚙️</button>
            </div>
          </div>

          {/* Pool-Werte */}
          {last && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              {(["cl", "ph", "temp"] as FieldKey[]).map((k) => (
                <div key={k} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "5px 10px", fontSize: "0.75rem" }}>
                  <span style={{ opacity: 0.8 }}>{LIMITS[k].label}: </span>
                  <b>{last[k].toFixed(1)}{LIMITS[k].unit}</b>
                  <span style={{ marginLeft: 4 }}><TrafficLight status={getStatus(k, last[k])} /></span>
                </div>
              ))}
            </div>
          )}

          {/* Kompaktes Wetter-Strip */}
          {weather && (
            <div style={{
              marginTop: 12,
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.12)", borderRadius: 10,
              padding: "6px 12px", fontSize: "0.75rem",
            }}>
              <span style={{ fontSize: "1.1rem" }}>{getWmoIcon(weather.weatherCode)}</span>
              <span style={{ opacity: 0.9 }}>{weather.currentTemp.toFixed(1)}°C</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.9 }}>UV {weather.currentUv.toFixed(1)}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ opacity: 0.7 }}>Espelkamp</span>
              {minutesAgo !== null && minutesAgo > 60 && (
                <span style={{ opacity: 0.5, fontSize: "0.65rem", marginLeft: "auto" }}>📴 offline</span>
              )}
            </div>
          )}
        </div>

        {/* Stale warning */}
        {staleWarn && (
          <div style={{ background: "#ef4444", color: "white", padding: "10px 20px", fontWeight: 700, fontSize: "0.85rem", textAlign: "center" }}>
            ⚠️ Letzte Messung vor {daysSinceLast} Tagen – bitte jetzt messen!
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", background: "white", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
          {(["eingabe", "verlauf", "trends", "hinweise"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              eingabe: "✏️ Eingabe",
              verlauf: "📈 Verlauf",
              trends:  "📊 Trends",
              hinweise:"💡 Tipps",
            };
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "11px 2px", border: "none", background: "none", cursor: "pointer",
                fontWeight: tab === t ? 700 : 500, fontSize: "0.74rem",
                color: tab === t ? "#0369a1" : "#64748b",
                borderBottom: tab === t ? "2px solid #0369a1" : "2px solid transparent",
                whiteSpace: "nowrap",
              }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "16px 16px 0" }}>

          {/* ── Tab: Eintragen ───────────────────────────────────── */}
          {tab === "eingabe" && (
            <div>
              {/* Datum – kompakte Zeile */}
              <div style={{ display: "flex", alignItems: "center", background: "white", borderRadius: 12, padding: "8px 14px", boxShadow: "0 2px 12px #0369a110", marginBottom: 10 }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", flexShrink: 0 }}>📅 Datum</span>
                <input
                  type="date" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: "0.88rem", fontWeight: 700, color: "#1e293b", outline: "none", textAlign: "right" }}
                />
              </div>

              {/* Photo scanner */}
              <div style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 2px 12px #0369a110", marginBottom: 12 }}>
                <PhotoScanner onResult={handleAiResult} />
              </div>

              {/* Sliders */}
              {(["cl", "ph", "temp"] as FieldKey[]).map((k) => (
                <div key={k} style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 2px 12px #0369a110", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>{FIELD_LABELS[k]}</span>
                    <TrafficLight status={touched[k] ? getStatus(k, form[k]) : "ok"} />
                  </div>
                  <ValueSlider field={k} value={form[k]} touched={touched[k]} onChange={(v) => touch(k, v)} />
                </div>
              ))}

              {/* Notiz + Chemikalien – eine gemeinsame Karte */}
              <div style={{ background: "white", borderRadius: 18, padding: 14, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="📝 Notiz (optional)"
                  rows={2}
                  style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "9px 12px", fontSize: "0.88rem", resize: "none", boxSizing: "border-box", marginBottom: 12 }}
                />
                <ChemLogInput value={chemicals} onChange={setChemicals} />
              </div>

              {/* Wetter-Info beim Speichern */}
              {weather && (
                <div style={{ background: "#f0f9ff", borderRadius: 12, padding: "8px 14px", marginBottom: 14, fontSize: "0.75rem", color: "#0369a1", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{getWmoIcon(weather.weatherCode)}</span>
                  <span>
                    Wird gespeichert: {weather.currentTemp.toFixed(1)}°C · UV {weather.currentUv.toFixed(1)}
                    {(() => {
                      const mm = weather.forecast[0]?.precipSum ?? weather.currentPrecipitation;
                      return mm > 0 ? ` · 💧 ${mm.toFixed(1)} mm Regen` : "";
                    })()}
                  </span>
                </div>
              )}

              {/* Speichern-Button */}
              <button
                onClick={handleAdd} disabled={!canSave}
                style={{
                  width: "100%", padding: 15,
                  background: canSave ? "linear-gradient(90deg,#0369a1,#0ea5e9)" : "#e2e8f0",
                  color: canSave ? "white" : "#94a3b8",
                  border: "none", borderRadius: 14, fontWeight: 700, fontSize: "1rem",
                  cursor: canSave ? "pointer" : "not-allowed", transition: "all 0.2s",
                }}
              >
                {canSave ? "💾 Messung speichern" : "⬆️ Alle 3 Werte per Slider setzen"}
              </button>

              {saved && (
                <div style={{ marginTop: 12, background: "#d1fae5", borderRadius: 12, padding: "12px 16px", color: "#065f46", fontWeight: 700, textAlign: "center", fontSize: "0.9rem" }}>
                  ✅ Messung gespeichert!
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Verlauf ─────────────────────────────────────── */}
          {tab === "verlauf" && (
            <div>
              {/* Badebereit-Ampel */}
              <SwimmingReadiness last={last} daysSinceLast={daysSinceLast} />

              {/* Wetter-Widget */}
              <WeatherWidget weather={weather} loading={wxLoading} minutesAgo={minutesAgo} />

              <StatCard entries={entries} />

              <CalendarHeatmap entries={entries} onDelete={(e) => setDeleteTarget(e)} />

              {/* Charts */}
              {(["cl", "ph", "temp"] as FieldKey[]).map((k) => (
                <div key={k} style={{ background: "white", borderRadius: 18, padding: "16px 8px 8px", boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 8, paddingLeft: 8, fontSize: "0.88rem" }}>{FIELD_LABELS[k]}</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis domain={[LIMITS[k].sliderMin, LIMITS[k].sliderMax]} tick={{ fontSize: 10 }} width={30} />
                      <Tooltip formatter={(v: number) => [`${v}${LIMITS[k].unit}`, LIMITS[k].label]} labelFormatter={(l: string) => `Datum: ${l}`} />
                      <ReferenceLine y={LIMITS[k].min} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
                      <ReferenceLine y={LIMITS[k].max} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
                      <Line type="monotone" dataKey={k} stroke={LIMITS[k].color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ))}

              {/* Alle Messungen – ausklappbar */}
              <div style={{ marginBottom: 14 }}>
                <button
                  onClick={() => setShowList(v => !v)}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", background: "white", border: "none",
                    borderRadius: 14, padding: "12px 14px", cursor: "pointer",
                    boxShadow: "0 1px 6px #0369a10d",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.88rem" }}>
                    📋 Alle Messungen ({entries.length})
                  </span>
                  <span style={{
                    color: "#94a3b8", fontSize: "0.85rem", transition: "transform 0.2s",
                    display: "inline-block", transform: showList ? "rotate(180deg)" : "rotate(0deg)",
                  }}>▼</span>
                </button>

                {showList && (
                  <div style={{ marginTop: 8 }}>
                    {entries.map((e) => (
                      <div key={e.id} style={{ background: "white", borderRadius: 12, padding: "9px 12px", marginBottom: 6, boxShadow: "0 1px 4px #0369a10d" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Zeile 1: Datum + Wetter */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#475569" }}>
                                {new Date(e.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                              </span>
                              {e.outTemp != null && (
                                <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>🌡️{e.outTemp.toFixed(0)}°</span>
                              )}
                              {e.uvIndex != null && (
                                <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>🔆{e.uvIndex.toFixed(0)}</span>
                              )}
                              {e.note && (
                                <span style={{ fontSize: "0.68rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} title={e.note}>
                                  · {e.note}
                                </span>
                              )}
                            </div>
                            {/* Zeile 2: Messwerte */}
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              {(["cl", "ph", "temp"] as FieldKey[]).map((k) => (
                                <span key={k} style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 3 }}>
                                  <b style={{ color: "#1e293b" }}>{e[k].toFixed(1)}{LIMITS[k].unit}</b>
                                  <StatusBadge status={getStatus(k, e[k])} />
                                </span>
                              ))}
                              {e.chemicals?.map(c => (
                                <span key={c.product} style={{ fontSize: "0.65rem", background: "#f0fdf4", color: "#15803d", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                                  🧪 {c.amount}{c.unit}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => setDeleteTarget(e)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: "#e2e8f0", padding: "0 0 0 8px", flexShrink: 0 }}
                          >🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab: Trends ──────────────────────────────────────── */}
          {tab === "trends" && (
            <div>
              <div style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.95rem", marginBottom: 14 }}>
                📊 Trendanalyse
              </div>
              <TrendsView entries={entries} />
            </div>
          )}

          {/* ── Tab: Hinweise ────────────────────────────────────── */}
          {tab === "hinweise" && (
            <div>
              {/* Wetter-Pool-Hinweise */}
              {weatherHints.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#d97706", marginBottom: 10, fontSize: "0.92rem" }}>
                    🌤️ Wetter-Hinweise
                  </div>
                  {weatherHints.map((hint, i) => (
                    <div key={i} style={{
                      background: "white", borderRadius: 14, padding: "12px 16px", marginBottom: 8,
                      boxShadow: "0 2px 8px #f59e0b10", borderLeft: "4px solid #f59e0b",
                    }}>
                      <p style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.6, color: "#1e293b" }}>{hint}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Aktuelle Pool-Maßnahmen */}
              {poolTips.length > 0 ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 10, fontSize: "0.95rem" }}>🚨 Aktuelle Maßnahmen</div>
                  {poolTips.map((tip, i) => (
                    <div key={i} style={{ background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 2px 8px #ef44440d", borderLeft: "4px solid #f59e0b" }}>
                      <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.6, color: "#1e293b" }}>{tip}</p>
                    </div>
                  ))}
                </div>
              ) : last ? (
                <div style={{ background: "#d1fae5", borderRadius: 14, padding: 16, marginBottom: 14, textAlign: "center" }}>
                  <div style={{ fontSize: "1.5rem" }}>✅</div>
                  <div style={{ fontWeight: 700, color: "#065f46", marginTop: 6 }}>Alle Werte im grünen Bereich!</div>
                  <div style={{ fontSize: "0.8rem", color: "#047857", marginTop: 4 }}>Letzte Messung: {last.date}</div>
                </div>
              ) : null}

              {/* Dosierrechner */}
              <DoseCalculator
                volumeLiters={profile.volumeLiters}
                currentCl={last?.cl}
                currentPh={last?.ph}
              />

              {/* KI-Wasseranalyse */}
              <AiWaterReport last={last} profile={profile} daysSinceLast={daysSinceLast} />

              {/* OK-Bereiche */}
              <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 12, fontSize: "0.95rem" }}>ℹ️ OK-Bereiche</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {(["cl", "ph", "temp"] as FieldKey[]).map((k) => (
                    <div key={k} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 4 }}>{LIMITS[k].label}</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#22c55e" }}>{LIMITS[k].min}–{LIMITS[k].max}</div>
                      <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{LIMITS[k].unit || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          entry={deleteTarget}
          onConfirm={() => { deleteEntry(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Pool-Profil Sheet */}
      {showProfileSheet && (
        <PoolProfileSheet
          profile={profile}
          onSave={saveProfile}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
