import { formatRelativeTime } from "@/lib/format";
import Skeleton from "./Skeleton";
import type { DataStatus, EventLogEntry, EventSeverity } from "./types";

export interface EventLogProps {
  events?: EventLogEntry[];
  status?: DataStatus;
  emptyMessage?: string;
  /** Retry button shown in the error banner. */
  onRetryAll?: () => void;
  /** CSS max-height for the scrollable list (e.g. "16rem"). */
  maxHeight?: string;
}

/** Severity → glyph + token classes. Color is never the only channel: glyph included. */
const SEVERITY_STYLES: Record<
  EventSeverity,
  { glyph: string; text: string; border: string }
> = {
  info: { glyph: "▌", text: "text-nd-cyan", border: "border-l-nd-cyan/50" },
  success: { glyph: "✓", text: "text-nd-green", border: "border-l-nd-green/50" },
  warning: { glyph: "⚠", text: "text-nd-gold", border: "border-l-nd-gold/50" },
  danger: { glyph: "✗", text: "text-nd-magenta", border: "border-l-nd-magenta/50" },
};

/**
 * Chronological event feed with per-severity glyphs and relative timestamps.
 * Announces updates politely (aria-live) and supports per-entry retries.
 */
export default function EventLog({
  events = [],
  status = "default",
  emptyMessage,
  onRetryAll,
  maxHeight,
}: EventLogProps) {
  if (status === "loading") {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="card border-nd-magenta/40 shadow-neon-magenta flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-nd-magenta text-sm font-data">✗ Falha ao carregar eventos.</p>
        {onRetryAll && (
          <button type="button" className="btn-neon text-xs px-3 py-1" onClick={onRetryAll}>
            Tentar de novo
          </button>
        )}
      </div>
    );
  }

  if (status === "empty" || events.length === 0) {
    return (
      <p className="text-nd-text-secondary text-sm font-data">
        {emptyMessage ?? "Sem eventos registrados."}
      </p>
    );
  }

  return (
    <ul
      className="space-y-1.5"
      aria-live="polite"
      style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
    >
      {events.map((e) => {
        const s = SEVERITY_STYLES[e.severity];
        return (
          <li key={e.id} className={`card py-2 px-3 border-l-2 ${s.border}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-xs font-data ${s.text}`}>
                  <span aria-hidden="true">{s.glyph}</span> {e.title}
                </p>
                {e.detail && (
                  <p className="text-nd-text-secondary text-xs mt-0.5">{e.detail}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] font-data uppercase tracking-wider text-nd-text-secondary">
                  {formatRelativeTime(e.timestamp)}
                </span>
                {e.onRetry && (
                  <button type="button" className="btn-neon text-[10px] px-2 py-1" onClick={e.onRetry}>
                    Tentar de novo
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
