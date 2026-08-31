import { Link } from "react-router-dom";
import StatusBar from "./StatusBar";
import { useAuthStore } from "@/stores/auth";
import { PRIMARY_NAV, SECONDARY_NAV, ADMIN_NAV_TO } from "@/lib/nav-config";
import { DRAWER_CONTROL_ID } from "@/components/shell/BottomNav";

interface AppHeaderProps {
  /** Whether the secondary drawer is open (drives the mobile toggle). */
  drawerOpen?: boolean;
  /** Opens the secondary drawer (mobile). */
  onOpenDrawer?: () => void;
}

/**
 * Top app bar: brand, desktop nav (primary + secondary from nav-config),
 * mobile drawer toggle, connection status and version. Moral moved to the
 * persistent HUD (issue #13).
 */
export default function AppHeader({ drawerOpen = false, onOpenDrawer }: AppHeaderProps) {
  const character = useAuthStore((s) => s.character);
  const user = useAuthStore((s) => s.user);
  const hasCharacter = !!character;
  const isAdmin = user?.role === "admin";

  // Character-only items (primary + non-admin secondary); Admin is role-only,
  // reachable even without a character.
  const navItems = [
    ...(hasCharacter ? PRIMARY_NAV : []),
    ...(hasCharacter
      ? SECONDARY_NAV.filter((item) => item.to !== ADMIN_NAV_TO)
      : []),
    ...(isAdmin
      ? SECONDARY_NAV.filter((item) => item.to === ADMIN_NAV_TO)
      : []),
  ];

  return (
    <header className="bg-nd-surface border-b border-nd-cyan/20 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <h1 className="font-heading text-nd-cyan text-xl tracking-widest">
            NEON<span className="text-nd-magenta">//</span>DUSK
          </h1>
          {(hasCharacter || isAdmin) && (
            <nav className="hidden sm:flex items-center gap-4">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`nav-link ${item.to === ADMIN_NAV_TO ? "text-nd-gold" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          {hasCharacter && (
            <button
              type="button"
              className="sm:hidden flex min-h-touch items-center gap-2 border border-nd-cyan/20 rounded-terminal px-3 font-heading text-xs uppercase tracking-wider text-nd-text-secondary hover:text-nd-cyan transition-colors"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-controls={DRAWER_CONTROL_ID}
              onClick={onOpenDrawer}
            >
              Menu
            </button>
          )}
          <StatusBar />
          <span className="text-nd-text-secondary text-xs font-data"> v0.1.0-alpha </span>
        </div>
      </div>
    </header>
  );
}
