/**
 * StatCard — summary metric card matching the inspiration design.
 * White card, label + value, teal circular arrow button top-right,
 * two sub-metrics with icons below.
 */
import { ArrowUpRight } from "lucide-react";

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "teal",
  sub1Label,
  sub1Value,
  sub1Icon: Sub1Icon,
  sub2Label,
  sub2Value,
  sub2Icon: Sub2Icon,
  onClick,
}) {
  return (
    <div
      className={`vx-card p-5 flex flex-col gap-4 ${onClick ? "cursor-pointer hover:shadow-card-hover transition-shadow" : ""}`}
      onClick={onClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-500 dark:text-gray-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-3xl font-bold text-ink-900 dark:text-gray-100 mt-1 leading-none">
            {value ?? "—"}
          </p>
          {subtitle && (
            <p className="text-xs text-ink-400 mt-1">{subtitle}</p>
          )}
        </div>
        <button className="teal-circle-btn">
          <ArrowUpRight size={16} />
        </button>
      </div>

      {/* Sub metrics */}
      {(sub1Label || sub2Label) && (
        <div className="border-t border-ink-100 pt-3 space-y-2">
          {sub1Label && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-500 dark:text-gray-400">
                {Sub1Icon && <Sub1Icon size={12} className="text-ink-400" />}
                {sub1Label}
              </span>
              <span className="font-semibold text-ink-800 dark:text-gray-200">{sub1Value ?? "—"}</span>
            </div>
          )}
          {sub2Label && (
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-ink-500 dark:text-gray-400">
                {Sub2Icon && <Sub2Icon size={12} className="text-ink-400" />}
                {sub2Label}
              </span>
              <span className="font-semibold text-ink-800 dark:text-gray-200">{sub2Value ?? "—"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
