import { useState, useRef } from "react";
import { API_BASE } from "../utils/api";
import { type PoolEntry } from "../hooks/usePoolEntries";
import { type PoolProfile } from "../hooks/usePoolProfile";
import { getStatus, type Status } from "../utils/status";
import { LIMITS, type FieldKey, type ActiveLimits } from "../utils/constants";
import { calculateLSI } from "../utils/contextualRisk";

interface Props {
  last: PoolEntry | undefined;
  profile: PoolProfile;
  daysSinceLast: number | null;
  limits?: ActiveLimits;
}

// Record<Status,...> statt Record<string,...> — fehlender Status-Schlüssel fällt
// jetzt als Typfehler auf statt als "undefined" im KI-Prompt zu landen.
const STATUS_DE: Record<Status, string> = { ok: "✓ OK", low: "⬇ zu niedrig", high: "⬆ zu hoch", warn: "⚠ grenzwertig" };

export function AiWaterReport({ last, profile, daysSinceLast, limits }: Props) {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const analyse = async () => {
    if (!last) return;
    setLoading(true);
    setReport(null);
    setError(null);

    const active = limits ?? LIMITS;
    const statusLines = (["cl", "ph", "temp", "kh", "gh"] as FieldKey[]).flatMap((k) => {
      const val = last[k];
      if (val == null) return [];
      const st = getStatus(k, val, active);
      return [`${LIMITS[k].label}: ${val.toFixed(k === "kh" || k === "gh" ? 0 : 1)}${LIMITS[k].unit} (${STATUS_DE[st]}, OK-Bereich: ${active[k].min}–${active[k].max}${LIMITS[k].unit})`];
    });
    if (last.cya != null) {
      statusLines.push(`Stabilisator (CYA): ${last.cya} mg/l (Idealbereich: 30–50 mg/l)`);
    }
    if (last.gh != null && last.kh != null) {
      const lsi = calculateLSI(last.ph, last.temp, last.gh, last.kh);
      statusLines.push(`Langelier-Index (LSI): ${lsi.toFixed(2)} (Idealbereich: −0,3 bis +0,3; <−0,3 korrosiv, >+0,3 kalkbildend)`);
    }

    const userMsg =
      `Pool: ${profile.name}, ${profile.volumeLiters} L, ${profile.poolType}, ${profile.sanitizer}\n` +
      `Standort: ${profile.location}, Nutzung: ${profile.usageFrequency}\n` +
      `Letzte Messung: vor ${daysSinceLast ?? 0} Tag(en)\n\n` +
      `Aktueller Wasserstatus:\n${statusLines.join("\n")}` +
      (last.note ? `\n\nNotiz: ${last.note}` : "");

    const controller = new AbortController();
    abortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);

    try {
      const res = await fetch(`${API_BASE}/api/anthropic`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 400,
          system: `Du bist ein erfahrener Pool-Pflegeberater.
Erkläre dem Nutzer seinen Wasserstatus auf Deutsch in 3–5 kurzen Sätzen.
Sei konkret, verständlich und positiv.
Erkläre kurz warum der jeweilige Wert wichtig ist (z.B. pH und Chlorwirkung).
Nenne die wichtigste Maßnahme zuerst.
Kein Markdown, keine Listen – fließender Text.`,
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? `HTTP ${res.status}`);
        return;
      }
      const text = (data.content?.find((b: { type: string }) => b.type === "text") as { text: string } | undefined)?.text ?? "";
      setReport(text.trim());
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof DOMException && err.name === "AbortError") {
        if (timedOut) {
          setError("Zeitüberschreitung – bitte erneut versuchen.");
        }
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "white", borderRadius: 18, padding: 18, boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>
      <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 12, fontSize: "0.95rem" }}>
        🤖 KI-Wasseranalyse
      </div>

      {!report && !loading && !error && (
        <div>
          <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
            Claude erklärt dir deinen Wasserstatus: Was bedeuten die Werte, welche Zusammenhänge gibt es, was ist jetzt zu tun?
          </div>
          <button
            onClick={analyse}
            disabled={!last}
            style={{
              width: "100%", padding: 12,
              background: last ? "linear-gradient(90deg,#7c3aed,#a855f7)" : "#e2e8f0",
              color: last ? "white" : "#94a3b8",
              border: "none", borderRadius: 12, fontWeight: 700,
              fontSize: "0.9rem", cursor: last ? "pointer" : "not-allowed",
            }}
          >
            🔍 Jetzt analysieren
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 28, height: 28, border: "3px solid #e9d5ff", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
          <div style={{ fontSize: "0.82rem", color: "#7c3aed", fontWeight: 600 }}>Claude analysiert…</div>
        </div>
      )}

      {report && (
        <div>
          <div style={{ fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.65, marginBottom: 12 }}>
            {report}
          </div>
          <button
            onClick={() => setReport(null)}
            style={{ background: "none", border: "none", fontSize: "0.75rem", color: "#94a3b8", cursor: "pointer", padding: 0 }}
          >
            ↺ Neu analysieren
          </button>
        </div>
      )}

      {error && (
        <div>
          <div style={{ fontSize: "0.8rem", color: "#dc2626", marginBottom: 8 }}>Fehler: {error}</div>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", fontSize: "0.75rem", color: "#94a3b8", cursor: "pointer", padding: 0 }}>
            ↺ Erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
}
