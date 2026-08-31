import { Children, cloneElement, isValidElement, useCallback, useId, useState } from "react";
import type { KeyboardEvent, ReactElement, ReactNode } from "react";
import Tab from "./Tab";
import type { TabProps } from "./Tab";
import TabPanel from "./TabPanel";
import type { TabPanelProps } from "./TabPanel";

export interface TabsProps {
  /** Initial value (uncontrolled mode). */
  defaultValue?: string;
  /** Controlled value — the parent owns selection. */
  value?: string;
  /** Called on selection (click or arrow/Home/End navigation). */
  onValueChange?: (value: string) => void;
  /** Accessible name for the tablist (required). */
  ariaLabel: string;
  children: ReactNode;
}

interface TabMeta {
  value: string;
  disabled: boolean;
  index: number;
  element: ReactElement<TabProps>;
  id: string;
  panelId: string;
}

function isTabChild(child: ReactNode): child is ReactElement<TabProps> {
  return isValidElement(child) && child.type === Tab;
}

function isPanelChild(child: ReactNode): child is ReactElement<TabPanelProps> {
  return isValidElement(child) && child.type === TabPanel;
}

/**
 * WAI-ARIA tabs (issue #54): Tab children get selection state, ids and
 * aria-controls injected; TabPanel children get hidden/aria-labelledby.
 * Roving tabindex (selected = 0, rest -1) with ArrowLeft/ArrowRight and
 * Home/End navigation; disabled tabs are skipped by click and keyboard.
 */
export default function Tabs({
  defaultValue,
  value,
  onValueChange,
  ariaLabel,
  children,
}: TabsProps) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : internal;

  const allChildren = Children.toArray(children);
  const tabs: TabMeta[] = allChildren.filter(isTabChild).map((el, i) => {
    const tabValue = el.props.value ?? String(i);
    return {
      value: tabValue,
      disabled: el.props.state === "disabled",
      index: i,
      element: el,
      id: `${baseId}-tab-${i}`,
      panelId: `${baseId}-panel-${i}`,
    };
  });
  const panels = allChildren.filter(isPanelChild);

  const selectValue = useCallback(
    (next: string) => {
      if (isControlled) {
        onValueChange?.(next);
      } else {
        setInternal(next);
      }
    },
    [isControlled, onValueChange],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") {
      return;
    }
    const enabled = tabs.filter((t) => !t.disabled);
    if (enabled.length === 0) return;
    event.preventDefault();

    let target: TabMeta;
    if (key === "Home") {
      target = enabled[0];
    } else if (key === "End") {
      target = enabled[enabled.length - 1];
    } else {
      const focusedIndex = tabs.findIndex(
        (t) => document.getElementById(t.id) === document.activeElement,
      );
      const focusedPos = enabled.findIndex((t) => t.index === focusedIndex);
      const basePos =
        focusedPos >= 0
          ? focusedPos
          : Math.max(
              0,
              enabled.findIndex((t) => t.value === activeValue),
            );
      const delta = key === "ArrowRight" ? 1 : -1;
      target = enabled[(basePos + delta + enabled.length) % enabled.length];
    }
    selectValue(target.value);
    document.getElementById(target.id)?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className="flex flex-wrap gap-1"
      >
        {tabs.map((t) =>
          cloneElement(t.element, {
            state: t.disabled ? "disabled" : t.value === activeValue ? "active" : "inactive",
            id: t.id,
            "aria-controls": t.panelId,
            tabIndex: t.value === activeValue ? 0 : -1,
            onClick: () => {
              selectValue(t.value);
              t.element.props.onClick?.();
            },
          }),
        )}
      </div>
      {panels.map((panel, i) => {
        const panelValue = String(panel.props.value);
        const tab = tabs.find((t) => t.value === panelValue);
        const panelId = tab?.panelId ?? `${baseId}-panel-${i}`;
        return cloneElement(panel, {
          id: panelId,
          "aria-labelledby": tab?.id,
          hidden: panelValue !== activeValue,
        });
      })}
    </>
  );
}
