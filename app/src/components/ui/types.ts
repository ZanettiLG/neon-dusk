import type { ReactNode } from "react";

/** Shared types for the base UI component library (issue #134). */

/** Generic data-fetch state for containers (Panel, MetricBar, EventLog). */
export type DataStatus = "default" | "loading" | "error" | "empty";

/** Responsive breakpoints used by hideBelow-style column/row visibility. */
export type Breakpoint = "sm" | "md" | "lg";

/** One column of a Table (issue #54). */
export interface TableColumn<T> {
  /** Stable column id (used as React key). */
  key: string;
  /** Header cell content. */
  header: ReactNode;
  /** Cell renderer for one row. */
  cell: (row: T) => ReactNode;
  /** Hide this column below a breakpoint (applies `hidden sm|md|lg:table-cell`). */
  hideBelow?: Breakpoint;
  /** Extra classes applied to both th and td cells. */
  className?: string;
}

/** Interactive action state for buttons. */
export type ActionStatus = "default" | "loading" | "cooldown" | "blocked" | "error";

/** Semantic color tones for badges. */
export type Tone = "neutral" | "success" | "danger" | "gold" | "hack" | "tier";

/** Roll outcome for combat/trampo resolution chips. `null` = not yet resolved. */
export type Outcome = "success" | "failure" | "critical" | null;

/** Severity levels for EventLog entries. */
export type EventSeverity = "info" | "success" | "warning" | "danger";

/** One step of a multi-phase process (trampo loop, install flow, etc.). */
export interface PhaseStep {
  id: string;
  label: string;
}

/** One entry in the EventLog. */
export interface EventLogEntry {
  id: string;
  /** ISO 8601 timestamp; rendered via formatRelativeTime. */
  timestamp: string;
  severity: EventSeverity;
  title: string;
  detail?: string;
  /** When present, renders a per-entry retry button. */
  onRetry?: () => void;
}
