import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import {
  type FilterEntry, type FilterSettings,
  DEFAULT_FILTER_SETTINGS,
} from "../utils/filterLog";

const KEY_LOG      = "filterLog";
const KEY_SETTINGS = "filterSettings";

export function useFilterLog() {
  const [log,      setLog]      = useState<FilterEntry[]>([]);
  const [settings, setSettings] = useState<FilterSettings>(DEFAULT_FILTER_SETTINGS);
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    Promise.all([
      get<FilterEntry[]>(KEY_LOG),
      get<FilterSettings>(KEY_SETTINGS),
    ]).then(([storedLog, storedSettings]) => {
      setLog(storedLog ?? []);
      if (storedSettings) setSettings(storedSettings);
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (loaded) set(KEY_LOG,      log);      }, [log,      loaded]);
  useEffect(() => { if (loaded) set(KEY_SETTINGS, settings); }, [settings, loaded]);

  const addEntry = (type: FilterEntry["type"], note?: string) =>
    setLog(prev => [
      { id: Date.now(), date: new Date().toISOString().slice(0, 10), type, note },
      ...prev,
    ]);

  const bulkImport = (toAdd: FilterEntry[]) =>
    setLog(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      const novel = toAdd.filter(e => !existingIds.has(e.id));
      if (!novel.length) return prev;
      return [...novel, ...prev].sort((a, b) =>
        b.date.localeCompare(a.date) || b.id - a.id
      );
    });

  const deleteEntry = (id: number) =>
    setLog(prev => prev.filter(e => e.id !== id));

  const lastClean   = log.find(e => e.type === "clean");
  const lastReplace = log.find(e => e.type === "replace");

  return { log, settings, loaded, addEntry, deleteEntry, bulkImport, setSettings, lastClean, lastReplace };
}
