import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import {
  type WaterChangeRecord, type WaterAddition,
  DEFAULT_WATER_CHANGE,
} from "../utils/waterChange";

const STORAGE_KEY = "waterChange";

export function useWaterChange() {
  const [record, setRecord] = useState<WaterChangeRecord>(DEFAULT_WATER_CHANGE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<WaterChangeRecord>(STORAGE_KEY).then((stored) => {
      if (stored) {
        // Migration: altes Format hatte { date: string, intervalDays: number }
        if ("date" in stored && !("additions" in stored)) {
          setRecord({ additions: [], intervalDays: (stored as { intervalDays?: number }).intervalDays ?? 14 });
        } else {
          setRecord(stored);
        }
      }
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
      date:        new Date().toISOString().slice(0, 10),
      litersAdded,
      note,
    };
    setRecord(prev => ({ ...prev, additions: [addition, ...prev.additions] }));
  };

  const saveRecord = (r: WaterChangeRecord) => setRecord(r);

  return { record, loaded, addEntry, saveRecord };
}
