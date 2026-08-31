import { useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Accessible-name fallback when no title is shown — the dialog must
   *  always have a name (aria-label), mirroring the Drawer pattern. */
  ariaLabel?: string;
  children: ReactNode;
  /** Optional footer bar under the content. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Clicking the dark overlay closes (and restores focus). */
  closeOnOverlay?: boolean;
  /** Escape closes (and restores focus). */
  closeOnEscape?: boolean;
  /** Element to focus on open; defaults to the first focusable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

/**
 * Accessible modal dialog (issue #54): focus trap (useFocusTrap), labelled by
 * the title (useId) or the ariaLabel fallback, overlay click and Escape to
 * close with focus restored to the opener, sm/md/lg widths. Returns null
 * while closed — no DOM, no trap.
 */
export default function Modal({
  open,
  onClose,
  title,
  ariaLabel,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  closeOnEscape = true,
  initialFocusRef,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { closeAndRestore } = useFocusTrap({
    active: open,
    onClose,
    containerRef: panelRef,
    initialFocusRef,
    closeOnEscape,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-nd-overlay flex items-center justify-center p-4">
      {/* Overlay — clicks close the modal (aria-hidden, not focusable, so the
          trap still routes Tab between the panel's focusables). */}
      <div
        className="absolute inset-0 bg-nd-bg/70"
        aria-hidden="true"
        onClick={closeOnOverlay ? closeAndRestore : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        className={`relative w-full bg-nd-surface border border-nd-cyan/30 shadow-neon-cyan rounded-terminal ${SIZE_CLASSES[size]}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-nd-cyan/10 px-4 py-2">
          {title ? (
            <h2
              id={titleId}
              className="font-heading text-sm uppercase tracking-widest text-nd-text"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={closeAndRestore}
            aria-label="Fechar"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-terminal border border-nd-cyan/20 text-nd-text-secondary transition-colors hover:text-nd-cyan"
          >
            ✕
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="border-t border-nd-cyan/10 px-4 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
