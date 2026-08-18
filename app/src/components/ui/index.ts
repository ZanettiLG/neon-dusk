/** Base UI component library (issue #134). Import as `import { Panel } from "@/components/ui"`. */
export { default as Panel } from "./Panel";
export { default as MetricBar } from "./MetricBar";
export { default as ActionButton } from "./ActionButton";
export { default as EventLog } from "./EventLog";
export { default as StatusBadge } from "./StatusBadge";
export { default as OutcomeChip } from "./OutcomeChip";
export { default as Tab } from "./Tab";
export { default as PhaseStepper } from "./PhaseStepper";

export type { PanelProps } from "./Panel";
export type { MetricBarProps } from "./MetricBar";
export type { ActionButtonProps } from "./ActionButton";
export type { EventLogProps } from "./EventLog";
export type { StatusBadgeProps } from "./StatusBadge";
export type { OutcomeChipProps } from "./OutcomeChip";
export type { TabProps } from "./Tab";
export type { PhaseStepperProps } from "./PhaseStepper";
export type {
  DataStatus,
  ActionStatus,
  Tone,
  Outcome,
  EventSeverity,
  PhaseStep,
  EventLogEntry,
} from "./types";
