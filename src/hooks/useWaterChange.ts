import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import { type WaterChangeRecord } from "../utils/waterChange";

const STORAGE_KEY = "waterChange";

export function useWaterChange() {
  const [record, setRecord] = useState<WaterChangeRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<WaterChangeRecord>(STORAGE_KEY).then((stored) => {
      setRecord(stored ?? null);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded || record === null) return;
    set(STORAGE_KEY, record);
  }, [record, loaded]);

  const saveRecord = (r: WaterChangeRecord) => setRecord(r);

  /** Datum auf heute zurücksetzen, Intervall bleibt erhalten */
  const resetDate = (intervalDays?: number) =>
    setRecord({
      date:         new Date().toISOString().slice(0, 10),
      intervalDays: intervalDays ?? record?.intervalDays ?? 90,
    });

  return { record, loaded, saveRecord, resetDate };
}
