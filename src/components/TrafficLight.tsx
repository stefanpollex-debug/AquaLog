import { type Status } from "../utils/status";

interface Props {
  status: Status;
}

const COLOR: Record<Status, string> = { ok: "#22c55e", low: "#f59e0b", high: "#ef4444", warn: "#f59e0b" };

// Nur 3 visuelle Positionen (high/low/ok) — "warn" leuchtet auf der "low"-Position,
// da beide gelb sind. Der korrekte Text ("Grenzwertig" statt "Zu niedrig") kommt aus StatusBadge.
export function TrafficLight({ status }: Props) {
  const dotKey = status === "warn" ? "low" : status;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {(["high", "low", "ok"] as Status[]).map((s) => (
        <div
          key={s}
          style={{
            width: 13, height: 13, borderRadius: "50%",
            background: dotKey === s ? COLOR[status] : "#e5e7eb",
            boxShadow: dotKey === s ? `0 0 7px ${COLOR[status]}` : "none",
            transition: "all 0.3s",
          }}
        />
      ))}
    </div>
  );
}
