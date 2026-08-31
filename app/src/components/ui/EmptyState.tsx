import type { ReactNode } from "react";

export interface EmptyStateProps {
  message: string;
  /** Decorative glyph (aria-hidden); defaults to the empty-set symbol. */
  glyph?: string;
  /** Optional extra node (e.g. a call-to-action button). */
  action?: ReactNode;
  className?: string;
}

/**
 * Shared empty state (issue #54): muted data-font line with a decorative
 * glyph. Used by Panel, EventLog and Table so the look stays consistent.
 */
export default function EmptyState({ message, glyph = "∅", action, className }: EmptyStateProps) {
  return (
    <div className={`text-nd-text-secondary font-data text-sm ${className ?? ""}`}>
      <span aria-hidden="true">{glyph}</span> {message}
      {action}
    </div>
  );
}
