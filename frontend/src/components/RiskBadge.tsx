import type { RiskSeverity } from "../types";

const styles: Record<RiskSeverity, string> = {
  Critical: "bg-risk-critical/10 text-risk-critical border-risk-critical/20",
  High: "bg-risk-high/10 text-risk-high border-risk-high/20",
  Medium: "bg-risk-medium/10 text-risk-medium border-risk-medium/20",
  Low: "bg-risk-low/10 text-risk-low border-risk-low/20",
};

export default function RiskBadge({ severity }: { severity: RiskSeverity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}
