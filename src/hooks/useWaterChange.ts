import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import { localToday } from "../utils/status";
import {
  type WaterChangeRecord, type WaterAddition, type FullWaterChange,
  DEFAULT_WATER_CHANGE,
} from "../utils/waterChange";

const STORAGE_KEY = "waterChange";

/** Füllt fehlende Felder bei älteren gespeicherten Datensätzen auf — sowohl das ganz
 *  alte Format ({date, intervalDays}) als auch das Zwischenformat ohne fullChanges. */
function migrate(stored: unknown): WaterChangeRecord {
  const s = stored as Partial<WaterChangeRecord> & { date?: string };
  if (s.date && !s.additions) {
    return { ...DEFAULT_WATER_CHANGE, intervalDays: s.intervalDays ?? 14 };
  }
  return {
    additions:             s.additions ?? [],
    fullChanges:            s.fullChanges ?? [],
    intervalDays:           s.intervalDays ?? DEFAULT_WATER_CHANGE.intervalDays,
    fullChangeIntervalDays: s.fullChangeIntervalDays ?? DEFAULT_WATER_CHANGE.fullChangeIntervalDays,
  };
}

export function useWaterChange() {
  const [record, setRecord] = useState<WaterChangeRecord>(DEFAULT_WATER_CHANGE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<WaterChangeRecord>(STORAGE_KEY).then((stored) => {
      if (stored) setRecord(migrate(stored));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    set(STORAGE_KEY, record);
  }, [record, loaded]);

  const addEntry = (litersAdded: number, note?: string) => {
    const addition: WaterAddition = {
      id:          Date.now(),
      date:        localToday(),
      litersAdded,
      note,
    };
    setRecord(prev => ({ ...prev, additions: [addition, ...prev.additions] }));
  };

  const deleteEntry = (id: number) =>
    setRecord(prev => ({ ...prev, additions: prev.additions.filter(a => a.id !== id) }));

  const addFullChange = (note?: string) => {
    const change: FullWaterChange = { id: Date.now(), date: localToday(), note };
    setRecord(prev => ({ ...prev, fullChanges: [change, ...prev.fullChanges] }));
  };

  const deleteFullChange = (id: number) =>
    setRecord(prev => ({ ...prev, fullChanges: prev.fullChanges.filter(c => c.id !== id) }));

  const saveRecord = (r: WaterChangeRecord) => setRecord(r);

  return { record, loaded, addEntry, deleteEntry, addFullChange, deleteFullChange, saveRecord };
}
