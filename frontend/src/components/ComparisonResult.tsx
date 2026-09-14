import { useState } from "react";
import { Plus, Minus, Pencil, MapPin, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
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

      {/* Side by side comparison */}
      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Version A card */}
        <div className="flex flex-col rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/60">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {labelA} <span className="text-slate-400 font-normal lowercase">(baseline)</span>
            </span>
            {change.pageNumberA && (
              <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                <MapPin size={10} /> p. {change.pageNumberA}
              </span>
            )}
          </div>

          {change.textA ? (
            <div>
              <div
                className={`rounded-md border border-rose-150 bg-rose-50/60 p-3 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans ${
                  change.changeType === "REMOVED" ? "line-through decoration-rose-400/80 text-rose-950" : ""
                } ${!expandedA && isLongA ? "line-clamp-4" : ""}`}
              >
                {change.textA}
              </div>
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
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 p-4 text-xs italic text-slate-400">
              Not present in {labelA} (New clause introduced)
            </div>
          )}
        </div>

        {/* Version B card */}
        <div className="flex flex-col rounded-lg border border-slate-200/80 bg-slate-50/50 p-3.5">
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/60">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              {labelB} <span className="text-accent-600 font-normal lowercase">(revised)</span>
            </span>
            {change.pageNumberB && (
              <span className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                <MapPin size={10} /> p. {change.pageNumberB}
              </span>
            )}
          </div>

          {change.textB ? (
            <div>
              <div
                className={`rounded-md border border-emerald-150 bg-emerald-50/60 p-3 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans ${
                  change.changeType === "ADDED" ? "text-emerald-950 font-medium" : ""
                } ${!expandedB && isLongB ? "line-clamp-4" : ""}`}
              >
                {change.textB}
              </div>
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
            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 p-4 text-xs italic text-slate-400">
              Omitted in {labelB} (Clause removed)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
