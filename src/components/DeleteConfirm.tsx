import { type PoolEntry } from "../hooks/usePoolEntries";

interface Props {
  entry: PoolEntry;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirm({ entry, onConfirm, onCancel }: Props) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "28px 24px 36px", width: "100%", maxWidth: 480, boxShadow: "0 -8px 40px #0003" }}>
        <div style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: 10 }}>🗑️</div>
        <div style={{ fontWeight: 700, fontSize: "1rem", textAlign: "center", marginBottom: 6 }}>Eintrag löschen?</div>
        <div style={{ fontSize: "0.85rem", color: "#64748b", textAlign: "center", marginBottom: 22 }}>
          Messung vom <b>{entry.date}</b> wird unwiderruflich gelöscht.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: 13, background: "#f1f5f9", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer", color: "#475569" }}>
            Abbrechen
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: 13, background: "linear-gradient(90deg,#dc2626,#ef4444)", color: "white", border: "none", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}
