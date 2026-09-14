import { useState } from "react";
import { MapPin, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { Clause } from "../types";

const categoryStyles: Record<string, string> = {
  Payment: "bg-accent-50 text-accent-700 border-accent-100",
  Confidentiality: "bg-purple-50 text-purple-700 border-purple-100",
  Termination: "bg-risk-high/10 text-risk-high border-risk-high/20",
  "Intellectual Property": "bg-amber-50 text-amber-800 border-amber-100",
  Liability: "bg-risk-high/10 text-risk-high border-risk-high/20",
  Arbitration: "bg-slate-100 text-slate-700 border-slate-200",
  Warranty: "bg-teal-50 text-teal-700 border-teal-100",
  Indemnification: "bg-risk-medium/10 text-risk-medium border-risk-medium/20",
  "Non-compete": "bg-rose-50 text-rose-700 border-rose-100",
  "Non-solicitation": "bg-rose-50 text-rose-700 border-rose-100",
  "Governing Law": "bg-indigo-50 text-indigo-700 border-indigo-100",
  Other: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function ClauseCard({ clause }: { clause: Clause }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const style = categoryStyles[clause.category] ?? categoryStyles.Other;

  const isLong = clause.text.length > 280;
  const displayedText = isLong && !expanded ? clause.text.slice(0, 280) + "…" : clause.text;

  const handleCopy = () => {
    navigator.clipboard.writeText(clause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>
            {clause.category}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">
              {Math.round(clause.confidence * 100)}% match
            </span>
            <button
              onClick={handleCopy}
              className="rounded p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Copy clause text"
            >
              {copied ? <Check size={13} className="text-risk-low" /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {clause.heading && (
          <h4 className="font-semibold text-sm text-ink-900 mb-1.5">{clause.heading}</h4>
        )}

        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
          {displayedText}
        </p>

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700"
          >
            {expanded ? (
              <>
                Show less <ChevronUp size={12} />
              </>
            ) : (
              <>
                Read full clause <ChevronDown size={12} />
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
        <div className="flex items-center gap-1 text-slate-600 font-medium">
          <MapPin size={11} className="text-accent-600" />
          Page {clause.pageNumber ?? 1}
        </div>
        <span className="text-[11px] text-slate-400">Clause #{clause.chunkIndex + 1}</span>
      </div>
    </div>
  );
}
