import { useState, useEffect } from "react";
import { get, set } from "idb-keyval";
import { FIRST_ENTRY } from "../utils/constants";

export type ChemProduct = "chlor_granulat" | "total_blue" | "ph_plus" | "ph_minus";
export type ChemUnit    = "g" | "Tab";

export interface ChemicalAddition {
  product: ChemProduct;
  amount:  number;
  unit:    ChemUnit;
}

export interface PoolEntry {
  id: number;
  date: string;
  cl: number;
  ph: number;
  temp: number;
  note: string;
  outTemp?:    number;              // Außentemperatur (°C)
  uvIndex?:    number;              // UV-Index
  rainMm?:     number;              // Tages-Niederschlag (mm)
  chemicals?:  ChemicalAddition[];  // zugefügte Chemikalien
}

const STORAGE_KEY = "pool_entries";

export function usePoolEntries() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    get<PoolEntry[]>(STORAGE_KEY).then((stored) => {
      setEntries(stored?.length ? stored : [FIRST_ENTRY]);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    set(STORAGE_KEY, entries);
  }, [entries, loaded]);

  const addEntry = (entry: Omit<PoolEntry, "id">) => {
    setEntries((prev) => [{ ...entry, id: Date.now() }, ...prev]);
  };

  const deleteEntry = (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return { entries, loaded, addEntry, deleteEntry };
}
