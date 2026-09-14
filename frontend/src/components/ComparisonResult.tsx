import { useState } from "react";
import { Plus, Minus, Pencil, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ChangeItem } from "../types";

const config = {
  ADDED: {
    label: "Added",
    icon: Plus,
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dotStyle: "bg-emerald-500",
  },
  REMOVED: {
    label: "Removed",
    icon: Minus,
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-200/80",
    dotStyle: "bg-rose-500",
  },
  MODIFIED: {
    label: "Modified",
    icon: Pencil,
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80",
    dotStyle: "bg-amber-500",
  },
};

export default function ComparisonResult({
  change,
  labelA = "Version A",
  labelB = "Version B",
}: {
  change: ChangeItem;
  labelA?: string;
  labelB?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [expandedA, setExpandedA] = useState(false);
  const [expandedB, setExpandedB] = useState(false);

  const meta = config[change.changeType] || config.MODIFIED;
  const Icon = meta.icon;

  const handleCopy = () => {
    const lines = [
      `Section: ${change.section || "Clause"}`,
      `Change: ${meta.label.toUpperCase()}`,
      change.textA ? `${labelA} (Page ${change.pageNumberA ?? "—"}):\n${change.textA}` : `${labelA}: (Not present)`,
      change.textB ? `${labelB} (Page ${change.pageNumberB ?? "—"}):\n${change.textB}` : `${labelB}: (Not present)`,
    ];
    void navigator.clipboard.writeText(lines.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLongA = (change.textA?.length ?? 0) > 280;
  const isLongB = (change.textB?.length ?? 0) > 280;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-card">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.badgeStyle}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotStyle}`} />
            <Icon size={12} strokeWidth={2.5} />
            {meta.label}
          </span>
          {change.section && (
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              {change.section}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded hover:bg-slate-100"
          title="Copy difference to clipboard"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-600" />
              <span className="text-emerald-600">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy diff</span>
            </>
          )}
        </button>
      </div>

      {/* Side by side comparison (clean typography, no nested boxes) */}
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 md:divide-x md:divide-slate-100">
        {/* Version A (Baseline) */}
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between gap-2 pb-2">
            <span className="text-xs font-semibold text-slate-700 truncate" title={labelA}>
              {labelA} <span className="font-normal text-slate-400 lowercase">(baseline)</span>
            </span>
            {change.pageNumberA && (
              <span className="shrink-0 text-xs text-slate-400 font-normal">
                Page {change.pageNumberA}
              </span>
            )}
          </div>

          {change.textA ? (
            <div>
              <p
                className={`text-sm leading-relaxed text-slate-800 font-sans ${
                  change.changeType === "REMOVED" ? "line-through decoration-rose-400/80 text-rose-900" : ""
                } ${!expandedA && isLongA ? "line-clamp-4" : ""}`}
              >
                {change.textA}
              </p>
              {isLongA && (
                <button
                  onClick={() => setExpandedA(!expandedA)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent-600 hover:text-accent-700"
                >
                  {expandedA ? (
                    <>
                      <ChevronUp size={12} /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={12} /> Show full clause
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-slate-400 mt-1">
              Not present in baseline
            </p>
          )}
        </div>

        {/* Version B (Revised) */}
        <div className="flex flex-col md:pl-6">
          <div className="flex items-baseline justify-between gap-2 pb-2">
            <span className="text-xs font-semibold text-accent-700 truncate" title={labelB}>
              {labelB} <span className="font-normal text-accent-600/80 lowercase">(revised)</span>
            </span>
            {change.pageNumberB && (
              <span className="shrink-0 text-xs text-slate-400 font-normal">
                Page {change.pageNumberB}
              </span>
            )}
          </div>

          {change.textB ? (
            <div>
              <p
                className={`text-sm leading-relaxed text-slate-800 font-sans ${
                  change.changeType === "ADDED" ? "font-medium text-emerald-900" : ""
                } ${!expandedB && isLongB ? "line-clamp-4" : ""}`}
              >
                {change.textB}
              </p>
              {isLongB && (
                <button
                  onClick={() => setExpandedB(!expandedB)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent-600 hover:text-accent-700"
                >
                  {expandedB ? (
                    <>
                      <ChevronUp size={12} /> Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown size={12} /> Show full clause
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs italic text-slate-400 mt-1">
              Omitted in revised
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
