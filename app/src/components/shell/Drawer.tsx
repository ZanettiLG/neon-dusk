import { useCallback, useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { SECONDARY_NAV } from "@/lib/nav-config";
import { DRAWER_CONTROL_ID } from "./BottomNav";
import { useAuthStore } from "@/stores/auth";

interface DrawerProps {
  /** Whether the drawer is visible (conditional render happens in App). */
  open: boolean;
  /** Closes the drawer (App-owned state). */
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = 'a[href], button';

/**
 * Mobile side drawer (issue #13) — the 4 secondary destinations (+ Admin,
 * role-gated). Manual focus trap: focuses the first item on open, Tab/Shift+Tab
 * cycle inside the panel, Escape and the overlay close it and return focus to
 * the toggle that opened it. Body scroll is locked while open.
 */
export default function Drawer({ open, onClose }: DrawerProps) {
  const user = useAuthStore((s) => s.user);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Element that had focus when the drawer opened (the "Mais"/"Menu" toggle). */
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  /** Close and return focus to the toggle — keeps keyboard flow intact. */
  const closeAndRestore = useCallback(() => {
    onCloseRef.current();
    openerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestore();
        return;
      }
      if (event.key !== "Tab") return;
      const list = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
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
    };
  }, [open, closeAndRestore]);

  if (!open) return null;

  const items = SECONDARY_NAV.filter(
    (item) => item.to !== "/admin" || user?.role === "admin",
  );

  return (
    <div className="fixed inset-0 z-nd-overlay sm:hidden">
      {/* Overlay — clicks close the drawer (it is not focusable, so the trap
          below still routes Tab between the panel's focusable items). */}
      <div
        className="absolute inset-0 bg-nd-bg/70"
        aria-hidden="true"
        onClick={closeAndRestore}
      />
      <div
        id={DRAWER_CONTROL_ID}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu secundário"
        className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-nd-surface border-r border-nd-cyan/30 shadow-neon-cyan"
      >
        <div className="flex items-center justify-between gap-3 border-b border-nd-cyan/10 pl-4 pr-2 py-2">
          <span className="font-heading text-xs uppercase tracking-widest text-nd-text-secondary">
            Menu
          </span>
          <button
            type="button"
            onClick={closeAndRestore}
            aria-label="Fechar menu"
            className="flex min-h-touch min-w-touch items-center justify-center border border-nd-cyan/20 rounded-terminal text-nd-text-secondary hover:text-nd-cyan transition-colors"
          >
            ✕
          </button>
        </div>
        <ul className="m-0 p-2 list-none">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={closeAndRestore}
                className={({ isActive }) =>
                  `flex min-h-touch items-center border-l-2 px-4 font-heading text-xs uppercase tracking-wider transition-colors ${
                    isActive
                      ? "border-nd-cyan bg-nd-cyan/5 text-nd-cyan"
                      : "border-transparent text-nd-text-secondary hover:text-nd-cyan"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
