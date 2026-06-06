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

type State = "idle" | "loading" | "result" | "error";

const CONFIDENCE_LABEL: Record<string, string> = {
  high:   "🟢 Hoch",
  medium: "🟡 Mittel",
  low:    "🔴 Niedrig",
};

export function PhotoScanner({ onResult }: Props) {
  const [state, setState]     = useState<State>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [aiResult, setAi]     = useState<AiResult | null>(null);
  const [errMsg, setErrMsg]   = useState("");
  const inputRef              = useRef<HTMLInputElement>(null);
  const abortRef              = useRef<AbortController | null>(null);

  // ─── Core analysis (shared by both native + web paths) ──────────────────────
  const runAnalysis = async (b64: string, mt: string, previewUrl: string) => {
    setPreview(previewUrl);
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

Antworte NUR mit JSON ohne Backticks:
{"cl":<Zahl>,"ph":<Zahl>,"temp":<Zahl oder null>,"confidence":"low|medium|high","notes":"<kurze Beschreibung was du siehst>"}

Falls gar kein Teststreifen erkennbar: {"error":"Kein Teststreifen erkennbar"}`,
          messages: [{
            role:    "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
              { type: "text",  text:   "Analysiere Teststreifen und Thermometer (falls vorhanden) auf diesem Foto." },
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

  // ─── Native path (Capacitor iOS / Android) ──────────────────────────────────
  const takePhotoNative = async () => {
    try {
      const perms = await Camera.requestPermissions({ permissions: ["camera"] });
      if (perms.camera === "denied") {
        setState("error");
        setErrMsg("Kamera-Zugriff verweigert. Bitte in den Einstellungen erlauben.");
        return;
      }

      const photo = await Camera.getPhoto({
        quality:      90,
        allowEditing: false,
        resultType:   CameraResultType.Base64,
        source:       CameraSource.Camera,
      });

      if (!photo.base64String) {
        setState("error"); setErrMsg("Kein Bild erhalten."); return;
      }

      // Capacitor liefert reines Base64 (kein Prefix) — sicherheitshalber abschneiden falls doch vorhanden
      const base64Data  = photo.base64String ?? "";
      const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

      const mt         = `image/${photo.format ?? "jpeg"}`;
      const previewUrl = `data:${mt};base64,${cleanBase64}`;
      await runAnalysis(cleanBase64, mt, previewUrl);
    } catch (err) {
      // User cancelled — silently return to idle
      if (String(err).includes("cancelled") || String(err).includes("canceled")) return;
      setState("error");
      setErrMsg(`Kamera-Fehler: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ─── Web / PWA fallback path ─────────────────────────────────────────────────
  const analyseFile = (file: File | null | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target!.result as string;
      await runAnalysis(dataUrl.split(",")[1], file.type || "image/jpeg", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ─── Unified trigger ─────────────────────────────────────────────────────────
  const openCamera = () => {
    if (Capacitor.isNativePlatform()) {
      takePhotoNative();
    } else {
      inputRef.current?.click();
    }
  };

  const accept = () => {
    if (!aiResult) return;
    onResult({ cl: aiResult.cl, ph: aiResult.ph, temp: aiResult.temp });
    setState("idle"); setPreview(null); setAi(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle"); setPreview(null); setAi(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const retake = () => { reset(); requestAnimationFrame(openCamera); };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#0369a1", marginBottom: 8 }}>
        📸 KI-Fotoauswertung
      </div>

      {/* Web fallback — hidden on native (never triggered) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => analyseFile(e.target.files?.[0])}
      />

      {state === "idle" && (
        <div
          onClick={openCamera}
          onDrop={(e) => { e.preventDefault(); analyseFile(e.dataTransfer.files[0]); }}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: "2px dashed #bae6fd", borderRadius: 14, padding: "22px 16px",
            textAlign: "center", cursor: "pointer", background: "#f0f9ff",
          }}
        >
          <div style={{ fontSize: "2rem" }}>📷</div>
          <div style={{ fontWeight: 600, color: "#0369a1", marginTop: 6, fontSize: "0.9rem" }}>
            Teststreifen fotografieren
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 3 }}>
            KI liest Cl, pH und Temperatur automatisch aus
          </div>
        </div>
      )}

      {state === "loading" && (
        <div style={{ background: "#f0f9ff", borderRadius: 14, padding: 20, textAlign: "center" }}>
          {preview && (
            <img src={preview} alt="Vorschau"
              style={{ width: "100%", maxHeight: 110, objectFit: "cover", borderRadius: 10, marginBottom: 12 }} />
          )}
          <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: "50%", background: "#0ea5e9",
                animation: `bounce 1s ease ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <div style={{ fontWeight: 600, color: "#0369a1", fontSize: "0.9rem" }}>KI analysiert Teststreifen…</div>
          <button
            onClick={reset}
            style={{ marginTop: 12, padding: "7px 20px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}
          >✕ Abbrechen</button>
        </div>
      )}

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
            <div style={{ background: "#fef9c3", borderRadius: 8, padding: "8px 12px", fontSize: "0.78rem", color: "#713f12", marginBottom: 12 }}>
              🌡️ Kein Thermometer erkannt – bitte Temperatur per Schieberegler einstellen.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={accept}
              style={{ padding: "10px", background: "linear-gradient(90deg,#15803d,#22c55e)", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: "0.9rem" }}
            >✓ Werte übernehmen</button>
            <button
              onClick={retake}
              style={{ padding: "9px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, cursor: "pointer", fontWeight: 600, color: "#475569", fontSize: "0.85rem" }}
            >📷 Neu fotografieren</button>
          </div>
        </div>
      )}

      {state === "error" && (
        <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 14, padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: "1.5rem" }}>😕</div>
          <div style={{ fontWeight: 600, color: "#991b1b", margin: "8px 0 4px", fontSize: "0.88rem" }}>{errMsg}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
            <button
              onClick={retake}
              style={{ padding: "8px 20px", background: "#ef4444", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
            >📷 Erneut fotografieren</button>
            <button
              onClick={reset}
              style={{ padding: "8px 14px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
