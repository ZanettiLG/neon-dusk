import type { ReactNode } from "react";
import type { DataStatus } from "./types";
import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

export interface PanelProps {
  variant?: "default" | "alert" | "danger" | "highlight";
  status?: DataStatus;
  title?: string;
  accessory?: ReactNode;
  errorMessage?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

/**
 * Frame + marker per variant. Color is never the only channel: every
 * non-default variant carries a glyph next to the title. Frame utilities
 * override the `.card` base (utilities layer beats components layer).
 */
const VARIANTS = {
  default: { frame: "", marker: "", markerClass: "" },
  alert: { frame: "border-nd-gold/40 shadow-neon-gold", marker: "⚠", markerClass: "text-nd-gold" },
  danger: {
    frame: "border-nd-magenta/40 shadow-neon-magenta",
    marker: "!",
    markerClass: "text-nd-magenta",
  },
  highlight: {
    frame: "border-nd-purple/40 shadow-neon-purple",
    marker: "◆",
    markerClass: "text-nd-purple",
  },
} as const;

/**
 * Base content container: `.card` visual with four data states
 * (loading skeleton, error + retry, empty message, default children).
 * The states delegate to LoadingState/ErrorState/EmptyState (issue #54) so
 * the loading/error/empty look stays consistent across the library.
 */
export default function Panel({
  variant = "default",
  status = "default",
  title,
  accessory,
  errorMessage,
  emptyMessage,
  onRetry,
  children,
}: PanelProps) {
  const v = VARIANTS[variant];

  return (
    <section
      className={`card ${v.frame}`}
      role={status === "loading" ? "status" : undefined}
      aria-busy={status === "loading" || undefined}
    >
      {(title || accessory) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-heading text-sm uppercase tracking-widest text-nd-text">
            {v.marker && (
              <span aria-hidden="true" className={`mr-1.5 ${v.markerClass}`}>
                {v.marker}
              </span>
            )}
            {title}
          </h3>
          {accessory}
        </header>
      )}

      {status === "loading" ? (
        <LoadingState skeletonClassName="h-3" />
      ) : status === "error" ? (
        <ErrorState message={errorMessage} onRetry={onRetry} />
      ) : status === "empty" ? (
        <EmptyState message={emptyMessage ?? "Nada por aqui."} />
      ) : (
        children
      )}
    </section>
  );
}
