import { type Status } from "../utils/status";

interface Props {
  status: Status;
}

const COLOR: Record<Status, string> = { ok: "#22c55e", low: "#f59e0b", high: "#ef4444" };

export function TrafficLight({ status }: Props) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {(["high", "low", "ok"] as Status[]).map((s) => (
        <div
          key={s}
          style={{
            width: 13, height: 13, borderRadius: "50%",
            background: status === s ? COLOR[s] : "#e5e7eb",
            boxShadow: status === s ? `0 0 7px ${COLOR[s]}` : "none",
            transition: "all 0.3s",
          }}
        />
      ))}
    </div>
  );
}
