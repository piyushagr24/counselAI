import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "default" | "warning";
  hint?: string;
}

export default function StatCard({ label, value, icon: Icon, tone = "default", hint }: StatCardProps) {
  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            tone === "warning" ? "bg-risk-high/10 text-risk-high" : "bg-accent-50 text-accent-600"
          }`}
        >
          <Icon size={18} strokeWidth={2} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
