import type { ReactNode } from "react";
import Skeleton from "./Skeleton";
import type { DataStatus } from "./types";

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
  danger: { frame: "border-nd-magenta/40 shadow-neon-magenta", marker: "!", markerClass: "text-nd-magenta" },
  highlight: { frame: "border-nd-purple/40 shadow-neon-purple", marker: "◆", markerClass: "text-nd-purple" },
} as const;

/**
 * Base content container: `.card` visual with four data states
 * (loading skeleton, error + retry, empty message, default children).
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
    <section className={`card ${v.frame}`} aria-busy={status === "loading" || undefined}>
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
        <div className="space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-nd-magenta text-sm font-data">✗ {errorMessage ?? "Erro ao carregar."}</p>
          {onRetry && (
            <button type="button" className="btn-neon text-xs px-3 py-1" onClick={onRetry}>
              Tentar de novo
            </button>
          )}
        </div>
      ) : status === "empty" ? (
        <p className="text-nd-text-secondary text-sm font-data">
          {emptyMessage ?? "Nada por aqui."}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
