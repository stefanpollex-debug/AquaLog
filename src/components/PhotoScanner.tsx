import { useState, useRef } from "react";
import { API_BASE } from "../utils/api";
import { getStatus } from "../utils/status";
import { type ActiveLimits } from "../utils/constants";
import { StatusBadge } from "./StatusBadge";

interface AiResult {
  cl: number;
  ph: number;
  temp: number | null;
  kh: number | null;
  gh: number | null;
  cya: number | null;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

export interface PhotoScanResult {
  cl: number;
  ph: number;
  temp: number | null;
  kh: number | null;
  gh: number | null;
  cya: number | null;
}

interface Props {
  onResult: (vals: PhotoScanResult) => void;
  limits?: ActiveLimits;
}

type State = "idle" | "context" | "loading" | "result" | "error";

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   "🟢 Hoch",
  medium: "🟡 Mittel",
  low:    "🔴 Niedrig",
};

// ─── Kontext-Chips ────────────────────────────────────────────────────────────
interface Chip { id: string; emoji: string; label: string; context: string; }
const CHIPS: Chip[] = [
  { id: "genutzt",    emoji: "🏊", label: "Genutzt",       context: "Pool wurde heute genutzt" },
  { id: "abgedeckt",  emoji: "🌂", label: "Abgedeckt",     context: "Pool war abgedeckt" },
  { id: "sonnig",     emoji: "☀️", label: "Sonnig",         context: "starke Sonneneinstrahlung" },
  { id: "regen",      emoji: "🌧️", label: "Regen",          context: "Regen / Niederschlag" },
  { id: "sonnencreme",emoji: "🧴", label: "Sonnencreme",    context: "Badegäste haben Sonnencreme verwendet" },
  { id: "chemikalie", emoji: "⚗️", label: "Chemikalie",     context: "Chemikalie wurde vor der Messung zugegeben" },
];

export function PhotoScanner({ onResult, limits }: Props) {
  const [state, setState]         = useState<State>("idle");
  const [preview, setPreview]     = useState<string | null>(null);
  const [pendingB64, setPendingB64] = useState<{ b64: string; mt: string } | null>(null);
  const [aiResult, setAi]         = useState<AiResult | null>(null);
  const [errMsg, setErrMsg]       = useState("");
  const [chips, setChips]         = useState<Set<string>>(new Set());
  const [freeText, setFreeText]   = useState("");
  const inputRef                  = useRef<HTMLInputElement>(null);
  const galleryInputRef           = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);

  const toggleChip = (id: string) =>
    setChips(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ─── Kontext-String für die API ──────────────────────────────────────────────
  const buildContext = () => {
    const parts = [
      ...CHIPS.filter(c => chips.has(c.id)).map(c => c.context),
      freeText.trim(),
    ].filter(Boolean);
    return parts.length ? `Zusätzlicher Kontext: ${parts.join(", ")}.` : "";
  };

  // ─── Core analysis ───────────────────────────────────────────────────────────
  const runAnalysis = async (b64: string, mt: string, contextStr: string) => {
    setState("loading");
    setAi(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);

    try {
      const res = await fetch(`${API_BASE}/api/anthropic`, {
        method:  "POST",
        signal:  controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model:      "claude-sonnet-4-6",
          max_tokens: 1000,
          system: `Du bist ein Pool-Wassertest-Experte. Analysiere das Foto. Es kann einen Teststreifen UND/ODER ein Thermometer enthalten.

Teststreifen-Typ: Bayrol Cl & Br Quicktest 6in1 — 5 Testfelder von oben nach unten am Streifen: Chlor, pH, Alkalinität (TA), Härte (TH), Stabilisator (CYA). (Ein optionales Br-Feld für Bromin existiert auf dem Streifen, wird hier nicht ausgewertet.)

Teststreifen-Farbskala — interpoliere zwischen den Referenzpunkten, wenn die Farbe dazwischen liegt:
- Chlor (Cl, mg/l): 0.0=fast farblos/cremeweiß, 0.5=sehr helles Rosa, 1.0=helles Rosa, 2.0=mittleres Pink/Rosé, 5.0=kräftiges Pink-Magenta
- pH: 6.6=Gelb/Goldgelb, 7.0=Orange, 7.4=Orange-Rot/Koralle, 7.8=Rot, 8.2=Magenta-Rot
- Alkalinität/KH (mg/l): 0=helles Gelb-Oliv, 40=Olivgrün, 80=mittleres Olivgrün, 120=dunkleres Grau-Grün, 180=Grau
- Gesamthärte/GH (mg/l): 0=Oliv/Khaki-Grau, 75=dunkles Oliv-Braun, 150=Ziegelrot, 250=Rot-Orange, 425=kräftiges Orange-Rot
- Stabilisator/CYA (mg/l): 0=Gold-Orange, 50=Orange, 100=dunkleres Orange-Rot, 150=Rot-Orange, 300=kräftiges Orange-Rot

Lies KH, GH und CYA nur ab, wenn die entsprechenden Testfelder im Foto klar erkennbar und nicht verdeckt/unscharf sind. Falls ein Feld nicht zuverlässig lesbar ist, setze den Wert auf null statt zu raten.

Thermometer: Lies die angezeigte Temperatur in Grad Celsius ab. Falls kein Thermometer sichtbar, setze "temp": null.

Berücksichtige den zusätzlichen Kontext bei der Einschätzung der Messwerte und der notes.

Deine gesamte Antwort besteht NUR aus dem folgenden JSON-Objekt — keine Überschriften, keine Aufzählung der einzelnen Felder, keine Markdown-Formatierung, kein Fließtext davor oder danach, keine Backticks. Das allererste Zeichen deiner Antwort ist "{", das letzte "}". Schreibe keine Analyse oder Begründung aus — bewerte die Felder, aber gib nur das Ergebnis als JSON zurück:
{"cl":<Zahl>,"ph":<Zahl>,"temp":<Zahl oder null>,"kh":<Zahl oder null>,"gh":<Zahl oder null>,"cya":<Zahl oder null>,"confidence":"low|medium|high","notes":"<kurze Beschreibung was du siehst und was der Kontext bedeutet>"}

Falls gar kein Teststreifen erkennbar: {"error":"Kein Teststreifen erkennbar"}`,
          messages: [{
            role:    "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
              { type: "text",  text: `Analysiere den Teststreifen (Cl, pH, KH, GH, CYA falls erkennbar) und Thermometer (falls vorhanden) auf diesem Foto. Antworte ausschließlich mit dem JSON-Objekt, keine Textanalyse. ${contextStr}`.trim() },
            ],
          }],
        }),
      });
      clearTimeout(timeoutId);

      let data: unknown;
      try {
        data = await res.json();
      } catch {
        setState("error"); setErrMsg(`Antwort kein JSON (HTTP ${res.status})`); return;
      }
      const d = data as Record<string, unknown>;
      if (!res.ok) {
        const apiErr = (d?.error as Record<string,string>)?.message
          ?? (d?.error as Record<string,string>)?.type
          ?? `HTTP ${res.status}`;
        setState("error"); setErrMsg(`API-Fehler: ${apiErr}`); return;
      }
      const content = d.content as Array<{ type: string; text?: string }> | undefined;
      const text    = content?.find(b => b.type === "text")?.text ?? "";
      if (!text) { setState("error"); setErrMsg("Leere Antwort von KI erhalten."); return; }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      } catch {
        // Fallback: Claude hat trotz Anweisung Text vor/nach dem JSON ausgegeben (z.B. eine
        // Feld-für-Feld-Analyse) — JSON-Objekt aus dem umschließenden Text herausschneiden.
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) {
          setState("error"); setErrMsg(`KI-Antwort kein gültiges JSON: ${text.slice(0, 80)}`); return;
        }
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          setState("error"); setErrMsg(`KI-Antwort kein gültiges JSON: ${text.slice(0, 80)}`); return;
        }
      }
      if (parsed.error) { setState("error"); setErrMsg(parsed.error as string); return; }
      setAi(parsed as unknown as AiResult);
      setState("result");
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (timedOut) { setState("error"); setErrMsg("Zeitüberschreitung – bitte erneut versuchen."); }
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setState("error");
      // Zeige präzise Fehlerquelle für einfacheres Debugging
      setErrMsg(`Netzwerkfehler: ${msg}`);
    }
  };

  // ─── Foto aufnehmen → Kontext-Step ───────────────────────────────────────────
  const goToContext = (b64: string, mt: string, previewUrl: string) => {
    setPreview(previewUrl);
    setPendingB64({ b64, mt });
    setChips(new Set());
    setFreeText("");
    setState("context");
  };


  const analyseFile = (file: File | null | undefined) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => { setState("error"); setErrMsg("Bild konnte nicht gelesen werden."); };
    reader.onload = () => {
      const dataUrl = reader.result as string;

      // Canvas-Konvertierung → immer JPEG, egal ob HEIC, PNG oder anderes Format
      const img = new Image();
      img.onerror = () => { setState("error"); setErrMsg("Bild konnte nicht geladen werden."); };
      img.onload  = () => {
        // Max. 1600px — reduziert Dateigröße ohne Qualitätsverlust für Teststreifen-Analyse
        const MAX   = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w     = Math.round(img.width  * scale);
        const h     = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { setState("error"); setErrMsg("Canvas nicht verfügbar."); return; }

        ctx.drawImage(img, 0, 0, w, h);
        const jpegUrl = canvas.toDataURL("image/jpeg", 0.88);
        const base64  = jpegUrl.split(",")[1] ?? "";

        if (!base64) { setState("error"); setErrMsg("Konvertierung fehlgeschlagen."); return; }
        goToContext(base64, "image/jpeg", jpegUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const openCamera  = () => inputRef.current?.click();
  const openGallery = () => galleryInputRef.current?.click();

  const startAnalysis = () => {
    if (!pendingB64) return;
    runAnalysis(pendingB64.b64, pendingB64.mt, buildContext());
  };

  const accept = () => {
    if (!aiResult) return;
    onResult({
      cl: aiResult.cl, ph: aiResult.ph, temp: aiResult.temp,
      kh: aiResult.kh, gh: aiResult.gh, cya: aiResult.cya,
    });
    setState("idle"); setPreview(null); setAi(null); setPendingB64(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const reset = () => {
    abortRef.current?.abort(); abortRef.current = null;
    setState("idle"); setPreview(null); setAi(null); setPendingB64(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const retake = () => { reset(); requestAnimationFrame(openCamera); };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0369a1", marginBottom: 8 }}>
        📸 KI-Fotoauswertung
      </div>

      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }} onChange={(e) => analyseFile(e.target.files?.[0])} />
      <input ref={galleryInputRef} type="file" accept="image/*"
        style={{ display: "none" }} onChange={(e) => analyseFile(e.target.files?.[0])} />

      {/* ── IDLE ── */}
      {state === "idle" && (
        <div
          onDrop={(e) => { e.preventDefault(); analyseFile(e.dataTransfer.files[0]); }}
          onDragOver={(e) => e.preventDefault()}
          style={{ border: "2px dashed #bae6fd", borderRadius: 14, padding: "22px 16px",
            textAlign: "center", background: "#f0f9ff" }}>
          <div onClick={openCamera} style={{ cursor: "pointer" }}>
            <div style={{ fontSize: "2rem" }}>📷</div>
            <div style={{ fontWeight: 600, color: "#0369a1", marginTop: 6, fontSize: "0.9rem" }}>
              Teststreifen fotografieren
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3 }}>
              KI liest Cl, pH, KH, GH, CYA und Temperatur automatisch aus
            </div>
          </div>
          <button onClick={openGallery} type="button"
            style={{
              marginTop: 14, padding: "8px 16px", background: "white",
              border: "1.5px solid #bae6fd", borderRadius: 10, cursor: "pointer",
              fontWeight: 600, color: "#0369a1", fontSize: "0.8rem",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
            🖼️ Vorhandenes Foto verwenden
          </button>
        </div>
      )}

      {/* ── KONTEXT ── */}
      {state === "context" && (
        <div style={{ background: "white", borderRadius: 14, border: "1.5px solid #bae6fd", overflow: "hidden" }}>
          {preview && (
            <img src={preview} alt="Vorschau"
              style={{ width: "100%", maxHeight: 130, objectFit: "cover" }} />
          )}
          <div style={{ padding: "14px 14px 0" }}>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0369a1", marginBottom: 10 }}>
              Was war heute los? <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span>
            </div>

            {/* Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {CHIPS.map(c => {
                const active = chips.has(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleChip(c.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 11px", borderRadius: 20, cursor: "pointer",
                      border: `1.5px solid ${active ? "#0369a1" : "#e2e8f0"}`,
                      background: active ? "#e0f2fe" : "white",
                      color: active ? "#0369a1" : "#64748b",
                      fontWeight: active ? 700 : 500, fontSize: "0.8rem",
                      transition: "all 0.15s",
                    }}>
                    <span>{c.emoji}</span> {c.label}
                  </button>
                );
              })}
            </div>

            {/* Freitext */}
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Sonstiges… z.B. starker Wind, viele Badegäste, pH-Minus zugegeben"
              rows={2}
              style={{
                width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10,
                padding: "9px 11px", fontSize: "0.82rem", resize: "none",
                fontFamily: "inherit", color: "#374151", boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Aktions-Buttons */}
          <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={startAnalysis}
              style={{ padding: "11px", background: "linear-gradient(90deg,#0369a1,#0ea5e9)",
                color: "white", border: "none", borderRadius: 10, fontWeight: 700,
                cursor: "pointer", fontSize: "0.9rem" }}>
              🔍 Jetzt analysieren
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={retake}
                style={{ flex: 1, padding: "8px", background: "#f8fafc",
                  border: "1.5px solid #e2e8f0", borderRadius: 10, cursor: "pointer",
                  fontWeight: 600, color: "#475569", fontSize: "0.82rem" }}>
                📷 Neu
              </button>
              <button onClick={reset}
                style={{ flex: 1, padding: "8px", background: "#f8fafc",
                  border: "1.5px solid #e2e8f0", borderRadius: 10, cursor: "pointer",
                  fontWeight: 600, color: "#475569", fontSize: "0.82rem" }}>
                ✕ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {state === "loading" && (
        <div style={{ background: "#f0f9ff", borderRadius: 14, padding: 20, textAlign: "center" }}>
          {preview && (
            <img src={preview} alt="Vorschau"
              style={{ width: "100%", maxHeight: 110, objectFit: "cover", borderRadius: 10, marginBottom: 12 }} />
          )}
          <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "#0ea5e9",
                animation: `bounce 1s ease ${i * 0.2}s infinite` }} />
            ))}
          </div>
          <div style={{ fontWeight: 600, color: "#0369a1", fontSize: "0.9rem" }}>KI analysiert Teststreifen…</div>
          {chips.size > 0 || freeText ? (
            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 6 }}>
              Kontext wird berücksichtigt
            </div>
          ) : null}
          <button onClick={reset}
            style={{ marginTop: 12, padding: "7px 20px", background: "#f1f5f9", color: "#64748b",
              border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
            ✕ Abbrechen
          </button>
        </div>
      )}

      {/* ── RESULT ── */}
      {state === "result" && aiResult && (
        <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 14, padding: 16 }}>
          {preview && (
            <img src={preview} alt="Teststreifen"
              style={{ width: "100%", maxHeight: 100, objectFit: "cover", borderRadius: 10, marginBottom: 12 }} />
          )}
          <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 10, fontSize: "0.88rem" }}>✅ KI hat Werte erkannt:</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {([["cl", "Chlor (Cl)", "mg/l"], ["ph", "pH-Wert", ""]] as [keyof AiResult, string, string][]).map(([k, lbl, u]) => (
              <div key={k} style={{ background: "white", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>{lbl}</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{aiResult[k] as number}{u}</div>
                <StatusBadge status={getStatus(k as "cl" | "ph", aiResult[k] as number, limits)} />
              </div>
            ))}
            {aiResult.temp != null && (
              <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Temperatur</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{aiResult.temp}°C</div>
                <StatusBadge status={getStatus("temp", aiResult.temp, limits)} />
              </div>
            )}
            {aiResult.kh != null && (
              <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Alkalinität (KH)</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{aiResult.kh}mg/l</div>
                <StatusBadge status={getStatus("kh", aiResult.kh, limits)} />
              </div>
            )}
            {aiResult.gh != null && (
              <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Gesamthärte (GH)</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{aiResult.gh}mg/l</div>
                <StatusBadge status={getStatus("gh", aiResult.gh, limits)} />
              </div>
            )}
            {aiResult.cya != null && (
              <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Stabilisator (CYA)</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{aiResult.cya}mg/l</div>
              </div>
            )}
          </div>
          {aiResult.notes && (
            <div style={{ fontSize: "0.77rem", color: "#475569", marginBottom: 8, fontStyle: "italic" }}>
              💬 {aiResult.notes}
            </div>
          )}
          <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: 10 }}>
            Konfidenz: {CONFIDENCE_LABEL[aiResult.confidence]}
          </div>
          {aiResult.temp == null && (
            <div style={{ background: "#fef9c3", borderRadius: 8, padding: "8px 12px",
              fontSize: "0.78rem", color: "#713f12", marginBottom: 12 }}>
              🌡️ Kein Thermometer erkannt – bitte Temperatur per Schieberegler einstellen.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={accept}
              style={{ padding: "10px", background: "linear-gradient(90deg,#15803d,#22c55e)",
                color: "white", border: "none", borderRadius: 10, fontWeight: 700,
                cursor: "pointer", fontSize: "0.9rem" }}>
              ✓ Werte übernehmen
            </button>
            <button onClick={retake}
              style={{ padding: "9px", background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}>
              📷 Neu fotografieren
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {state === "error" && (
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 14,
          padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem" }}>😕</div>
          <div style={{ fontWeight: 600, color: "#991b1b", margin: "8px 0 4px", fontSize: "0.88rem" }}>{errMsg}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
            <button onClick={retake}
              style={{ padding: "8px 20px", background: "#ef4444", color: "white",
                border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              📷 Erneut fotografieren
            </button>
            <button onClick={reset}
              style={{ padding: "8px 14px", background: "#f1f5f9", color: "#64748b",
                border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
