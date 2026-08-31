import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";

export interface UseFocusTrapOptions {
  /** Whether the trap is active (dialog open). */
  active: boolean;
  /** Called by Escape/overlay/close — caller owns the open state. */
  onClose: () => void;
  /** The dialog/panel element whose focusables are trapped. */
  containerRef: RefObject<HTMLElement | null>;
  /** Override for the initial focus target (defaults to the first focusable). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** When true, Escape calls onClose and restores focus to the opener. */
  closeOnEscape?: boolean;
}

/** Focusable elements considered by the trap (Drawer's selector + form controls). */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus trap (extracted from Drawer, issue #54): while active, captures
 * the opening element, focuses the initial focus target (or the first
 * focusable), cycles Tab/Shift+Tab inside the container, closes on Escape and
 * restores focus to the opener. Body scroll is locked while active and
 * restored on deactivation or unmount — focus is restored to the opener on
 * ANY deactivation path (programmatic active=false included), not just via
 * closeAndRestore.
 *
 * Returns `closeAndRestore` for callers that need to close from a click
 * handler (close button, overlay) with the same focus-restore behavior.
 */
export function useFocusTrap({
  active,
  onClose,
  containerRef,
  initialFocusRef,
  closeOnEscape = true,
}: UseFocusTrapOptions): { closeAndRestore: () => void } {
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;
  const initialFocusRefValue = useRef(initialFocusRef);
  initialFocusRefValue.current = initialFocusRef;

  /** Close and return focus to the opener — keeps keyboard flow intact. */
  const closeAndRestore = useCallback(() => {
    onCloseRef.current();
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!active) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    const initial = initialFocusRefValue.current?.current;
    const target = initial ?? container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    target?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (closeOnEscapeRef.current) {
          event.preventDefault();
          closeAndRestore();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const list = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!list || list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the opener on any deactivation path — including
      // programmatic close via active=false — not just closeAndRestore.
      // Idempotent: when closeAndRestore already ran, this refocuses the
      // same element (a no-op for the user); on unmount of a detached
      // opener, focusing a disconnected node is also a safe no-op.
      openerRef.current?.focus();
    };
  }, [active, closeAndRestore, containerRef]);

  return { closeAndRestore };
}
