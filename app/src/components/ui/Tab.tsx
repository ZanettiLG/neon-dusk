import { useId } from "react";
import type { ReactNode } from "react";

export interface TabProps {
  /** Value matched by Tabs (selection + roving tabindex). Optional standalone. */
  value?: string;
  state?: "active" | "inactive" | "disabled";
  /** Tooltip + assistive-tech description for disabled tabs. */
  disabledReason?: string;
  onClick?: () => void;
  /** Injected by Tabs: WAI-ARIA tab/panel wiring + roving tabindex. */
  id?: string;
  "aria-controls"?: string;
  tabIndex?: number;
  children: ReactNode;
}

/**
 * Tab button for view-level switching (Cromo, PvP, ...). Rendered inside a
 * container with role="tablist". 44px touch target on coarse pointers (.chip-tap).
 * `disabledReason` is rendered as sr-only text referenced by aria-describedby
 * (announced by AT and available to touch users via accessibility tree), with
 * `title` kept for pointer hover. Inside Tabs, selection state, ids and
 * tabindex are injected via cloneElement.
 */
export default function Tab({
  state = "inactive",
  disabledReason,
  onClick,
  id,
  "aria-controls": ariaControls,
  tabIndex,
  children,
}: TabProps) {
  const isDisabled = state === "disabled";
  const reasonId = useId();

  return (
    <>
      <button
        type="button"
        role="tab"
        id={id}
        aria-selected={state === "active"}
        aria-controls={ariaControls}
        aria-disabled={isDisabled || undefined}
        disabled={isDisabled}
        tabIndex={tabIndex}
        title={isDisabled ? disabledReason : undefined}
        aria-describedby={isDisabled && disabledReason ? reasonId : undefined}
        onClick={onClick}
        className={`chip-tap font-data text-nd-label uppercase tracking-widest border rounded-terminal px-3 py-1 transition-colors ${
          state === "active"
            ? "border-nd-cyan text-nd-cyan bg-nd-cyan/10"
            : state === "disabled"
              ? "border-nd-cyan/20 text-nd-text-secondary opacity-30 cursor-not-allowed"
              : "border-nd-cyan/20 text-nd-text-secondary hover:border-nd-cyan/50"
        }`}
      >
        {children}
      </button>
      {isDisabled && disabledReason && (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      )}
    </>
  );
}
