import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { type PoolEntry }          from "../hooks/usePoolEntries";
import { type FilterEntry, type FilterSettings } from "./filterLog";
import { type WaterChangeRecord }  from "./waterChange";
import { type PoolProfile }        from "../hooks/usePoolProfile";
import { LIMITS, getLimitsForPoolType, type FieldKey, type ActiveLimits } from "./constants";
import { calculateLSI } from "./contextualRisk";
import { localToday } from "./status";

export interface AppSettings {
  profile:         PoolProfile;
  filterSettings?: FilterSettings;
}

export interface AquaLogBackup {
  version:     string;
  exportDate:  string;
  entries:     PoolEntry[];
  filterLog:   FilterEntry[];
  waterChange: WaterChangeRecord | null;
  settings:    AppSettings;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function todayStr(): string {
  return localToday();
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── JSON Export ────────────────────────────────────────────────────────────
export function exportJSON(backup: AquaLogBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  triggerDownload(blob, `aqualog-backup-${todayStr()}.json`);
  localStorage.setItem("lastBackupDate", todayStr());
}

// ── CSV Export ─────────────────────────────────────────────────────────────
export function exportCSV(entries: PoolEntry[]): void {
  const header = "Datum;Chlor (mg/l);pH;Temperatur (°C);KH (mg/l);GH (mg/l);CYA (mg/l);LSI;Notiz;Außentemp (°C);UV-Index;Regen (mm)";
  const rows   = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => [
      e.date,
      e.cl.toFixed(2),
      e.ph.toFixed(2),
      e.temp.toFixed(1),
      e.kh?.toFixed(0) ?? "",
      e.gh?.toFixed(0) ?? "",
      e.cya?.toFixed(0) ?? "",
      e.gh != null && e.kh != null ? calculateLSI(e.ph, e.temp, e.gh, e.kh).toFixed(2) : "",
      `"${(e.note ?? "").replace(/"/g, '""')}"`,
      e.outTemp?.toFixed(1) ?? "",
      e.uvIndex?.toFixed(1) ?? "",
      e.rainMm?.toFixed(1)  ?? "",
    ].join(";"));
  const csv  = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM für Excel
  triggerDownload(blob, `aqualog-messungen-${todayStr()}.csv`);
}

// ── Chart Canvas (für PDF) ──────────────────────────────────────────────────
function drawChartCanvas(entries: PoolEntry[], field: FieldKey, widthPx: number, heightPx: number, limits: ActiveLimits): string {
  const scale  = 2;
  const canvas = document.createElement("canvas");
  canvas.width  = widthPx  * scale;
  canvas.height = heightPx * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const values = entries.map(e => e[field] as number);
  const minV   = Math.min(...values, limits[field].min) - 0.1;
  const maxV   = Math.max(...values, limits[field].max) + 0.1;
  const range  = maxV - minV || 1;
  const padL = 10, padR = 10, padT = 8, padB = 8;
  const dW = widthPx - padL - padR;
  const dH = heightPx - padT - padB;

  // Hintergrund
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Grenzlinien
  const drawRef = (val: number) => {
    const y = padT + dH - ((val - minV) / range) * dH;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth   = 0.75;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + dW, y);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawRef(limits[field].min);
  drawRef(limits[field].max);

  // Datenlinie
  ctx.strokeStyle = LIMITS[field].color;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  entries.forEach((e, i) => {
    const x = padL + (i / Math.max(entries.length - 1, 1)) * dW;
    const y = padT + dH - ((e[field] as number - minV) / range) * dH;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Punkte
  ctx.fillStyle = LIMITS[field].color;
  entries.forEach((e, i) => {
    const x = padL + (i / Math.max(entries.length - 1, 1)) * dW;
    const y = padT + dH - ((e[field] as number - minV) / range) * dH;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  return canvas.toDataURL("image/png");
}

// ── PDF Export ─────────────────────────────────────────────────────────────
export function exportPDF(entries: PoolEntry[], profile: PoolProfile): void {
  const doc    = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const year   = new Date().getFullYear();
  const activeLimits = getLimitsForPoolType(profile.poolType);

  // ── Header ──────────────────────────────────────────────────
  doc.setFillColor(3, 105, 161);
  doc.rect(0, 0, 210, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Pool Bericht — Saisonbericht", 14, 11);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${profile.name}  ·  ${profile.volumeLiters} L  ·  Saison ${year}`, 14, 19);
  doc.text(`Erstellt: ${new Date().toLocaleDateString("de-DE")}`, 196, 19, { align: "right" });

  let curY = 34;

  // ── Zusammenfassung ──────────────────────────────────────────
  if (sorted.length > 0) {
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.text("Zusammenfassung", 14, curY);
    curY += 6;

    const stats: [string, string][] = [
      ["Messungen",  String(sorted.length)],
      ["Ø Chlor",    `${avg(sorted.map(e => e.cl)).toFixed(2)} mg/l`],
      ["Ø pH",       avg(sorted.map(e => e.ph)).toFixed(2)],
      ["Ø Temp",     `${avg(sorted.map(e => e.temp)).toFixed(1)}°C`],
      ["Zeitraum",   `${sorted[0].date} – ${sorted[sorted.length - 1].date}`],
    ];

    doc.setFontSize(8);
    stats.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x   = 14 + col * 65;
      const y   = curY + row * 10;
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text(label, x, y);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.text(value, x, y + 5);
    });

    curY += Math.ceil(stats.length / 3) * 10 + 4;
  }

  // ── Verlaufsdiagramme ────────────────────────────────────────
  if (sorted.length >= 3) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.text("Verläufe", 14, curY);
    curY += 5;

    (["cl", "ph", "temp"] as FieldKey[]).forEach(field => {
      const img = drawChartCanvas(sorted, field, 1092, 240, activeLimits); // 182mm × 40mm @ 150dpi
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text(`${LIMITS[field].label}${LIMITS[field].unit ? ` (${LIMITS[field].unit.trim()})` : ""}`, 14, curY + 3.5);
      doc.addImage(img, "PNG", 14, curY + 5, 182, 40);
      curY += 50;
    });
  }

  // ── Messtabelle ──────────────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.text("Alle Messungen", 14, curY + 4);

  autoTable(doc, {
    startY:  curY + 8,
    head: [["Datum", "Cl mg/l", "pH", "Temp °C", "CYA", "LSI", "Außen °C", "UV", "Notiz"]],
    body: [...sorted].reverse().map(e => [
      new Date(e.date + "T12:00:00").toLocaleDateString("de-DE"),
      e.cl.toFixed(2),
      e.ph.toFixed(2),
      e.temp.toFixed(1),
      e.cya != null ? String(e.cya) : "—",
      e.gh != null && e.kh != null ? calculateLSI(e.ph, e.temp, e.gh, e.kh).toFixed(2) : "—",
      e.outTemp != null ? e.outTemp.toFixed(1) : "—",
      e.uvIndex != null ? e.uvIndex.toFixed(1) : "—",
      e.note ?? "",
    ]),
    headStyles:          { fillColor: [3, 105, 161], fontSize: 8, fontStyle: "bold" },
    bodyStyles:          { fontSize: 7.5 },
    alternateRowStyles:  { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 16, halign: "right" },
      2: { cellWidth: 12, halign: "right" },
      3: { cellWidth: 16, halign: "right" },
      4: { cellWidth: 12, halign: "right" },
      5: { cellWidth: 12, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 10, halign: "right" },
      8: { cellWidth: "auto" },
    },
  });

  doc.save(`aqualog-saisonbericht-${year}.pdf`);
  localStorage.setItem("lastBackupDate", todayStr());
}

// ── Import / Parse ─────────────────────────────────────────────────────────
export function parseBackupFile(file: File): Promise<AquaLogBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target!.result as string) as AquaLogBackup;
        if (!parsed.version || !Array.isArray(parsed.entries)) {
          reject(new Error("Ungültiges Backup-Format"));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error("Datei konnte nicht gelesen werden"));
      }
    };
    reader.onerror = () => reject(new Error("Lesefehler"));
    reader.readAsText(file);
  });
}
