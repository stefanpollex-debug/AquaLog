import { useState, useMemo } from "react";
import { type PoolEntry } from "../hooks/usePoolEntries";
import { CHEM_PRODUCTS } from "./ChemLogInput";
import { LIMITS, type FieldKey } from "../utils/constants";
import { getStatus } from "../utils/status";
import {
  getMonthGrid, getAvailableMonths, getDayColor,
  formatDate, MONTH_NAMES, WEEKDAY_NAMES,
} from "../utils/calendar";
import { StatusBadge } from "./StatusBadge";

interface Props {
  entries: PoolEntry[];
  onDelete: (entry: PoolEntry) => void;
}

export function CalendarHeatmap({ entries, onDelete }: Props) {
  const now = new Date();
  const [currentYear, setCurrentYear]   = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const availableMonths = useMemo(() => getAvailableMonths(entries), [entries]);

  const entryMap = useMemo(() => {
    const map = new Map<string, PoolEntry>();
    entries.forEach(e => map.set(e.date, e));
    return map;
  }, [entries]);

  const grid = useMemo(
    () => getMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const selectedEntry  = selectedDate ? entryMap.get(selectedDate) : undefined;
  const currentIndex   = availableMonths.findIndex(
    m => m.year === currentYear && m.month === currentMonth
  );
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < availableMonths.length - 1;

  const goPrev = () => {
    if (!canGoPrev) return;
    const { year, month } = availableMonths[currentIndex - 1];
    setCurrentYear(year); setCurrentMonth(month); setSelectedDate(null);
  };
  const goNext = () => {
    if (!canGoNext) return;
    const { year, month } = availableMonths[currentIndex + 1];
    setCurrentYear(year); setCurrentMonth(month); setSelectedDate(null);
  };

  const handleDay = (day: number) => {
    const d = formatDate(currentYear, currentMonth, day);
    setSelectedDate(prev => prev === d ? null : d);
  };

  const todayStr = formatDate(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div style={{ background: "white", borderRadius: 18, padding: "16px 14px 14px", boxShadow: "0 2px 12px #0369a110", marginBottom: 14 }}>

      {/* ── Monats-Navigation ─────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={goPrev} disabled={!canGoPrev} style={{
          background: "none", border: "none", fontSize: "1.4rem", lineHeight: 1,
          cursor: canGoPrev ? "pointer" : "default",
          color: canGoPrev ? "#0369a1" : "#cbd5e1", padding: "2px 8px",
        }}>‹</button>
        <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.95rem" }}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </span>
        <button onClick={goNext} disabled={!canGoNext} style={{
          background: "none", border: "none", fontSize: "1.4rem", lineHeight: 1,
          cursor: canGoNext ? "pointer" : "default",
          color: canGoNext ? "#0369a1" : "#cbd5e1", padding: "2px 8px",
        }}>›</button>
      </div>

      {/* ── Wochentage ────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {WEEKDAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.65rem", fontWeight: 600, color: "#94a3b8" }}>{d}</div>
        ))}
      </div>

      {/* ── Tage-Gitter ───────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {grid.map((day, i) => {
          if (day === null) return <div key={i} style={{ height: 42 }} />;

          const dateStr   = formatDate(currentYear, currentMonth, day);
          const entry     = entryMap.get(dateStr);
          const dotColor  = getDayColor(entry);
          const isSelected = selectedDate === dateStr;
          const isToday    = dateStr === todayStr;

          return (
            <div key={i} onClick={() => handleDay(day)} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: 42,
              borderRadius: 8, cursor: "pointer",
              background: isSelected ? "#e0f2fe" : "transparent",
              transition: "background 0.15s",
            }}>
              <span style={{
                fontSize: "0.75rem", lineHeight: 1, marginBottom: 4,
                fontWeight: isToday ? 800 : 400,
                color: isToday ? "#0369a1" : "#475569",
              }}>{day}</span>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: dotColor ?? "transparent",
                border: dotColor
                  ? "none"
                  : isToday
                    ? "2px dashed #93c5fd"
                    : "2px solid #e2e8f0",
                boxSizing: "border-box",
                transition: "background 0.2s",
              }} />
            </div>
          );
        })}
      </div>

      {/* ── Legende ───────────────────────────── */}
      <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 10 }}>
        {([
          ["#22c55e", "Alles OK"],
          ["#f59e0b", "1 Wert außerh."],
          ["#ef4444", "≥2 Werte"],
        ] as [string, string][]).map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.62rem", color: "#94a3b8" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }} />
            {l}
          </div>
        ))}
      </div>

      {/* ── Detail-Karte (aufklappbar) ─────────── */}
      {selectedDate && (
        <div style={{ marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
          <style>{`@keyframes fadeSlide{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <div style={{ animation: "fadeSlide 0.15s ease" }}>
            {selectedEntry ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b" }}>
                    📅 {new Date(selectedDate + "T12:00:00").toLocaleDateString("de-DE", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </div>
                  <button onClick={() => onDelete(selectedEntry)} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "1rem", color: "#cbd5e1", padding: 0,
                  }}>🗑️</button>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {(["cl", "ph", "temp"] as FieldKey[]).map(k => (
                    <div key={k} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 6px", flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: 3 }}>{LIMITS[k].label}</div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
                        {selectedEntry[k].toFixed(1)}{LIMITS[k].unit}
                      </div>
                      <StatusBadge status={getStatus(k, selectedEntry[k])} />
                    </div>
                  ))}
                </div>

                {/* Außenwetter zum Messzeitpunkt */}
                {(selectedEntry.outTemp != null || selectedEntry.uvIndex != null || selectedEntry.rainMm != null) && (
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selectedEntry.outTemp != null && (
                      <div style={{ fontSize: "0.72rem", color: "#64748b", background: "#f8fafc", borderRadius: 6, padding: "3px 8px" }}>
                        🌡️ {selectedEntry.outTemp.toFixed(1)}°C
                      </div>
                    )}
                    {selectedEntry.uvIndex != null && (
                      <div style={{ fontSize: "0.72rem", color: "#64748b", background: "#f8fafc", borderRadius: 6, padding: "3px 8px" }}>
                        🔆 UV {selectedEntry.uvIndex.toFixed(1)}
                      </div>
                    )}
                    {selectedEntry.rainMm != null && (
                      <div style={{
                        fontSize: "0.72rem", borderRadius: 6, padding: "3px 8px",
                        background: selectedEntry.rainMm > 0 ? "#eff6ff" : "#f8fafc",
                        color: selectedEntry.rainMm > 0 ? "#1d4ed8" : "#64748b",
                      }}>
                        💧 {selectedEntry.rainMm > 0 ? `${selectedEntry.rainMm.toFixed(1)} mm` : "Kein Regen"}
                      </div>
                    )}
                  </div>
                )}

                {/* Chemikalien */}
                {selectedEntry.chemicals && selectedEntry.chemicals.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: 4 }}>Zugegeben:</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {selectedEntry.chemicals.map(c => {
                        const p = CHEM_PRODUCTS.find(p => p.id === c.product);
                        return (
                          <div key={c.product} style={{
                            fontSize: "0.72rem", borderRadius: 6, padding: "3px 8px",
                            background: "#f0fdf4", color: "#15803d", fontWeight: 600,
                          }}>
                            {p?.emoji} {c.amount} {c.unit} {p?.shortLabel}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedEntry.note && (
                  <div style={{ marginTop: 8, fontSize: "0.78rem", color: "#64748b", fontStyle: "italic" }}>
                    📝 {selectedEntry.note}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.82rem", padding: "6px 0" }}>
                Kein Eintrag für {new Date(selectedDate + "T12:00:00").toLocaleDateString("de-DE", {
                  day: "numeric", month: "long",
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
