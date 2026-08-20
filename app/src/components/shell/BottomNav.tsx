import { NavLink } from "react-router-dom";
import { PRIMARY_NAV } from "@/lib/nav-config";

export const DRAWER_CONTROL_ID = "secondary-nav-drawer";

interface BottomNavProps {
  /** Whether the secondary drawer is open (drives aria-expanded). */
  drawerOpen: boolean;
  /** Opens the secondary drawer. */
  onOpenDrawer: () => void;
}

/**
 * Mobile bottom navigation (issue #13): the 5 primary destinations plus the
 * "Mais" button that opens the secondary drawer. Fixed to the viewport bottom,
 * hidden from `sm:` up (desktop uses the header nav). Every target is ≥44px
 * and keeps a text label (never icon-only). NavLink sets aria-current=page.
 */
export default function BottomNav({ drawerOpen, onOpenDrawer }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 sm:hidden bg-nd-surface border-t border-nd-cyan/20 pb-safe"
    >
      <ul className="grid grid-cols-6 m-0 p-0 list-none">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-[44px] items-center justify-center border-t text-[10px] font-heading uppercase tracking-wider transition-colors ${
                  isActive
                    ? "border-nd-cyan text-nd-cyan bg-nd-cyan/5"
                    : "border-transparent text-nd-text-secondary hover:text-nd-cyan"
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-controls={DRAWER_CONTROL_ID}
            onClick={onOpenDrawer}
            className="flex min-h-[44px] w-full items-center justify-center border-t border-transparent text-[10px] font-heading uppercase tracking-wider text-nd-text-secondary hover:text-nd-cyan transition-colors"
          >
            Mais
          </button>
        </li>
      </ul>
    </nav>
  );
}
