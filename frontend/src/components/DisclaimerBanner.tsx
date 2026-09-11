import { Info } from "lucide-react";

export default function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-card border border-amber-200 bg-amber-50 text-amber-800 ${
        compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
      }`}
    >
      <Info size={compact ? 14 : 16} className="mt-0.5 shrink-0" />
      <p>
        Counsel provides AI-generated analysis for informational purposes only and does not
        constitute legal advice. Always consult a qualified lawyer before making decisions based
        on this output.
      </p>
    </div>
  );
}
