import { type Status } from "../utils/status";

interface Props {
  status: Status;
}

const MAP: Record<Status, { bg: string; color: string; label: string }> = {
  ok:   { bg: "#d1fae5", color: "#065f46", label: "✓ OK" },
  low:  { bg: "#fef3c7", color: "#92400e", label: "↓ Zu niedrig" },
  high: { bg: "#fee2e2", color: "#991b1b", label: "↑ Zu hoch" },
  warn: { bg: "#fef3c7", color: "#92400e", label: "⚠ Grenzwertig" },
};

export function StatusBadge({ status }: Props) {
  const s = MAP[status];
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
      {s.label}
    </span>
  );
}
