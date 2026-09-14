import type { RiskSeverity } from "../types";

const styles: Record<string, { badge: string; dot: string }> = {
  Critical: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-600" },
  High: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-600" },
  Medium: { badge: "bg-amber-50 text-amber-800 border-amber-300", dot: "bg-amber-500" },
  Low: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-600" },
  Standard: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-600" },
};

export default function RiskBadge({ severity }: { severity: RiskSeverity | string }) {
  const config = styles[severity] || styles.Low;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {severity}
    </span>
  );
}
