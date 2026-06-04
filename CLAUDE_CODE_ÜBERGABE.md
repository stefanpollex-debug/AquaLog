# Pool Pflege-Bericht — Übergabe an Claude Code

## Auftrag
Dieses Projekt als echte PWA (Progressive Web App) weiterentwickeln:
installierbar auf dem Handy, offline-fähig, mit Push-Erinnerungen.

---

## Hardware / Pool
- **Modell:** Home Deluxe Spa DROP – 6 Personen
- **Volumen:** 950 Liter (0,95 m³)
- **Typ:** Outdoor-Spa (195 × 65 cm)
- **Teststreifen:** Misst Cl (0–2,0 mg/l) und pH (6,2–8,2)

---

## Grenzwerte
| Wert        | OK-Bereich     | Idealwert    |
|-------------|----------------|--------------|
| Chlor (Cl)  | 0,3–1,5 mg/l   | 0,6–1,0 mg/l |
| pH          | 6,6–7,8        | 7,0–7,4      |
| Temperatur  | 18–32 °C       | —            |

---

## Was bereits gebaut ist (vollständiger Code unten)

### Features
- **KI-Fotoauswertung** — Anthropic API (`claude-sonnet-4-20250514`)
  erkennt Cl, pH und Temperatur vom Teststreifen-Foto + optionalem Thermometer
- **Farbige Schieberegler** für Cl, pH, Temp mit live Ampel-Status
  Starten im „nicht gesetzt"-Zustand; Speichern erst wenn alle 3 gesetzt
- **Persistente Speicherung** — `window.storage` (Claude App), Fallback `localStorage`
  → In Claude Code durch **IndexedDB** ersetzen
- **Tage-Zähler** seit letzter Messung im Header, roter Banner ab 5 Tagen
- **Saisonstatistik** — Ø, Min/Max, % außerhalb OK pro Wert
- **Verlauf-Diagramme** (recharts) mit OK-Bereich-Referenzlinien
- **Lösch-Bestätigung** als Drawer-Modal von unten
- **Konkrete Dosierhinweise** berechnet auf 950 L:
  - pH-Plus: 2g pro +0,1 pH
  - pH-Minus: 1g pro -0,1 pH
  - Chlorgranulat: 1g pro +1 mg/l

### Komponenten (aktuell alles in einer Datei)
- `StatusBadge` — OK/Zu niedrig/Zu hoch Pill
- `TrafficLight` — 3-Punkte Ampel
- `ValueSlider` — Schieberegler mit Farbtrack + touched-State
- `PhotoScanner` — KI-Auswertung (idle/loading/result/error)
- `DeleteConfirm` — Modal Drawer
- `StatCard` — Saisonstatistik Grid
- `PoolBericht` — Hauptkomponent, 3 Tabs: Eintragen / Verlauf / Hinweise

### Hilfsfunktionen
- `getStatus(key, value)` → `"ok" | "low" | "high"`
- `daysSince(dateStr)` → Tage seit Datum
- `avg(arr, key)` / `pctOutOfRange(arr, key)` → Statistik
- `calcDose(product, targetChange, volumeM3)` → Gramm-Dosierung
- `getTipWithDose(key, status, currentValue, volume)` → Konkreter Hinweis mit Gramm-Angabe

### Erster Datensatz (Seed)
```json
{ "date": "2026-05-26", "cl": 1.0, "ph": 7.2, "temp": 26,
  "note": "Erstbetrieb – Pool neu befüllt", "id": 1748217600000 }
```

---

## Nächste Schritte (Priorität)

1. **Projekt aufsetzen:** Vite + React + TypeScript + Tailwind
2. **Code refaktorieren** in saubere Struktur:
   ```
   src/
     components/
       PhotoScanner.tsx
       ValueSlider.tsx
       StatCard.tsx
       DeleteConfirm.tsx
       StatusBadge.tsx
       TrafficLight.tsx
     hooks/
       usePoolEntries.ts   ← IndexedDB Persistenz
     utils/
       dosage.ts
       status.ts
     App.tsx
   ```
3. **PWA konfigurieren** (vite-plugin-pwa) — installierbar auf iOS & Android
4. **Offline-fähig** machen (Service Worker, Workbox)
5. **Push-Notifications** — Erinnerung wenn X Tage keine Messung
6. **Foto speichern** im Verlauf (IndexedDB, Blob)
7. **PDF-Export** der Saisonmessungen (jspdf)
8. **Chemikalien-Protokoll** — was wurde wann zugegeben
9. **Saison-Funktion** — Öffnen/Schließen mit getrennten Statistiken

---

## Wichtige Hinweise für Claude Code

- Die `window.storage`-Aufrufe sind Claude-App-spezifisch → **durch IndexedDB ersetzen**
- Anthropic API Key wird über Umgebungsvariable `VITE_ANTHROPIC_API_KEY` gesetzt
- Die App ist auf Deutsch (Benutzersprache Deutsch)
- Mobiloptimiert — primär iPhone-Nutzung am Pool

---

## Vollständiger Quellcode (pool-bericht.jsx)

```jsx
import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// ── Konstanten ────────────────────────────────────────────────────────────────
const LIMITS = {
  cl:   { min: 0.3, max: 1.5, step: 0.1, sliderMin: 0,  sliderMax: 2,  unit: "mg/l", label: "Chlor (Cl)",  color: "#0ea5e9" },
  ph:   { min: 6.6, max: 7.8, step: 0.1, sliderMin: 6,  sliderMax: 9,  unit: "",     label: "pH-Wert",     color: "#8b5cf6" },
  temp: { min: 18,  max: 32,  step: 0.5, sliderMin: 10, sliderMax: 40, unit: "°C",   label: "Temperatur",  color: "#f97316" },
};

const TIPS = {
  cl_low:    "⚠️ Chlor zu niedrig: Stoßchlorierung durchführen. Chlortabletten oder Flüssigchlor hinzufügen.",
  cl_high:   "⚠️ Chlor zu hoch: Pool 24–48 Std. ruhen lassen, nicht schwimmen.",
  ph_low:    "⚠️ pH zu niedrig: pH-Plus (Natriumcarbonat) zugeben. ~20g/10m³ erhöht pH um ~0,1.",
  ph_high:   "⚠️ pH zu hoch: pH-Minus (Natriumhydrogensulfat) zugeben. ~15g/10m³ senkt pH um ~0,1.",
  temp_low:  "ℹ️ Wassertemperatur niedrig: Chlorbedarf sinkt, Algen bilden sich langsamer.",
  temp_high: "⚠️ Wassertemperatur hoch: Chlorverbrauch steigt stark – häufiger testen und nachchloren.",
};

const FIRST_ENTRY = {
  date: "2026-05-26", cl: 1.0, ph: 7.2, temp: 26,
  note: "Erstbetrieb – Pool neu befüllt", id: 1748217600000,
};

// ── Pool-Konfiguration ───────────────────────────────────────────────────────
const POOL = {
  name: "Home Deluxe Spa DROP",
  volume: 0.95,
  type: "spa",
};

function calcDose(product, targetChange, volumeM3) {
  const factors = { ph_plus: 200, ph_minus: 150, chlor: 1500 };
  return Math.round(factors[product] * Math.abs(targetChange) * volumeM3);
}

function getTipWithDose(key, status, currentValue, volume) {
  const target = LIMITS[key];
  if (key === "cl" && status === "low") {
    const delta = target.min - currentValue + 0.3;
    const dose  = calcDose("chlor", delta, volume);
    return `⚠️ Chlor zu niedrig: Stoßchlorierung nötig. Für ${Math.round(volume*1000)} L jetzt ca. ${dose}g Chlorgranulat zugeben. Pool umwälzen, 4 Std. warten, dann erneut messen.`;
  }
  if (key === "cl" && status === "high")
    return `⚠️ Chlor zu hoch (${currentValue} mg/l): Spa 24–48 Std. nicht nutzen, Abdeckung offen lassen. Chlor baut sich von selbst ab.`;
  if (key === "ph" && status === "low") {
    const dose = calcDose("ph_plus", (7.2 - currentValue) / 0.1, volume);
    return `⚠️ pH zu niedrig (${currentValue}): pH-Plus zugeben. Für ${Math.round(volume*1000)} L ca. ${dose}g langsam einrühren, 1 Std. umwälzen, dann nachmessen.`;
  }
  if (key === "ph" && status === "high") {
    const dose = calcDose("ph_minus", (currentValue - 7.2) / 0.1, volume);
    return `⚠️ pH zu hoch (${currentValue}): pH-Minus zugeben. Für ${Math.round(volume*1000)} L ca. ${dose}g einrühren, 1 Std. warten, nachmessen. Immer pH vor Chlor korrigieren!`;
  }
  if (key === "temp" && status === "low")  return `ℹ️ Wassertemperatur niedrig: Chlorbedarf sinkt. Heizung prüfen.`;
  if (key === "temp" && status === "high") return `⚠️ Wassertemperatur hoch (${currentValue}°C): Chlorverbrauch stark erhöht – täglich kontrollieren.`;
  return null;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function getStatus(key, value) {
  const l = LIMITS[key];
  if (value < l.min) return "low";
  if (value > l.max) return "high";
  return "ok";
}
function daysSince(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, e) => s + e[key], 0) / arr.length;
}
function pctOutOfRange(arr, key) {
  if (!arr.length) return 0;
  return Math.round((arr.filter(e => getStatus(key, e[key]) !== "ok").length / arr.length) * 100);
}

// ── UI-Komponenten ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    ok:   { bg: "#d1fae5", color: "#065f46", label: "✓ OK" },
    low:  { bg: "#fef3c7", color: "#92400e", label: "↓ Zu niedrig" },
    high: { bg: "#fee2e2", color: "#991b1b", label: "↑ Zu hoch" },
  };
  const s = map[status];
  return <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>{s.label}</span>;
}

function TrafficLight({ status }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {["high","low","ok"].map(s => (
        <div key={s} style={{
          width: 13, height: 13, borderRadius: "50%",
          background: status === s ? (s==="ok"?"#22c55e":s==="low"?"#f59e0b":"#ef4444") : "#e5e7eb",
          boxShadow: status === s ? `0 0 7px ${s==="ok"?"#22c55e":s==="low"?"#f59e0b":"#ef4444"}` : "none",
          transition: "all 0.3s",
        }}/>
      ))}
    </div>
  );
}

function ValueSlider({ field, value, touched, onChange }) {
  const l = LIMITS[field];
  const pct  = ((value - l.sliderMin) / (l.sliderMax - l.sliderMin)) * 100;
  const okL  = ((l.min  - l.sliderMin) / (l.sliderMax - l.sliderMin)) * 100;
  const okR  = ((l.max  - l.sliderMin) / (l.sliderMax - l.sliderMin)) * 100;
  const st   = getStatus(field, value);
  const thumb = st === "ok" ? "#22c55e" : st === "low" ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: "1.15rem", color: touched ? "#1e293b" : "#94a3b8" }}>
          {touched ? `${value.toFixed(1)}${l.unit}` : "— nicht gesetzt"}
        </span>
        {touched && <StatusBadge status={st} />}
        {!touched && <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontStyle: "italic" }}>Slider bewegen zum Setzen</span>}
      </div>
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 8, borderRadius: 8, overflow: "hidden",
          background: `linear-gradient(to right,#fee2e2 0%,#fee2e2 ${okL}%,#d1fae5 ${okL}%,#d1fae5 ${okR}%,#fee2e2 ${okR}%,#fee2e2 100%)`,
          opacity: touched ? 1 : 0.4 }} />
        {touched && <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: 8, borderRadius: 8,
          background: thumb, transition: "width 0.1s, background 0.2s", opacity: 0.75 }} />}
        <input type="range" min={l.sliderMin} max={l.sliderMax} step={l.step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", opacity: 0, height: 28, cursor: "pointer", zIndex: 2 }} />
        <div style={{
          position: "absolute", left: touched ? `calc(${pct}% - 11px)` : "calc(50% - 11px)",
          width: 22, height: 22, borderRadius: "50%",
          background: touched ? thumb : "#cbd5e1", border: "3px solid white",
          boxShadow: touched ? `0 2px 8px ${thumb}88` : "0 1px 4px #0001",
          transition: "left 0.1s, background 0.2s", pointerEvents: "none", zIndex: 1,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#94a3b8", marginTop: 2 }}>
        <span>{l.sliderMin}{l.unit}</span>
        <span style={{ color: "#22c55e", fontWeight: 600 }}>OK: {l.min}–{l.max}</span>
        <span>{l.sliderMax}{l.unit}</span>
      </div>
    </div>
  );
}

function PhotoScanner({ onResult }) {
  const [state, setState]     = useState("idle");
  const [preview, setPreview] = useState(null);
  const [aiResult, setAi]     = useState(null);
  const [errMsg, setErrMsg]   = useState("");
  const inputRef              = useRef();

  const analyse = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result.split(",")[1];
      const mt  = file.type || "image/jpeg";
      setPreview(ev.target.result);
      setState("loading"); setAi(null);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: `Du bist ein Pool-Wassertest-Experte. Analysiere das Foto. Es kann einen Teststreifen UND/ODER ein Thermometer enthalten.

Teststreifen-Farbskala:
- Chlor (Cl): 0.0=farblos/weiß, 0.3=sehr helles pink, 0.6=helles pink, 1.0=mittleres rose, 1.5=kräftiges pink, 2.0=magenta
- pH: 6.2=gelb, 6.6=hellgelb-orange, 7.0=orange, 7.4=mittleres orange, 7.8=dunkles orange, 8.2=rot-orange

Thermometer: Lies die angezeigte Temperatur in Grad Celsius ab. Falls kein Thermometer sichtbar, setze "temp": null.

Antworte NUR mit JSON ohne Backticks:
{"cl":<Zahl>,"ph":<Zahl>,"temp":<Zahl oder null>,"confidence":"low|medium|high","notes":"<kurze Beschreibung was du siehst>"}

Falls gar kein Teststreifen erkennbar: {"error":"Kein Teststreifen erkennbar"}`,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
              { type: "text",  text: "Analysiere Teststreifen und Thermometer (falls vorhanden) auf diesem Foto." }
            ]}]
          })
        });
        const data   = await res.json();
        const text   = data.content?.find(b => b.type === "text")?.text || "";
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        if (parsed.error) { setState("error"); setErrMsg(parsed.error); return; }
        setAi(parsed); setState("result");
      } catch { setState("error"); setErrMsg("Auswertung fehlgeschlagen – bitte erneut versuchen."); }
    };
    reader.readAsDataURL(file);
  };

  const accept = () => {
    onResult({ cl: aiResult.cl, ph: aiResult.ph, temp: aiResult.temp ?? null });
    setState("idle"); setPreview(null); setAi(null);
  };
  const reset = () => { setState("idle"); setPreview(null); setAi(null); };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0369a1", marginBottom: 8 }}>📸 KI-Fotoauswertung</div>
      {state === "idle" && (
        <div onClick={() => inputRef.current.click()}
          onDrop={e => { e.preventDefault(); analyse(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          style={{ border: "2px dashed #bae6fd", borderRadius: 14, padding: "22px 16px", textAlign: "center", cursor: "pointer", background: "#f0f9ff" }}>
          <div style={{ fontSize: "2rem" }}>📷</div>
          <div style={{ fontWeight: 600, color: "#0369a1", marginTop: 6, fontSize: "0.9rem" }}>Teststreifen fotografieren</div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3 }}>KI liest Cl, pH und Temperatur automatisch aus</div>
          <input ref={inputRef} type="file" accept="image/*" capture="environment"
            style={{ display: "none" }} onChange={e => analyse(e.target.files[0])} />
        </div>
      )}
      {state === "loading" && (
        <div style={{ background: "#f0f9ff", borderRadius: 14, padding: 20, textAlign: "center" }}>
          {preview && <img src={preview} style={{ width:"100%", maxHeight:110, objectFit:"cover", borderRadius:10, marginBottom:12 }} />}
          <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:8 }}>
            {[0,1,2].map(i => <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:"#0ea5e9", animation:`bounce 1s ease ${i*0.2}s infinite` }}/>)}
          </div>
          <div style={{ fontWeight:600, color:"#0369a1", fontSize:"0.9rem" }}>KI analysiert Teststreifen…</div>
        </div>
      )}
      {state === "result" && aiResult && (
        <div style={{ background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:14, padding:16 }}>
          {preview && <img src={preview} style={{ width:"100%", maxHeight:100, objectFit:"cover", borderRadius:10, marginBottom:12 }} />}
          <div style={{ fontWeight:700, color:"#15803d", marginBottom:10, fontSize:"0.88rem" }}>✅ KI hat Werte erkannt:</div>
          <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
            {[["cl","Chlor (Cl)","mg/l"],["ph","pH-Wert",""]].map(([k,lbl,u]) => (
              <div key={k} style={{ background:"white", borderRadius:10, padding:"8px 12px", flex:1 }}>
                <div style={{ fontSize:"0.68rem", color:"#64748b" }}>{lbl}</div>
                <div style={{ fontWeight:700, fontSize:"1.1rem" }}>{aiResult[k]}{u}</div>
                <StatusBadge status={getStatus(k, aiResult[k])} />
              </div>
            ))}
            {aiResult.temp != null && (
              <div style={{ background:"white", borderRadius:10, padding:"8px 12px", flex:1 }}>
                <div style={{ fontSize:"0.68rem", color:"#64748b" }}>Temperatur</div>
                <div style={{ fontWeight:700, fontSize:"1.1rem" }}>{aiResult.temp}°C</div>
                <StatusBadge status={getStatus("temp", aiResult.temp)} />
              </div>
            )}
          </div>
          {aiResult.notes && <div style={{ fontSize:"0.77rem", color:"#475569", marginBottom:8, fontStyle:"italic" }}>💬 {aiResult.notes}</div>}
          <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginBottom:10 }}>
            Konfidenz: {aiResult.confidence==="high"?"🟢 Hoch":aiResult.confidence==="medium"?"🟡 Mittel":"🔴 Niedrig"}
          </div>
          {aiResult.temp == null && (
            <div style={{ background:"#fef9c3", borderRadius:8, padding:"8px 12px", fontSize:"0.78rem", color:"#713f12", marginBottom:12 }}>
              🌡️ Kein Thermometer erkannt – bitte Temperatur per Schieberegler einstellen.
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={accept} style={{ flex:1, padding:"10px", background:"linear-gradient(90deg,#15803d,#22c55e)", color:"white", border:"none", borderRadius:10, fontWeight:700, cursor:"pointer" }}>
              ✓ Werte übernehmen
            </button>
            <button onClick={reset} style={{ padding:"10px 14px", background:"#f1f5f9", border:"none", borderRadius:10, cursor:"pointer", fontWeight:600, color:"#64748b" }}>✕</button>
          </div>
        </div>
      )}
      {state === "error" && (
        <div style={{ background:"#fef2f2", border:"1.5px solid #fecaca", borderRadius:14, padding:16, textAlign:"center" }}>
          <div style={{ fontSize:"1.5rem" }}>😕</div>
          <div style={{ fontWeight:600, color:"#991b1b", margin:"8px 0 4px", fontSize:"0.88rem" }}>{errMsg}</div>
          <button onClick={reset} style={{ marginTop:8, padding:"8px 20px", background:"#ef4444", color:"white", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600 }}>
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteConfirm({ entry, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"white", borderRadius:"20px 20px 0 0", padding:"28px 24px 36px", width:"100%", maxWidth:480, boxShadow:"0 -8px 40px #0003" }}>
        <div style={{ fontSize:"1.5rem", textAlign:"center", marginBottom:10 }}>🗑️</div>
        <div style={{ fontWeight:700, fontSize:"1rem", textAlign:"center", marginBottom:6 }}>Eintrag löschen?</div>
        <div style={{ fontSize:"0.85rem", color:"#64748b", textAlign:"center", marginBottom:22 }}>
          Messung vom <b>{entry.date}</b> wird unwiderruflich gelöscht.
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:13, background:"#f1f5f9", border:"none", borderRadius:12, fontWeight:700, cursor:"pointer", color:"#475569" }}>Abbrechen</button>
          <button onClick={onConfirm} style={{ flex:1, padding:13, background:"linear-gradient(90deg,#dc2626,#ef4444)", color:"white", border:"none", borderRadius:12, fontWeight:700, cursor:"pointer" }}>Löschen</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ entries }) {
  if (entries.length < 2) return null;
  return (
    <div style={{ background:"white", borderRadius:18, padding:18, boxShadow:"0 2px 12px #0369a110", marginBottom:14 }}>
      <div style={{ fontWeight:700, color:"#0369a1", marginBottom:14, fontSize:"0.95rem" }}>📊 Saisonstatistik ({entries.length} Messungen)</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
        {[["cl","🟦","mg/l"],["ph","🟣",""],["temp","🟠","°C"]].map(([k,emoji,u]) => {
          const a   = avg(entries, k).toFixed(1);
          const mn  = Math.min(...entries.map(e => e[k])).toFixed(1);
          const mx  = Math.max(...entries.map(e => e[k])).toFixed(1);
          const pct = pctOutOfRange(entries, k);
          return (
            <div key={k} style={{ background:"#f8fafc", borderRadius:12, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:"1.1rem" }}>{emoji}</div>
              <div style={{ fontSize:"0.68rem", color:"#64748b", marginBottom:4 }}>{LIMITS[k].label}</div>
              <div style={{ fontWeight:700, fontSize:"1rem" }}>{a}{u}</div>
              <div style={{ fontSize:"0.65rem", color:"#94a3b8" }}>Ø Mittel</div>
              <div style={{ fontSize:"0.65rem", color:"#64748b", marginTop:4 }}>{mn} – {mx}{u}</div>
              {pct > 0
                ? <div style={{ marginTop:4, fontSize:"0.65rem", background:"#fee2e2", color:"#991b1b", borderRadius:6, padding:"2px 6px" }}>{pct}% außerh.</div>
                : <div style={{ marginTop:4, fontSize:"0.65rem", background:"#d1fae5", color:"#065f46", borderRadius:6, padding:"2px 6px" }}>immer OK ✓</div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Hauptapp ──────────────────────────────────────────────────────────────────
const DEFAULT_VALUES = { cl: 1.0, ph: 7.0, temp: 22 };

export default function PoolBericht() {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded]   = useState(false);

  // HINWEIS FÜR CLAUDE CODE: window.storage durch IndexedDB ersetzen!
  useEffect(() => {
    const load = async () => {
      try {
        const res = await window.storage.get("pool_entries");
        if (res?.value) {
          const parsed = JSON.parse(res.value);
          setEntries(parsed.length ? parsed : [FIRST_ENTRY]);
        } else setEntries([FIRST_ENTRY]);
      } catch {
        try {
          const s = localStorage.getItem("pool_entries");
          if (s) { const p = JSON.parse(s); setEntries(p.length ? p : [FIRST_ENTRY]); }
          else setEntries([FIRST_ENTRY]);
        } catch { setEntries([FIRST_ENTRY]); }
      }
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const save = async () => {
      const json = JSON.stringify(entries);
      try { await window.storage.set("pool_entries", json); } catch {}
      try { localStorage.setItem("pool_entries", json); } catch {}
    };
    save();
  }, [entries, loaded]);

  const [form, setForm]         = useState({ date: new Date().toISOString().slice(0,10), note: "", ...DEFAULT_VALUES });
  const [touched, setTouched]   = useState({ cl: false, ph: false, temp: false });
  const [tab, setTab]           = useState("eingabe");
  const [saved, setSaved]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const touch    = (k, v) => { setTouched(t => ({ ...t, [k]: true })); setField(k, v); };

  const handleAiResult = ({ cl, ph, temp }) => {
    setForm(f => ({ ...f, cl, ph, ...(temp != null ? { temp } : {}) }));
    setTouched(t => ({ ...t, cl: true, ph: true, ...(temp != null ? { temp: true } : {}) }));
  };

  const canSave = touched.cl && touched.ph && touched.temp;

  const handleAdd = () => {
    if (!canSave) return;
    const entry = { ...form, cl: +form.cl, ph: +form.ph, temp: +form.temp, id: Date.now() };
    setEntries(prev => [entry, ...prev]);
    setForm({ date: new Date().toISOString().slice(0,10), note: "", ...DEFAULT_VALUES });
    setTouched({ cl: false, ph: false, temp: false });
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const confirmDelete = (entry) => setDeleteTarget(entry);
  const doDelete = () => { setEntries(prev => prev.filter(e => e.id !== deleteTarget.id)); setDeleteTarget(null); };

  const last          = entries[0];
  const chartData     = [...entries].reverse().slice(-20);
  const daysSinceLast = last ? daysSince(last.date) : null;
  const staleDays     = 5;
  const staleWarn     = daysSinceLast !== null && daysSinceLast >= staleDays;

  const tips = last ? [
    getStatus("cl",   last.cl)   !== "ok" && getTipWithDose("cl",   getStatus("cl",   last.cl),   last.cl,   POOL.volume),
    getStatus("ph",   last.ph)   !== "ok" && getTipWithDose("ph",   getStatus("ph",   last.ph),   last.ph,   POOL.volume),
    getStatus("temp", last.temp) !== "ok" && getTipWithDose("temp", getStatus("temp", last.temp), last.temp, POOL.volume),
  ].filter(Boolean) : [];

  if (!loaded) return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#e0f2fe,#bae6fd)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#0369a1", fontWeight:600 }}>Lade Daten…</div>
    </div>
  );

  // JSX ab hier: Header, Tabs, Eingabe, Verlauf, Hinweise
  // → Vollständigen JSX-Block aus pool-bericht.jsx ab Zeile 405 übernehmen
  // (return-Statement des Hauptkomponents)
}
```

---

## Erster Befehl in Claude Code

```
Ich habe eine Pool-Pflege React-App als Einzeldatei entwickelt.
Bitte lies die CLAUDE_CODE_ÜBERGABE.md und dann:
1. Erstelle ein Vite + React + TypeScript Projekt "pool-bericht"
2. Refaktoriere den Code in die beschriebene Komponentenstruktur
3. Ersetze window.storage durch IndexedDB (idb-keyval)
4. Konfiguriere als PWA mit vite-plugin-pwa
Den vollständigen Quellcode findest du in dieser Datei.
```
