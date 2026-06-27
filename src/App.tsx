import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

import { usePoolEntries }    from "./hooks/usePoolEntries";
import { usePoolProfile }    from "./hooks/usePoolProfile";
import { useWeather }        from "./hooks/useWeather";
import { usePinLock }        from "./hooks/usePinLock";
import { useSwUpdate }       from "./hooks/useSwUpdate";
import { useOnboarding }     from "./hooks/useOnboarding";
import { LIMITS, STALE_DAYS, getLimitsForPoolType, type FieldKey } from "./utils/constants";
import { getStatus, daysSince, localToday }                        from "./utils/status";
import { getTipWithDose }                                          from "./utils/dosage";
import { getWeatherPoolHints, getWmoIcon }                         from "./utils/weather";
import { assessRisk, formatRetestIn, calculateLSI }                from "./utils/contextualRisk";

import { PinScreen }         from "./components/PinScreen";
import { OnboardingFlow }    from "./components/OnboardingFlow";
import { PhotoScanner, type PhotoScanResult } from "./components/PhotoScanner";
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
import { WaterChangeCard }   from "./components/WaterChangeCard";
import { ProblemDiagnose }      from "./components/ProblemDiagnose";
import { FilterCareCard }       from "./components/FilterCareCard";
import { WasseranalyseView }    from "./components/WasseranalyseView";
import { type PoolEntry, type ChemicalAddition } from "./hooks/usePoolEntries";
import { useWaterChange }    from "./hooks/useWaterChange";
import { useFilterLog }      from "./hooks/useFilterLog";
import { daysSinceLastAddition, getWaterStatus } from "./utils/waterChange";
import { daysSinceEntry }    from "./utils/filterLog";

type Tab = "eingabe" | "verlauf" | "trends" | "hinweise" | "quellen";

const DEFAULT_VALUES = { cl: 1.0, ph: 7.4, temp: 24, kh: 100, gh: 150 };
const FIELD_LABELS: Record<FieldKey, string> = {
  cl: "Chlor (Cl)", ph: "pH-Wert", temp: "Temperatur", kh: "Alkalinität (KH)", gh: "Gesamthärte (GH)",
};

export default function App() {
  const { hasPin, unlocked, loading: pinLoading, attempts, lockedUntil, setPin, verifyPin, checkPin, clearPin } = usePinLock();
  const { updateReady, applyUpdate } = useSwUpdate();
  const { onboardingDone, completeOnboarding } = useOnboarding();
  const { entries, loaded, addEntry, deleteEntry, bulkImport: bulkImportEntries } = usePoolEntries();
  const { profile, saveProfile }                   = usePoolProfile();
  const waterChange = useWaterChange();
  const filterLog   = useFilterLog();
  const { weather, loading: wxLoading, minutesAgo } = useWeather();

  const [form, setForm]       = useState({ date: localToday(), note: "", ...DEFAULT_VALUES });
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({ cl: false, ph: false, temp: false, kh: false, gh: false });
  const [cyaValue, setCyaValue]   = useState(50);
  const [cyaTouched, setCyaTouched] = useState(false);
  const [tab, setTab]         = useState<Tab>("eingabe");
  const [saved, setSaved]     = useState(false);
  const [chemicals, setChemicals]          = useState<ChemicalAddition[]>([]);
  const [deleteTarget, setDeleteTarget]    = useState<PoolEntry | null>(null);
  const [showChloramine, setShowChloramine] = useState(false);
  const [showList, setShowList]            = useState(false);
  const [showProfileSheet, setShowProfile] = useState(false);

  const touch = (k: FieldKey, v: number) => {
    setTouched((t) => ({ ...t, [k]: true }));
    setForm((f) => ({ ...f, [k]: v }));
  };

  // Schützt vor unsinnigen KI-Ausreißern (z.B. Foto-Fehlinterpretation) — begrenzt
  // auf den Slider-Bereich, statt unvalidierte Werte in LSI/Risikobewertung einfließen zu lassen.
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const handleAiResult = ({ cl, ph, temp, kh, gh, cya }: PhotoScanResult) => {
    const khClamped  = kh  != null ? clamp(kh,  LIMITS.kh.sliderMin,  LIMITS.kh.sliderMax)  : null;
    const ghClamped  = gh  != null ? clamp(gh,  LIMITS.gh.sliderMin,  LIMITS.gh.sliderMax)  : null;
    const cyaClamped = cya != null ? clamp(cya, 0, 300) : null;

    setForm((f) => ({
      ...f, cl, ph,
      ...(temp != null ? { temp } : {}),
      ...(khClamped != null ? { kh: khClamped } : {}),
      ...(ghClamped != null ? { gh: ghClamped } : {}),
    }));
    setTouched((t) => ({
      ...t, cl: true, ph: true,
      ...(temp != null ? { temp: true } : {}),
      ...(khClamped != null ? { kh: true } : {}),
      ...(ghClamped != null ? { gh: true } : {}),
    }));
    if (cyaClamped != null) {
      setCyaValue(cyaClamped);
      setCyaTouched(true);
    }
  };

  const canSave = touched.cl && touched.ph && touched.temp;

  const handleAdd = async () => {
    if (!canSave) return;
    addEntry({
      date: form.date,
      cl:   +form.cl,
      ph:   +form.ph,
      temp: +form.temp,
      ...(touched.kh ? { kh: +form.kh } : {}),
      ...(touched.gh ? { gh: +form.gh } : {}),
      ...(cyaTouched ? { cya: cyaValue } : {}),
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
    setForm({ date: localToday(), note: "", ...DEFAULT_VALUES });
    setTouched({ cl: false, ph: false, temp: false, kh: false, gh: false });
    setCyaValue(50);
    setCyaTouched(false);
    setChemicals([]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const activeLimits   = getLimitsForPoolType(profile.poolType);

  const last          = entries[0];
  const riskAssessment = last ? assessRisk(last, entries, activeLimits) : null;
  const chartData     = [...entries].reverse().slice(-20);
  const daysSinceLast = last ? daysSince(last.date) : null;
  const staleWarn     = daysSinceLast !== null && daysSinceLast >= STALE_DAYS;
  const volumeM3         = profile.volumeLiters / 1000;
  const waterChangeDue = getWaterStatus(
    daysSinceLastAddition(waterChange.record),
    waterChange.record.intervalDays
  ) === "danger";

  // ── Browser-Benachrichtigungen (PWA) ─────────────────────────────────────
  const notify = useCallback((_id: number, storageKey: string, body: string) => {
    const today = localToday();
    if (localStorage.getItem(storageKey) === today) return;
    localStorage.setItem(storageKey, today);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("AquaLog", { body, icon: "/apple-touch-icon.png" });
    }
  }, []);

  // Filterpflege-Erinnerung
  useEffect(() => {
    if (filterLog.lastClean) {
      const d = daysSinceEntry(filterLog.lastClean);
      if (d >= filterLog.settings.cleanIntervalDays)
        notify(101, "filterCleanNotified", `🧽 Filterreinigung fällig — letzter Termin vor ${d} Tagen`);
    }
    if (filterLog.lastReplace) {
      const d = daysSinceEntry(filterLog.lastReplace);
      if (d >= filterLog.settings.replaceIntervalDays)
        notify(102, "filterReplaceNotified", `🔄 Filterwechsel empfohlen — letzter Wechsel vor ${d} Tagen`);
    }
  }, [filterLog.lastClean, filterLog.lastReplace, filterLog.settings, notify]);

  // Wasserwechsel-Erinnerung
  useEffect(() => {
    const d = daysSinceLastAddition(waterChange.record);
    if (d !== null && d >= waterChange.record.intervalDays)
      notify(103, "waterChangeNotified", `💧 Teilwasserwechsel fällig — letzter Eintrag vor ${d} Tagen`);
  }, [waterChange.record, notify]);

  const poolTips = last
    ? (["cl", "ph", "temp", "kh", "gh"] as FieldKey[])
        .map((k) => {
          const val = last[k as keyof typeof last] as number | undefined;
          if (val == null) return null;
          const st = getStatus(k, val, activeLimits);
          return st !== "ok" ? getTipWithDose(k, st, val, volumeM3, activeLimits) : null;
        })
        .filter(Boolean)
    : [];

  const weatherHints = weather ? getWeatherPoolHints(weather) : [];

  // Algenvorbeugung: letzter Eintrag mit Algenmittel
  const lastAlgenEntry = entries.find(e => e.chemicals?.some(c => c.product === "algenmittel"));
  const daysSinceAlgen = lastAlgenEntry ? daysSince(lastAlgenEntry.date) : null;
  const algenDue = daysSinceAlgen === null || daysSinceAlgen >= 14;

  // 1. Wait until we know whether a PIN exists
  if (pinLoading) return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#0369a1", fontWeight: 600 }}>Lade…</div>
    </div>
  );

  // 2. PIN is set but not yet entered this session
  if (hasPin && !unlocked) {
    return (
      <PinScreen
        attempts={attempts}
        lockedUntil={lockedUntil}
        onVerify={verifyPin}
      />
    );
  }

  // 3. Onboarding state still loading from IndexedDB
  if (onboardingDone === null) return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#0369a1", fontWeight: 600 }}>Lade…</div>
    </div>
  );

  // 4. First launch — show onboarding
  if (!onboardingDone) {
    return (
      <OnboardingFlow
        onComplete={completeOnboarding}
        onSetPin={setPin}
      />
    );
  }

  // 5. Data still loading
  if (!loaded) return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#0369a1", fontWeight: 600 }}>Lade Daten…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "system-ui,sans-serif" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 80px" }}>

        {/* ── Header ──────────────────────────────────────────────── */}
        <div style={{ background: "linear-gradient(135deg,#0369a1,#0284c7)", padding: "20px 20px 16px", color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>🏊 Pool Bericht</div>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, marginTop: 2 }}>
                {profile.name} · {profile.volumeLiters} L
              </div>
              <div style={{ fontSize: "0.65rem", opacity: 0.55, marginTop: 1 }}>
                {`v${__APP_VERSION__} · ${new Date(__BUILD_TIME__).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
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
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", opacity: staleWarn ? 0.55 : 1 }}>
                {(["cl", "ph", "temp", "kh", "gh"] as FieldKey[]).map((k) => {
                  const val = last[k as keyof typeof last] as number | undefined;
                  if (val == null) return null;
                  const isTempHigh = k === "temp" && typeof val === "number" && val > 32;
                  return (
                    <div key={k} style={{
                      background: isTempHigh ? "rgba(220,38,38,0.45)" : "rgba(255,255,255,0.15)",
                      borderRadius: 10, padding: "5px 10px", fontSize: "0.75rem",
                      border: isTempHigh ? "1px solid rgba(255,100,100,0.6)" : "none",
                    }}>
                      <span style={{ opacity: 0.8 }}>{LIMITS[k].label}: </span>
                      <b>{val.toFixed(k === "kh" || k === "gh" ? 0 : 1)}{LIMITS[k].unit}</b>
                      {isTempHigh && <span style={{ marginLeft: 3 }}>🔥</span>}
                      <span style={{ marginLeft: 4 }}><TrafficLight status={getStatus(k, val, activeLimits)} /></span>
                    </div>
                  );
                })}
              </div>

              {/* LSI-Kachel — nur wenn gh + kh im letzten Eintrag vorhanden */}
              {last.gh != null && last.kh != null && (() => {
                const lsi = calculateLSI(last.ph, last.temp, last.gh, last.kh);
                const pct = Math.max(0, Math.min(100, ((lsi + 1) / 2) * 100));
                const lsiColor = lsi < -0.3 ? "#ef4444" : lsi > 0.3 ? "#f97316" : "#22c55e";
                const lsiLabel = lsi < -0.5 ? "Stark korrosiv"
                               : lsi < -0.3 ? "Leicht korrosiv"
                               : lsi > 0.5  ? "Stark kalkbildend"
                               : lsi > 0.3  ? "Leicht kalkbildend"
                               : "Ausgewogen ✓";
                return (
                  <div style={{ marginTop: 8, background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: "0.7rem", opacity: 0.85, fontWeight: 600 }}>Langelier-Index (LSI)</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: lsiColor }}>{lsi.toFixed(2)} — {lsiLabel}</span>
                    </div>
                    <div style={{ position: "relative", height: 8, borderRadius: 4, background: "linear-gradient(to right,#ef4444 0%,#f59e0b 22%,#22c55e 40%,#22c55e 60%,#f59e0b 78%,#ef4444 100%)" }}>
                      <div style={{ position: "absolute", top: -3, left: `calc(${pct}% - 7px)`, width: 14, height: 14, borderRadius: "50%", background: "white", border: `3px solid ${lsiColor}`, boxShadow: `0 0 6px ${lsiColor}88` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", opacity: 0.55, marginTop: 4 }}>
                      <span>−1.0 korrosiv</span><span>0 ideal</span><span>+1.0 kalkig</span>
                    </div>
                  </div>
                );
              })()}

              {/* Gesamtrisiko-Ampel */}
              {riskAssessment && (
                <div style={{
                  marginTop: 10,
                  background: riskAssessment.overallRisk === "danger"  ? "rgba(185,28,28,0.85)"
                            : riskAssessment.overallRisk === "caution" ? "rgba(180,120,0,0.8)"
                            : "rgba(21,128,61,0.75)",
                  borderRadius: 10, padding: "7px 12px",
                  display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.75rem", color: "white",
                }}>
                  <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>
                    {riskAssessment.overallRisk === "danger" ? "🚨" : riskAssessment.overallRisk === "caution" ? "⚠️" : "✅"}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: riskAssessment.reasons.length > 1 ? 2 : 0 }}>
                      {riskAssessment.overallRisk === "danger"  ? "SICHERHEITSWARNUNG"
                      : riskAssessment.overallRisk === "caution" ? "Vorsicht"
                      : "Wasserqualität OK"}
                    </div>
                    {/* Alle Gründe zeigen, nicht nur den ersten — sonst verschwinden niedrigprio
                        Hinweise (z.B. Idealzone-Tipp) hinter einer vorrangigen Warnung. */}
                    {riskAssessment.reasons.map((r, i) => (
                      <div key={i} style={{ opacity: 0.92, lineHeight: 1.45, marginTop: i > 0 ? 3 : 0 }}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {staleWarn && (
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.55)", marginTop: 5, fontStyle: "italic" }}>
                  ⏱ Messung vor {daysSinceLast} Tagen – Werte möglicherweise veraltet
                </div>
              )}
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

        {/* ── Nicht-wegklickbarer Gefahren-Banner ────────────────── */}
        {riskAssessment?.overallRisk === "danger" && (
          <div style={{ background: "#7f1d1d", color: "white", padding: "14px 20px" }}>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <span>🚨</span>
              <span>SICHERHEITSWARNUNG — Pool nicht benutzen</span>
            </div>
            {riskAssessment.reasons.map((r, i) => (
              <div key={i} style={{
                fontSize: "0.79rem", lineHeight: 1.55, marginBottom: 4,
                paddingLeft: r.startsWith("🦠") || r.startsWith("🚨") || r.startsWith("⚠️") ? 0 : 12,
              }}>
                {r}
              </div>
            ))}
            {riskAssessment.urgentActions.length > 0 && (
              <div style={{
                marginTop: 10, background: "rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "8px 12px",
              }}>
                <div style={{ fontWeight: 700, fontSize: "0.72rem", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Sofortmaßnahmen
                </div>
                {riskAssessment.urgentActions.map((a, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", marginBottom: 3 }}>→ {a}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: "0.68rem", opacity: 0.7, fontStyle: "italic" }}>
              Diese Warnung verschwindet automatisch sobald du neue, sichere Messwerte einträgst.
            </div>
          </div>
        )}

        {/* Alert-Zone: kombiniert wenn beide aktiv */}
        {(staleWarn || waterChangeDue) && (
          <div style={{ background: staleWarn ? "#dc2626" : "#1d4ed8", color: "white" }}>
            {staleWarn && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: waterChangeDue ? "8px 20px 5px" : "10px 20px",
                fontWeight: 700, fontSize: "0.85rem",
              }}>
                ⚠️ Letzte Messung vor {daysSinceLast} Tagen – bitte jetzt messen!
              </div>
            )}
            {waterChangeDue && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: staleWarn ? "5px 20px 8px" : "10px 20px",
                fontWeight: 700, fontSize: "0.85rem",
                background: staleWarn ? "rgba(0,0,0,0.18)" : undefined,
              }}>
                💧 Teilwasserwechsel fällig – Frischwasser zugeben!
              </div>
            )}
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", background: "white", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 10 }}>
          {(["eingabe", "verlauf", "trends", "hinweise", "quellen"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = {
              eingabe: "Eingabe",
              verlauf: "Verlauf",
              trends:  "Trends",
              hinweise:"Tipps",
              quellen: "Quellen",
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
                <PhotoScanner onResult={handleAiResult} limits={activeLimits} />
              </div>

              {/* Sliders */}
              {(["cl", "ph", "temp", "kh", "gh"] as FieldKey[]).map((k) => (
                <div key={k} style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 2px 12px #0369a110", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>
                      {FIELD_LABELS[k]}
                      {(k === "kh" || k === "gh") && <span style={{ fontWeight: 400, fontSize: "0.72rem", color: "#94a3b8", marginLeft: 6 }}>optional</span>}
                    </span>
                    <TrafficLight status={touched[k] ? getStatus(k, form[k], activeLimits) : "ok"} />
                  </div>
                  <ValueSlider field={k} value={form[k]} touched={touched[k]} onChange={(v) => touch(k, v)} limits={activeLimits} />
                </div>
              ))}

              {/* CYA-Slider — für alle Pool-Typen sichtbar. Ob ein Stabilisator relevant ist,
                  hängt von der Sonnenexposition ab (Feld "Standort"), nicht vom Pool-Typ-Label —
                  das Profil kennt ohnehin keine reine Innenraum-Option, jeder Pool ist hier
                  implizit ein Außenpool. Frühere Annahme "Whirlpool/Spa = überdacht, kein UV"
                  war für dieses Datenmodell nie zutreffend. */}
              <div style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 2px 12px #0369a110", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>
                      Stabilisator (CYA)
                      <span style={{ fontWeight: 400, fontSize: "0.72rem", color: "#94a3b8", marginLeft: 6 }}>optional</span>
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 600, color:
                      !cyaTouched ? "#94a3b8"
                      : cyaValue > 100 ? "#ef4444"
                      : cyaValue > 90  ? "#f59e0b"
                      : cyaValue >= 30 && cyaValue <= 50 ? "#22c55e"
                      : "#f59e0b"
                    }}>
                      {cyaTouched
                        ? (cyaValue > 100 ? "zu hoch" : cyaValue > 90 ? "erhöht" : cyaValue >= 30 && cyaValue <= 50 ? "OK" : "akzeptabel")
                        : "nicht gesetzt"}
                    </span>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: "1.15rem", color: cyaTouched ? "#1e293b" : "#94a3b8" }}>
                        {cyaTouched ? `${cyaValue} mg/l` : "— nicht gesetzt"}
                      </span>
                      {!cyaTouched && <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>Slider bewegen zum Setzen</span>}
                    </div>
                    <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                      <div style={{
                        position: "absolute", left: 0, right: 0, height: 8, borderRadius: 8, overflow: "hidden",
                        background: "linear-gradient(to right,#fee2e2 0%,#fee2e2 10%,#d1fae5 10%,#d1fae5 16.7%,#fef3c7 16.7%,#fef3c7 33.3%,#fee2e2 33.3%,#fee2e2 100%)",
                        opacity: cyaTouched ? 1 : 0.4,
                      }} />
                      {cyaTouched && (
                        <div style={{
                          position: "absolute", left: 0, width: `${(cyaValue / 300) * 100}%`, height: 8, borderRadius: 8,
                          background: cyaValue > 100 ? "#ef4444" : cyaValue > 90 ? "#f59e0b" : "#22c55e",
                          transition: "width 0.1s, background 0.2s", opacity: 0.75,
                        }} />
                      )}
                      <input
                        type="range" min={0} max={300} step={5} value={cyaValue}
                        onChange={(e) => { setCyaValue(parseInt(e.target.value)); setCyaTouched(true); }}
                        style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, height: 28, cursor: "pointer", zIndex: 2 }}
                      />
                      <div style={{
                        position: "absolute",
                        left: cyaTouched ? `calc(${(cyaValue / 300) * 100}% - 11px)` : "calc(50% - 11px)",
                        width: 22, height: 22, borderRadius: "50%",
                        background: cyaTouched ? (cyaValue > 100 ? "#ef4444" : cyaValue > 90 ? "#f59e0b" : "#22c55e") : "#cbd5e1",
                        border: "3px solid white",
                        boxShadow: cyaTouched ? "0 2px 8px #0002" : "0 1px 4px #0001",
                        transition: "left 0.1s, background 0.2s", pointerEvents: "none", zIndex: 1,
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
                      <span>0 mg/l</span>
                      <span style={{ color: "#22c55e", fontWeight: 600 }}>Ideal: 30–50 mg/l</span>
                      <span>300 mg/l</span>
                    </div>
                  </div>
                </div>

              {/* LSI Live-Vorschau im Eingabe-Tab — wenn kh + gh gesetzt */}
              {touched.kh && touched.gh && (() => {
                const lsi = calculateLSI(form.ph, form.temp, form.gh, form.kh);
                const pct = Math.max(0, Math.min(100, ((lsi + 1) / 2) * 100));
                const lsiColor = lsi < -0.3 ? "#ef4444" : lsi > 0.3 ? "#f97316" : "#22c55e";
                const lsiLabel = lsi < -0.5 ? "Stark korrosiv"
                               : lsi < -0.3 ? "Leicht korrosiv"
                               : lsi > 0.5  ? "Stark kalkbildend"
                               : lsi > 0.3  ? "Leicht kalkbildend"
                               : "Ausgewogen ✓";
                return (
                  <div style={{ background: "white", borderRadius: 18, padding: 16, boxShadow: "0 2px 12px #0369a110", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>Langelier-Index (LSI)</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: lsiColor }}>{lsi.toFixed(2)} — {lsiLabel}</span>
                    </div>
                    <div style={{ position: "relative", height: 10, borderRadius: 5, background: "linear-gradient(to right,#ef4444 0%,#f59e0b 22%,#22c55e 40%,#22c55e 60%,#f59e0b 78%,#ef4444 100%)" }}>
                      <div style={{ position: "absolute", top: -4, left: `calc(${pct}% - 9px)`, width: 18, height: 18, borderRadius: "50%", background: "white", border: `3px solid ${lsiColor}`, boxShadow: `0 0 8px ${lsiColor}88` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#94a3b8", marginTop: 6 }}>
                      <span>−1.0 korrosiv</span><span style={{ color: "#22c55e", fontWeight: 600 }}>−0.3 bis +0.3 = ideal</span><span>+1.0 kalkig</span>
                    </div>
                  </div>
                );
              })()}

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
                <div style={{ marginTop: 12 }}>
                  <div style={{ background: "#d1fae5", borderRadius: 12, padding: "12px 16px", color: "#065f46", fontWeight: 700, textAlign: "center", fontSize: "0.9rem", marginBottom: 8 }}>
                    ✅ Messung gespeichert!
                  </div>
                  {riskAssessment && (
                    <div style={{
                      background: riskAssessment.overallRisk === "danger"  ? "#fee2e2"
                                : riskAssessment.overallRisk === "caution" ? "#fef3c7"
                                : "#f0fdf4",
                      borderRadius: 12, padding: "10px 16px",
                      color: riskAssessment.overallRisk === "danger"  ? "#991b1b"
                           : riskAssessment.overallRisk === "caution" ? "#92400e"
                           : "#065f46",
                      fontSize: "0.82rem", textAlign: "center", lineHeight: 1.5,
                    }}>
                      ⏱ Nächste Messung empfohlen in:{" "}
                      <b>{formatRetestIn(riskAssessment.retestIn)}</b>
                      {riskAssessment.overallRisk !== "safe" && (
                        <div style={{ marginTop: 4, fontSize: "0.72rem", opacity: 0.8 }}>
                          (erhöhter Chlorabbau bei {last?.temp.toFixed(0)}°C)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Verlauf ─────────────────────────────────────── */}
          {tab === "verlauf" && (
            <div>
              {/* Badebereit-Ampel */}
              <SwimmingReadiness last={last} daysSinceLast={daysSinceLast} limits={activeLimits} />

              {/* Wetter-Widget */}
              <WeatherWidget weather={weather} loading={wxLoading} minutesAgo={minutesAgo} />

              <StatCard entries={entries} limits={activeLimits} />

              <CalendarHeatmap entries={entries} onDelete={(e) => setDeleteTarget(e)} limits={activeLimits} />

              {/* Charts */}
              {(["cl", "ph", "temp", "kh", "gh"] as FieldKey[]).map((k) => (
                <div key={k} style={{ background: "white", borderRadius: 18, padding: "16px 8px 8px", boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#1e293b", marginBottom: 8, paddingLeft: 8, fontSize: "0.88rem" }}>{FIELD_LABELS[k]}</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
                      <YAxis domain={[LIMITS[k].sliderMin, LIMITS[k].sliderMax]} tick={{ fontSize: 10 }} width={30} />
                      <Tooltip formatter={(v: number) => [`${v}${LIMITS[k].unit}`, LIMITS[k].label]} labelFormatter={(l: string) => `Datum: ${l}`} />
                      <ReferenceLine y={activeLimits[k].min} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
                      <ReferenceLine y={activeLimits[k].max} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
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
                              {(["cl", "ph", "temp", "kh", "gh"] as FieldKey[]).map((k) => {
                                const val = e[k as keyof typeof e] as number | undefined;
                                if (val == null) return null;
                                return (
                                  <span key={k} style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 3 }}>
                                    <b style={{ color: "#1e293b" }}>{val.toFixed(k === "kh" || k === "gh" ? 0 : 1)}{LIMITS[k].unit}</b>
                                    <StatusBadge status={getStatus(k, val, activeLimits)} />
                                  </span>
                                );
                              })}
                              {e.cya != null && (
                                <span style={{ fontSize: "0.78rem", color: "#475569" }}>
                                  CYA: <b style={{ color: "#1e293b" }}>{e.cya}mg/l</b>
                                </span>
                              )}
                              {e.gh != null && e.kh != null && (() => {
                                const lsi = calculateLSI(e.ph, e.temp, e.gh, e.kh);
                                const lsiColor = lsi < -0.3 ? "#ef4444" : lsi > 0.3 ? "#f97316" : "#22c55e";
                                return (
                                  <span style={{ fontSize: "0.78rem", color: "#475569" }}>
                                    LSI: <b style={{ color: lsiColor }}>{lsi.toFixed(2)}</b>
                                  </span>
                                );
                              })()}
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
              <TrendsView entries={entries} limits={activeLimits} />
            </div>
          )}

          {/* ── Tab: Wasserquellen ───────────────────────────────── */}
          {tab === "quellen" && (
            <div>
              <div style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.95rem", marginBottom: 14 }}>
                🔬 Wasserquellen-Analyse
              </div>
              <WasseranalyseView
                spaEntries={entries}
                lastRainMm={weather?.forecast[0]?.precipSum ?? weather?.currentPrecipitation ?? 0}
              />
            </div>
          )}

          {/* ── Tab: Hinweise ────────────────────────────────────── */}
          {tab === "hinweise" && (
            <div>
              {/* Wetter-Pool-Hinweise */}
              {weatherHints.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 10, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Wetter-Hinweise
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
                  <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: 10, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Maßnahmen</div>
                  {poolTips.map((tip, i) => (
                    <div key={i} style={{ background: "white", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "0 2px 8px #ef44440d", borderLeft: "4px solid #f59e0b" }}>
                      <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.6, color: "#1e293b" }}>{tip}</p>
                    </div>
                  ))}
                </div>
              ) : last ? (
                <div style={{ background: "#f0fdf4", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, borderLeft: "4px solid #22c55e", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: "#15803d", fontSize: "0.9rem" }}>Alle Werte im grünen Bereich</div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                      Letzte Messung: {new Date(last.date + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Schritt 3: Algenvorbeugung */}
              <div style={{
                background: "white", borderRadius: 14, padding: "12px 16px", marginBottom: 14,
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                borderLeft: `4px solid ${algenDue ? "#f59e0b" : "#22c55e"}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: algenDue ? "#92400e" : "#15803d" }}>
                      🌿 Schritt 3 — Algenvorbeugung
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3, lineHeight: 1.5 }}>
                      {algenDue
                        ? daysSinceAlgen === null
                          ? "Noch nie eingetragen — vorbeugend alle 1–2 Wochen zugeben"
                          : `Letzter Eintrag vor ${daysSinceAlgen} Tagen — wieder fällig`
                        : `Zuletzt vor ${daysSinceAlgen} Tagen — im grünen Bereich`
                      }
                    </div>
                  </div>
                  <div style={{
                    background: algenDue ? "#fef3c7" : "#d1fae5",
                    color: algenDue ? "#92400e" : "#065f46",
                    borderRadius: 8, padding: "3px 8px", fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                  }}>
                    {algenDue ? "fällig" : "OK"}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: "0.72rem", color: "#475569", lineHeight: 1.6, background: "#f8fafc", borderRadius: 8, padding: "7px 10px" }}>
                  Algenmittel (z.B. Desalgin® JET) <b>vorbeugend</b> zugeben — bevor das Wasser grün wird. Menge: ca. 1–2 ml pro 1.000 L, gemäß Produktbeschriftung. Beim nächsten Messeintrag unter «Chemikalie» → Algenmittel eintragen.
                </div>
              </div>

              {/* Problem-Diagnose */}
              <ProblemDiagnose />

              {/* Filterpflege */}
              <FilterCareCard
                log={filterLog.log}
                settings={filterLog.settings}
                lastClean={filterLog.lastClean}
                lastReplace={filterLog.lastReplace}
                onAdd={filterLog.addEntry}
                onDelete={filterLog.deleteEntry}
                onSettings={filterLog.setSettings}
              />

              {/* Teilwasserwechsel */}
              <WaterChangeCard
                record={waterChange.record}
                onAdd={waterChange.addEntry}
                onDelete={waterChange.deleteEntry}
                onSaveRecord={waterChange.saveRecord}
                poolVolume={profile.volumeLiters}
                lastCl={last?.cl}
                lastPh={last?.ph}
              />

              {/* Dosierrechner */}
              <DoseCalculator
                volumeLiters={profile.volumeLiters}
                currentCl={last?.cl}
                currentPh={last?.ph}
                currentKh={last?.kh}
                currentGh={last?.gh}
              />

              {/* KI-Wasseranalyse */}
              <AiWaterReport last={last} profile={profile} daysSinceLast={daysSinceLast} limits={activeLimits} />

              {/* OK-Bereiche */}
              <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 12, fontSize: "0.95rem" }}>ℹ️ OK-Bereiche</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["cl", "ph", "temp", "kh", "gh"] as FieldKey[]).map((k) => (
                    <div key={k} style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.68rem", color: "#64748b", marginBottom: 4 }}>{LIMITS[k].label}</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#22c55e" }}>{activeLimits[k].min}–{activeLimits[k].max}</div>
                      <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>{LIMITS[k].unit || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chloramin-Info */}
              <div style={{ background: "white", borderRadius: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14, overflow: "hidden" }}>
                <button
                  onClick={() => setShowChloramine(v => !v)}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "none", border: "none", padding: "14px 18px", cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0369a1" }}>
                    🔬 Chlorgeruch trotz OK-Wert?
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem", transition: "transform 0.2s", display: "inline-block", transform: showChloramine ? "rotate(180deg)" : "none" }}>▼</span>
                </button>
                {showChloramine && (
                  <div style={{ padding: "0 18px 16px", borderTop: "1px solid #f1f5f9" }}>
                    <p style={{ margin: "12px 0 8px", fontSize: "0.83rem", color: "#374151", lineHeight: 1.65 }}>
                      Chlorgeruch ist <b>kein Zeichen für zu viel Chlor</b> — sondern für <b>gebundenes Chlor (Chloramine)</b>.
                      Diese entstehen wenn freies Chlor mit organischen Stoffen reagiert: Schweiß, Sonnencreme, Hautöl.
                      Chloramine haben keine desinfizierende Wirkung, riechen aber scharf und reizen Augen und Schleimhäute.
                    </p>
                    <div style={{ background: "#fef3c7", borderRadius: 10, padding: "10px 12px", marginBottom: 10, fontSize: "0.78rem", color: "#92400e" }}>
                      <b>Anzeichen:</b> Stechender Chlorgeruch · Gerötete Augen · Trübes Wasser — trotz Cl 3–5 mg/l
                    </div>
                    <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px", fontSize: "0.78rem", color: "#166534", lineHeight: 1.6 }}>
                      <b>Maßnahme: Stoßchlorierung</b><br />
                      1. Cl auf 10–15 mg/l erhöhen (Abdeckung auf, Pumpe läuft)<br />
                      2. 30 Min. umwälzen<br />
                      3. ⏰ 24–48 Std. Badepause bis Cl unter 5 mg/l<br />
                      4. Danach regelmäßig nach Nutzung lüften und Wasser alle 3 Monate wechseln
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SW-Update-Banner ──────────────────────────────────── */}
      {updateReady && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0,
          maxWidth: 480, margin: "0 auto",
          background: "#0369a1", color: "white",
          padding: "11px 16px",
          display: "flex", alignItems: "center", gap: 10,
          zIndex: 200, boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        }}>
          <span style={{ fontSize: "1rem", flexShrink: 0 }}>🔄</span>
          <span style={{ flex: 1, fontSize: "0.82rem", fontWeight: 500, lineHeight: 1.35 }}>
            Update verfügbar — neue Version bereit
          </span>
          <button
            onClick={applyUpdate}
            style={{
              background: "white", color: "#0369a1",
              border: "none", borderRadius: 8,
              padding: "6px 12px", fontSize: "0.78rem",
              fontWeight: 700, cursor: "pointer", flexShrink: 0,
            }}
          >
            Jetzt neu laden
          </button>
        </div>
      )}

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
          entries={entries}
          filterLog={filterLog.log}
          waterChange={waterChange.record}
          onImportEntries={bulkImportEntries}
          onImportFilterLog={filterLog.bulkImport}
          onImportWaterChange={waterChange.saveRecord}
          onImportProfile={saveProfile}
          hasPin={hasPin}
          onSetPin={setPin}
          onCheckPin={checkPin}
          onClearPin={clearPin}
        />
      )}
    </div>
  );
}
