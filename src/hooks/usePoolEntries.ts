import { useState, useEffect } from "react";
import { get, set, del } from "idb-keyval";
import { FIRST_ENTRY } from "../utils/constants";

export type ChemProduct = "chlor_granulat" | "total_blue" | "ph_plus" | "ph_minus" | "algenmittel" | "klaermittel";
export type ChemUnit    = "g" | "Tab" | "ml";

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
  kh?: number;                      // Alkalinität / Karbonathärte (mg/l) — optional
  gh?: number;                      // Gesamthärte / Calcium-Härte (mg/l) — optional
  note: string;
  outTemp?:    number;              // Außentemperatur (°C)
  uvIndex?:    number;              // UV-Index
  rainMm?:     number;              // Tages-Niederschlag (mm)
  chemicals?:  ChemicalAddition[];  // zugefügte Chemikalien
}

export type ProfileKey = "entries_spa" | "entries_tap" | "entries_rain";

const LEGACY_KEY     = "pool_entries";
const DB_VERSION_KEY = "db_version";
const TARGET_VERSION = 1;

/** ⚠️  Einmalige Migration: pool_entries → entries_spa.
 *  Läuft nur beim ersten Start nach dem Update.
 *  Sicherungskopie wird unter pool_entries_backup gespeichert. */
async function runMigrationIfNeeded(): Promise<void> {
  const version = await get<number>(DB_VERSION_KEY);
  if ((version ?? 0) >= TARGET_VERSION) return; // bereits migriert

  const legacy = await get<PoolEntry[]>(LEGACY_KEY);

  if (!legacy?.length) {
    // Kein Altdaten-Bestand — nur Versionsnummer setzen
    await set(DB_VERSION_KEY, TARGET_VERSION);
    return;
  }

  // Schritt 1: Sicherungskopie in IndexedDB (nie verloren, kein Popup)
  await set("pool_entries_backup", legacy);
  console.log(`[AquaLog] Backup: ${legacy.length} Einträge → pool_entries_backup`);

  // Schritt 2: Daten nach entries_spa kopieren
  await set("entries_spa", legacy);

  // Schritt 3: Prüfen ob alle Einträge korrekt übertragen wurden
  const copied = await get<PoolEntry[]>("entries_spa");
  if (!copied || copied.length !== legacy.length) {
    console.error("[AquaLog] Migration fehlgeschlagen — Originaldaten bleiben erhalten");
    return;
  }

  // Schritt 4: Alten Key löschen
  await del(LEGACY_KEY);

  // Schritt 5: Migration mit Versionsnummer markieren
  await set(DB_VERSION_KEY, TARGET_VERSION);
  console.log(`[AquaLog] ✓ ${legacy.length} Einträge migriert: pool_entries → entries_spa`);
}

export function usePoolEntries(profileKey: ProfileKey = "entries_spa") {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      // Migration nur beim Spa-Profil nötig (das ist das Legacy-Profil)
      if (profileKey === "entries_spa") {
        await runMigrationIfNeeded();
      }

      const stored = await get<PoolEntry[]>(profileKey);
      if (!active) return;

      if (stored?.length) {
        setEntries(stored);
      } else if (profileKey === "entries_spa") {
        // Erststart ohne Altdaten: Demo-Eintrag anzeigen
        setEntries([FIRST_ENTRY]);
      } else {
        // Tap / Rain: leer starten
        setEntries([]);
      }
      setLoaded(true);
    }

    init();
    return () => { active = false; };
  }, [profileKey]);

  useEffect(() => {
    if (!loaded) return;
    set(profileKey, entries);
  }, [entries, loaded, profileKey]);

  const addEntry = (entry: Omit<PoolEntry, "id">) => {
    setEntries((prev) => [{ ...entry, id: Date.now() }, ...prev]);
  };

  const deleteEntry = (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const bulkImport = (toAdd: PoolEntry[]) =>
    setEntries(prev => {
      const existingIds = new Set(prev.map(e => e.id));
      const novel = toAdd.filter(e => !existingIds.has(e.id));
      if (!novel.length) return prev;
      return [...novel, ...prev].sort((a, b) =>
        b.date.localeCompare(a.date) || b.id - a.id
      );
    });

  return { entries, loaded, addEntry, deleteEntry, bulkImport };
}
