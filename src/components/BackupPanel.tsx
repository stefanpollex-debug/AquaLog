import { useState, useRef } from "react";
import { type PoolEntry }          from "../hooks/usePoolEntries";
import { type FilterEntry }        from "../utils/filterLog";
import { type WaterChangeRecord }  from "../utils/waterChange";
import { type PoolProfile }        from "../hooks/usePoolProfile";
import {
  type AquaLogBackup,
  exportJSON, exportCSV, exportPDF,
  parseBackupFile,
} from "../utils/backup";

interface Props {
  entries:     PoolEntry[];
  filterLog:   FilterEntry[];
  waterChange: WaterChangeRecord | null;
  profile:     PoolProfile;
  onImportEntries:     (entries: PoolEntry[])    => void;
  onImportFilterLog:   (log: FilterEntry[])      => void;
  onImportWaterChange: (r: WaterChangeRecord)    => void;
  onImportProfile:     (p: PoolProfile)          => void;
}

type ExportState = "idle" | "busy";

interface ImportPreview {
  backup:          AquaLogBackup;
  newEntries:      PoolEntry[];
  newFilterEntries: FilterEntry[];
  hasNewWaterChange: boolean;
  hasNewProfile:   boolean;
}

export function BackupPanel({
  entries, filterLog, waterChange, profile,
  onImportEntries, onImportFilterLog, onImportWaterChange, onImportProfile,
}: Props) {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [preview,     setPreview]     = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone,  setImportDone]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const lastBackup = localStorage.getItem("lastBackupDate");

  const buildBackup = (): AquaLogBackup => ({
    version:     "1.0",
    exportDate:  new Date().toISOString(),
    entries,
    filterLog,
    waterChange,
    settings:    { profile },
  });

  const handleExportJSON = () => {
    setExportState("busy");
    exportJSON(buildBackup());
    setTimeout(() => setExportState("idle"), 800);
  };

  const handleExportCSV = () => {
    setExportState("busy");
    exportCSV(entries);
    setTimeout(() => setExportState("idle"), 800);
  };

  const handleExportPDF = () => {
    setExportState("busy");
    setTimeout(() => {
      exportPDF(entries, profile);
      setExportState("idle");
    }, 50); // kurz warten damit React re-rendert
  };

  const handleFileSelect = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setImportDone(false);
    try {
      const backup = await parseBackupFile(file);
      const existingIds = new Set(entries.map(e => e.id));
      const newEntries  = (backup.entries ?? []).filter(e => !existingIds.has(e.id));
      const filterIds   = new Set(filterLog.map(e => e.id));
      const newFilter   = (backup.filterLog ?? []).filter(e => !filterIds.has(e.id));
      const hasNewWC    = !!backup.waterChange && (backup.waterChange.additions?.length ?? 0) > (waterChange?.additions?.length ?? 0);
      const hasNewProf  = !!backup.settings?.profile;
      setPreview({ backup, newEntries, newFilterEntries: newFilter, hasNewWaterChange: hasNewWC, hasNewProfile: hasNewProf });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const confirmImport = () => {
    if (!preview) return;
    if (preview.newEntries.length)      onImportEntries(preview.newEntries);
    if (preview.newFilterEntries.length) onImportFilterLog(preview.newFilterEntries);
    if (preview.hasNewWaterChange)      onImportWaterChange(preview.backup.waterChange!);
    if (preview.hasNewProfile)          onImportProfile(preview.backup.settings.profile);
    setPreview(null);
    setImportDone(true);
    setTimeout(() => setImportDone(false), 3000);
  };

  const busy = exportState === "busy";

  return (
    <div>
      {/* ── Export ─────────────────────────────────────────── */}
      <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#64748b", marginBottom: 10 }}>
        💾 Backup & Export
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleExportJSON} disabled={busy}
          style={btnStyle("#0369a1", "#e0f2fe")}
        >
          📥 JSON exportieren <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>(vollständiges Backup)</span>
        </button>
        <button
          onClick={handleExportCSV} disabled={busy}
          style={btnStyle("#15803d", "#f0fdf4")}
        >
          📊 CSV exportieren <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>(Messungen, Excel-kompatibel)</span>
        </button>
        <button
          onClick={handleExportPDF} disabled={busy || entries.length === 0}
          style={btnStyle("#7c3aed", "#f5f3ff")}
        >
          📄 PDF Saisonbericht <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>(Tabelle + Diagramme)</span>
        </button>
      </div>

      {lastBackup && (
        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: 16, textAlign: "center" }}>
          Letztes Backup: {new Date(lastBackup + "T12:00:00").toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      )}

      {/* ── Import ─────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
        <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "#64748b", marginBottom: 10 }}>
          📂 Backup importieren
        </div>

        <input
          ref={fileRef}
          type="file" accept=".json,application/json"
          style={{ display: "none" }}
          onChange={e => handleFileSelect(e.target.files?.[0])}
        />

        <button
          onClick={() => fileRef.current?.click()}
          style={btnStyle("#475569", "#f8fafc")}
        >
          📁 JSON-Datei auswählen…
        </button>

        {importError && (
          <div style={{ marginTop: 10, background: "#fef2f2", borderRadius: 10, padding: "10px 12px", fontSize: "0.78rem", color: "#991b1b" }}>
            ❌ {importError}
          </div>
        )}

        {importDone && (
          <div style={{ marginTop: 10, background: "#d1fae5", borderRadius: 10, padding: "10px 12px", fontSize: "0.78rem", color: "#065f46", fontWeight: 600 }}>
            ✅ Import abgeschlossen
          </div>
        )}

        {/* Vorschau / Bestätigung */}
        {preview && (
          <div style={{ marginTop: 12, background: "#f0f9ff", borderRadius: 12, padding: "12px 14px", border: "1px solid #bae6fd" }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#0369a1", marginBottom: 8 }}>
              Import-Vorschau
            </div>
            <div style={{ fontSize: "0.78rem", color: "#1e293b", lineHeight: 1.8 }}>
              {preview.newEntries.length > 0
                ? `📋 ${preview.newEntries.length} neue Messungen`
                : "📋 Keine neuen Messungen"}
              <br />
              {preview.newFilterEntries.length > 0
                ? `🔧 ${preview.newFilterEntries.length} neue Filterpflege-Einträge`
                : "🔧 Keine neuen Filtereinträge"}
              {preview.hasNewWaterChange && <><br />🚿 Wasseraustausch-Datum wird aktualisiert</>}
              {preview.hasNewProfile     && <><br />⚙️ Pool-Profil wird übernommen</>}
            </div>

            {preview.newEntries.length === 0 && preview.newFilterEntries.length === 0 && !preview.hasNewWaterChange && !preview.hasNewProfile ? (
              <div style={{ marginTop: 10, fontSize: "0.75rem", color: "#64748b" }}>
                Keine neuen Daten im Backup gefunden.
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={confirmImport}
                  style={{ flex: 1, padding: "9px", background: "#0369a1", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: "0.82rem" }}
                >
                  ✓ Importieren
                </button>
                <button
                  onClick={() => setPreview(null)}
                  style={{ padding: "9px 14px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: "0.82rem" }}
                >
                  Abbrechen
                </button>
              </div>
            )}
            {preview.newEntries.length === 0 && !preview.hasNewWaterChange && !preview.hasNewProfile && (
              <button
                onClick={() => setPreview(null)}
                style={{ marginTop: 8, padding: "7px 14px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: "0.78rem" }}
              >
                Schließen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function btnStyle(color: string, bg: string): React.CSSProperties {
  return {
    width: "100%", padding: "10px 12px", textAlign: "left",
    background: bg, border: `1px solid ${color}22`,
    borderRadius: 10, fontWeight: 600, color,
    cursor: "pointer", fontSize: "0.82rem",
  };
}
