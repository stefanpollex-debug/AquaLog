import { useState, useRef } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { API_BASE } from "../utils/api";
import { getStatus } from "../utils/status";
import { StatusBadge } from "./StatusBadge";

interface AiResult {
  cl: number;
  ph: number;
  temp: number | null;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

interface Props {
  onResult: (vals: { cl: number; ph: number; temp: number | null }) => void;
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

export function PhotoScanner({ onResult }: Props) {
  const [state, setState]         = useState<State>("idle");
  const [preview, setPreview]     = useState<string | null>(null);
  const [pendingB64, setPendingB64] = useState<{ b64: string; mt: string } | null>(null);
  const [aiResult, setAi]         = useState<AiResult | null>(null);
  const [errMsg, setErrMsg]       = useState("");
  const [chips, setChips]         = useState<Set<string>>(new Set());
  const [freeText, setFreeText]   = useState("");
  const inputRef                  = useRef<HTMLInputElement>(null);
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

Teststreifen-Farbskala:
- Chlor (Cl): 0.0=farblos/weiß, 0.3=sehr helles pink, 0.6=helles pink, 1.0=mittleres rose, 1.5=kräftiges pink, 2.0=magenta
- pH: 6.2=gelb, 6.6=hellgelb-orange, 7.0=orange, 7.4=mittleres orange, 7.8=dunkles orange, 8.2=rot-orange

Thermometer: Lies die angezeigte Temperatur in Grad Celsius ab. Falls kein Thermometer sichtbar, setze "temp": null.

Berücksichtige den zusätzlichen Kontext bei der Einschätzung der Messwerte und der notes.

Antworte NUR mit JSON ohne Backticks:
{"cl":<Zahl>,"ph":<Zahl>,"temp":<Zahl oder null>,"confidence":"low|medium|high","notes":"<kurze Beschreibung was du siehst und was der Kontext bedeutet>"}

Falls gar kein Teststreifen erkennbar: {"error":"Kein Teststreifen erkennbar"}`,
          messages: [{
            role:    "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
              { type: "text",  text: `Analysiere Teststreifen und Thermometer (falls vorhanden) auf diesem Foto. ${contextStr}`.trim() },
            ],
          }],
        }),
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        const apiErr = data?.error?.message ?? data?.error?.type ?? `HTTP ${res.status}`;
        setState("error"); setErrMsg(`API-Fehler: ${apiErr}`); return;
      }
      const text   = (data.content?.find((b: { type: string }) => b.type === "text") as { text: string } | undefined)?.text ?? "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (parsed.error) { setState("error"); setErrMsg(parsed.error); return; }
      setAi(parsed);
      setState("result");
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (timedOut) { setState("error"); setErrMsg("Zeitüberschreitung – bitte erneut versuchen."); }
        return;
      }
      setState("error");
      setErrMsg(`Fehler: ${err instanceof Error ? err.message : String(err)}`);
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

  const takePhotoNative = async () => {
    try {
      // Berechtigungen prüfen — "prompt" bedeutet noch nicht entschieden, auch OK
      const perms = await Camera.requestPermissions({ permissions: ["camera"] });
      if (perms.camera === "denied") {
        setState("error");
        setErrMsg("Kamera-Zugriff verweigert. Bitte in den Einstellungen → AquaLog → Kamera aktivieren.");
        return;
      }

      // DataUrl statt Base64: zuverlässiger auf iOS (kein HEIC-Problem, kein Pattern-Fehler)
      const photo = await Camera.getPhoto({
        quality:            85,
        allowEditing:       false,
        resultType:         CameraResultType.DataUrl,
        source:             CameraSource.Camera,
        saveToGallery:      false,
        correctOrientation: true,
        // JPEG erzwingen — Claude API unterstützt kein HEIC
        webUseInput:        false,
      });

      if (!photo.dataUrl) { setState("error"); setErrMsg("Kein Bild erhalten."); return; }

      // dataUrl hat Format: "data:image/jpeg;base64,<data>"
      const dataUrl     = photo.dataUrl;
      const mt          = dataUrl.split(";")[0].split(":")[1] || "image/jpeg";
      const cleanBase64 = dataUrl.split(",")[1] ?? "";

      if (!cleanBase64) { setState("error"); setErrMsg("Bild konnte nicht verarbeitet werden."); return; }

      goToContext(cleanBase64, mt, dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Abgebrochen vom Nutzer → still zurück zu idle
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("abbruch")) return;
      setState("error");
      setErrMsg(`Kamera-Fehler: ${msg}`);
    }
  };

  const analyseFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target!.result as string;
      goToContext(dataUrl.split(",")[1], file.type || "image/jpeg", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const openCamera = () =>
    Capacitor.isNativePlatform() ? takePhotoNative() : inputRef.current?.click();

  const startAnalysis = () => {
    if (!pendingB64) return;
    runAnalysis(pendingB64.b64, pendingB64.mt, buildContext());
  };

  const accept = () => {
    if (!aiResult) return;
    onResult({ cl: aiResult.cl, ph: aiResult.ph, temp: aiResult.temp });
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

      {/* ── IDLE ── */}
      {state === "idle" && (
        <div onClick={openCamera}
          onDrop={(e) => { e.preventDefault(); analyseFile(e.dataTransfer.files[0]); }}
          onDragOver={(e) => e.preventDefault()}
          style={{ border: "2px dashed #bae6fd", borderRadius: 14, padding: "22px 16px",
            textAlign: "center", cursor: "pointer", background: "#f0f9ff" }}>
          <div style={{ fontSize: "2rem" }}>📷</div>
          <div style={{ fontWeight: 600, color: "#0369a1", marginTop: 6, fontSize: "0.9rem" }}>
            Teststreifen fotografieren
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3 }}>
            KI liest Cl, pH und Temperatur automatisch aus
          </div>
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
                <StatusBadge status={getStatus(k as "cl" | "ph", aiResult[k] as number)} />
              </div>
            ))}
            {aiResult.temp != null && (
              <div style={{ background: "white", borderRadius: 10, padding: "8px 12px", flex: 1 }}>
                <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Temperatur</div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{aiResult.temp}°C</div>
                <StatusBadge status={getStatus("temp", aiResult.temp)} />
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
