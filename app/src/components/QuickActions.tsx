import { Link } from "react-router-dom";

const ACTIONS = [
  { to: "/gigs", label: "Trampos" },
  { to: "/saideira", label: "Saideira" },
  { to: "/chrome", label: "Cromo" },
  { to: "/pvp", label: "PvP" },
  { to: "/vendors", label: "Vendedores" },
] as const;

/**
 * Compact grid of 1-tap shortcuts to the main corredor loops (issue #56).
 * Token-based chips (`chip-tap` enforces the 44px touch target on coarse
 * pointers) — no legacy hand-rolled button styling.
 */
export default function QuickActions() {
  return (
    <nav aria-label="Ações rápidas" className="grid grid-cols-2 gap-2">
      {ACTIONS.map((action) => (
        <Link
          key={action.to}
          to={action.to}
          className="chip-tap btn-neon w-full justify-between text-xs"
        >
          <span>{action.label}</span>
          <span aria-hidden="true">▸</span>
        </Link>
      ))}
    </nav>
  );
}
