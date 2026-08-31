import Skeleton from "./Skeleton";

export interface LoadingStateProps {
  /** Label for the inline variant only (skeleton has no text). */
  label?: string;
  variant?: "skeleton" | "inline";
  /** Number of skeleton lines (skeleton variant only). */
  lines?: number;
  /** Extra classes applied to each skeleton line. */
  skeletonClassName?: string;
  className?: string;
}

/**
 * Shared loading state (issue #54): N pulsing skeleton lines wrapped in a
 * role="status" + aria-busy container, or a compact inline "▌ label..." pulse.
 * Used by Panel, EventLog and Table so the loading look stays consistent.
 */
export default function LoadingState({
  label = "carregando",
  variant = "skeleton",
  lines = 3,
  skeletonClassName,
  className,
}: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div className={className} role="status">
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ {label}...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`} role="status" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={skeletonClassName} />
      ))}
    </div>
  );
}
