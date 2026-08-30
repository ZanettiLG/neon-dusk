// Single source of truth for app-shell navigation (issue #13).
// Consumed by AppHeader (desktop nav), BottomNav (mobile primary) and
// Drawer (mobile secondary) so route labels never drift between shells.

export interface NavItem {
  /** Internal route path (react-router). */
  to: string;
  /** User-facing label (pt-BR). */
  label: string;
}

/** Primary destinations — bottom nav on mobile, first group on desktop. */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Painel" },
  { to: "/gigs", label: "Trampos" },
  { to: "/saideira", label: "Saideira" },
  { to: "/chrome", label: "Cromo" },
  { to: "/pvp", label: "PvP" },
];

/**
 * Secondary destinations — drawer on mobile, second group on desktop.
 * `/admin` is conditional on the user role (filtered by consumers).
 */
export const SECONDARY_NAV: NavItem[] = [
  { to: "/vendors", label: "Vendedores" },
  { to: "/economy", label: "Economia" },
  { to: "/crews", label: "Bondes" },
  { to: "/humanity", label: "Humanidade" },
  { to: "/admin", label: "Admin" },
];

/** `/admin` — the only role-gated nav item. */
export const ADMIN_NAV_TO = "/admin";

/** Desktop header nav = primary + secondary (role-filtered by the consumer). */
export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...SECONDARY_NAV];
