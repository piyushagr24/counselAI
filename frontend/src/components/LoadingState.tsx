import { Loader2, AlertTriangle } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-slate-400">
      <Loader2 size={22} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't complete this request. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-risk-high/20 bg-risk-high/5 px-6 py-10 text-center">
      <AlertTriangle size={22} className="text-risk-high" />
      <h3 className="mt-3 font-medium text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-ink-900 hover:bg-slate-50"
        >
          Try again
        </button>
      )}
    </div>
  );
}
