import Button from "./Button";

export interface ErrorStateProps {
  /** Defaults to "Erro ao carregar." — overridable by callers. */
  message?: string;
  /** When present, renders a small retry button. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * Shared error state (issue #54): role="alert" banner with the message in
 * danger magenta and an optional retry button. Used by Panel, EventLog and
 * Table so the error look stays consistent.
 */
export default function ErrorState({
  message = "Erro ao carregar.",
  onRetry,
  retryLabel = "Tentar de novo",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}
    >
      <p className="text-nd-magenta text-sm font-data">✗ {message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
