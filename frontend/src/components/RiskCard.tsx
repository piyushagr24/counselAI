import { useState } from "react";
import { MapPin, ShieldAlert, Lightbulb, Copy, Check } from "lucide-react";
import type { RiskFinding } from "../types";
import RiskBadge from "./RiskBadge";

export default function RiskCard({ risk }: { risk: RiskFinding }) {
  const [copied, setCopied] = useState(false);

  const handleCopyEvidence = () => {
    navigator.clipboard.writeText(risk.evidence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const severityBorder =
    risk.severity === "Critical"
      ? "border-l-4 border-l-red-600"
      : risk.severity === "High"
      ? "border-l-4 border-l-risk-high"
      : risk.severity === "Medium"
      ? "border-l-4 border-l-risk-medium"
      : "border-l-4 border-l-risk-low";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all ${severityBorder}`}>
      {/* Top row with Category & Severity */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {risk.category && (
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {risk.category}
            </span>
          )}
          <h3 className="font-semibold text-ink-900 text-base">{risk.title}</h3>
        </div>
        <RiskBadge severity={risk.severity} />
      </div>

      {/* Risk Explanation */}
      <p className="mt-2.5 text-sm text-slate-700 leading-relaxed">{risk.explanation}</p>

      {/* Contract Evidence Quote */}
      {risk.evidence && (
        <div className="mt-3.5 relative rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 group">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Document Excerpt
            </span>
            <button
              onClick={handleCopyEvidence}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
              title="Copy quote"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-risk-low" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy Quote
                </>
              )}
            </button>
          </div>
          <blockquote className="text-xs italic text-slate-600 leading-relaxed border-l-2 border-slate-300 pl-3">
            "{risk.evidence}"
          </blockquote>
        </div>
      )}

      {/* Mitigation Recommendation Callout */}
      {risk.recommendation && (
        <div className="mt-3 rounded-xl border border-accent-100 bg-accent-50/50 p-3.5">
          <div className="flex items-center gap-1.5 text-accent-800 text-xs font-semibold">
            <Lightbulb size={14} className="text-accent-600" />
            <span>Recommended Mitigation Action</span>
          </div>
          <p className="mt-1 text-xs text-slate-700 leading-relaxed">{risk.recommendation}</p>
        </div>
      )}

      {/* Location Footer */}
      {(risk.pageNumber || risk.section) && (
        <div className="mt-3.5 flex items-center gap-1.5 text-xs text-slate-400 border-t border-slate-100 pt-2.5">
          <MapPin size={12} className="text-slate-400" />
          {risk.section && <span className="font-medium text-slate-600">{risk.section}</span>}
          {risk.section && risk.pageNumber && <span>·</span>}
          {risk.pageNumber && <span>Page {risk.pageNumber}</span>}
        </div>
      )}
    </div>
  );
}
