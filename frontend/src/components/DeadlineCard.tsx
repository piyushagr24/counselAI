import { Calendar, MapPin } from "lucide-react";
import type { DateItem } from "../types";

export default function DeadlineCard({ item }: { item: DateItem }) {
  return (
    <div className="flex items-start gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
        <Calendar size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{item.description}</p>
        {item.dateOrTimeframe && <p className="text-sm text-slate-600">{item.dateOrTimeframe}</p>}
        {item.pageNumber && (
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <MapPin size={11} />
            Page {item.pageNumber}
          </div>
        )}
      </div>
    </div>
  );
}
