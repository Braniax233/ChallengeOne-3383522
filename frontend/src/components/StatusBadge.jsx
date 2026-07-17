/**
 * StatusBadge — pill badge matching the design inspiration.
 * NORMAL    → teal
 * WARNING   → amber
 * CRITICAL  → coral/red
 * RESOLVED  → gray
 */
export default function StatusBadge({ status = "" }) {
  const s = String(status).toUpperCase();

  const styles = {
    NORMAL:    "bg-teal-50 text-teal-600",
    WARNING:   "bg-amber-50 text-amber-600",
    CRITICAL:  "bg-coral-50 text-coral-500",
    RESOLVED:  "bg-ink-100 text-ink-500 dark:text-gray-400",
    INFECTIOUS: "bg-coral-50 text-coral-500",
    "NOT INFECTIOUS": "bg-teal-50 text-teal-600",
  };

  const labels = {
    NORMAL:    "Normal",
    WARNING:   "Warning",
    CRITICAL:  "Critical",
    RESOLVED:  "Resolved",
  };

  const cls = styles[s] ?? "bg-ink-100 text-ink-500 dark:text-gray-400";
  const label = labels[s] ?? status;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}
