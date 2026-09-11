import { Plus, Minus, Pencil, MapPin } from "lucide-react";
import type { ChangeItem } from "../types";

const config = {
  ADDED: { label: "ADDED", icon: Plus, style: "bg-risk-low/10 text-risk-low border-risk-low/20" },
  REMOVED: { label: "REMOVED", icon: Minus, style: "bg-risk-high/10 text-risk-high border-risk-high/20" },
  MODIFIED: { label: "MODIFIED", icon: Pencil, style: "bg-risk-medium/10 text-risk-medium border-risk-medium/20" },
};

export default function ComparisonResult({ change }: { change: ChangeItem }) {
  const { label, icon: Icon, style } = config[change.changeType];

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>
          <Icon size={12} />
          {label}
        </span>
        {change.section && <span className="text-xs text-slate-400">{change.section}</span>}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className={change.textA ? "" : "flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400"}>
          {change.textA ? (
            <>
              <p className="mb-1 text-xs font-medium text-slate-400">Version A</p>
              <p className="rounded-lg bg-risk-high/5 p-3 text-sm text-slate-700 line-through decoration-risk-high/40">
                {change.textA}
              </p>
              {change.pageNumberA && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={11} /> Page {change.pageNumberA}
                </div>
              )}
            </>
          ) : (
            <span className="p-3">Not present in Version A</span>
          )}
        </div>

        <div className={change.textB ? "" : "flex items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400"}>
          {change.textB ? (
            <>
              <p className="mb-1 text-xs font-medium text-slate-400">Version B</p>
              <p className="rounded-lg bg-risk-low/5 p-3 text-sm text-slate-700">{change.textB}</p>
              {change.pageNumberB && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={11} /> Page {change.pageNumberB}
                </div>
              )}
            </>
          ) : (
            <span className="p-3">Not present in Version B</span>
          )}
        </div>
      </div>
    </div>
  );
}
