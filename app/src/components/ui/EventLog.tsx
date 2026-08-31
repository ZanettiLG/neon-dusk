import { formatRelativeTime } from "@/lib/format";
import type { DataStatus, EventLogEntry, EventSeverity } from "./types";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

export interface EventLogProps {
  events?: EventLogEntry[];
  status?: DataStatus;
  emptyMessage?: string;
  /** Overrides the error banner message (defaults to "Erro ao carregar."). */
  errorMessage?: string;
  /** Retry button shown in the error banner. */
  onRetryAll?: () => void;
  /** CSS max-height for the scrollable list (e.g. "16rem"). */
  maxHeight?: string;
}

/** Severity → glyph + token classes. Color is never the only channel: glyph included. */
const SEVERITY_STYLES: Record<EventSeverity, { glyph: string; text: string; border: string }> = {
  info: { glyph: "▌", text: "text-nd-cyan", border: "border-l-nd-cyan/50" },
  success: { glyph: "✓", text: "text-nd-green", border: "border-l-nd-green/50" },
  warning: { glyph: "⚠", text: "text-nd-gold", border: "border-l-nd-gold/50" },
  danger: { glyph: "✗", text: "text-nd-magenta", border: "border-l-nd-magenta/50" },
};

/**
 * Chronological event feed with per-severity glyphs and relative timestamps.
 * Announces updates politely (aria-live) and supports per-entry retries.
 * Loading/error/empty states delegate to LoadingState/ErrorState/EmptyState
 * (issue #54) so the data-state look stays consistent across the library.
 */
export default function EventLog({
  events = [],
  status = "default",
  emptyMessage,
  errorMessage,
  onRetryAll,
  maxHeight,
}: EventLogProps) {
  if (status === "loading") {
    return <LoadingState lines={3} skeletonClassName="h-10 w-full" />;
  }

  if (status === "error") {
    return (
      <div className="card border-nd-magenta/40 shadow-neon-magenta">
        <ErrorState message={errorMessage} onRetry={onRetryAll} />
      </div>
    );
  }

  if (status === "empty" || events.length === 0) {
    return <EmptyState message={emptyMessage ?? "Sem eventos registrados."} />;
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
                {e.detail && <p className="text-nd-text-secondary text-xs mt-0.5">{e.detail}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-nd-micro font-data uppercase tracking-wider text-nd-text-secondary">
                  {formatRelativeTime(e.timestamp)}
                </span>
                {e.onRetry && (
                  <button
                    type="button"
                    className="btn-neon text-nd-micro px-2 py-1"
                    onClick={e.onRetry}
                  >
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
