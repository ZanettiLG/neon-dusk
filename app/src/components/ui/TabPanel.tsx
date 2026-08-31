import type { ReactNode } from "react";

export interface TabPanelProps {
  /** Value matched against the selected Tab value (Tabs drives visibility). */
  value: string;
  /** Injected by Tabs: panel id + aria-labelledby + hidden. */
  id?: string;
  "aria-labelledby"?: string;
  hidden?: boolean;
  children: ReactNode;
}

/**
 * Content panel for Tabs (issue #54): role="tabpanel", labelled by the
 * controlling tab, focusable (tabIndex 0) and hidden while inactive. When
 * used inside Tabs, id/aria-labelledby/hidden are injected via cloneElement.
 */
export default function TabPanel({
  id,
  "aria-labelledby": labelledBy,
  hidden,
  children,
}: TabPanelProps) {
  return (
    <div id={id} role="tabpanel" aria-labelledby={labelledBy} hidden={hidden} tabIndex={0}>
      {children}
    </div>
  );
}
