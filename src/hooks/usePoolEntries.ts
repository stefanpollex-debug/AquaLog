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

/** Gibt true zurück wenn entries_spa leer ist oder nur den Demo-Eintrag enthält */
async function isSpaEmpty(): Promise<boolean> {
  const spa = await get<PoolEntry[]>("entries_spa");
  return !spa?.length || (spa.length === 1 && spa[0].id === FIRST_ENTRY.id);
}

/** ⚠️  Migration + Recovery: pool_entries → entries_spa.
 *
 *  Läuft bei jedem Start — falls entries_spa nur den Demo-Eintrag enthält,
 *  wird automatisch aus pool_entries_backup oder pool_entries wiederhergestellt.
 *  So gehen keine Daten verloren, auch wenn die erste Migration fehlschlug. */
async function runMigrationIfNeeded(): Promise<void> {
  const version = await get<number>(DB_VERSION_KEY);

  // Migration bereits gelaufen — aber Recovery prüfen falls entries_spa leer ist
  if ((version ?? 0) >= TARGET_VERSION) {
    if (!(await isSpaEmpty())) return; // Daten vorhanden → nichts zu tun

    // entries_spa ist leer/demo — Backup suchen
    const backup = await get<PoolEntry[]>("pool_entries_backup");
    if (backup?.length) {
      await set("entries_spa", backup);
      console.log(`[AquaLog] ✓ Recovery: ${backup.length} Einträge aus pool_entries_backup wiederhergestellt`);
      return;
    }

    // Backup nicht gefunden — alten Key prüfen (Falls Löschen fehlschlug)
    const legacy = await get<PoolEntry[]>(LEGACY_KEY);
    if (legacy?.length) {
      await set("pool_entries_backup", legacy); // erst sichern
      await set("entries_spa", legacy);
      await del(LEGACY_KEY);
      console.log(`[AquaLog] ✓ Recovery: ${legacy.length} Einträge aus pool_entries wiederhergestellt`);
    }
    return;
  }

  // ── Erste Migration ───────────────────────────────────────────────────────

  const legacy = await get<PoolEntry[]>(LEGACY_KEY);

  if (!legacy?.length) {
    // Kein Altdaten-Bestand — nur Versionsnummer setzen
    await set(DB_VERSION_KEY, TARGET_VERSION);
    return;
  }

  // Schritt 1: Sicherungskopie in IndexedDB
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
