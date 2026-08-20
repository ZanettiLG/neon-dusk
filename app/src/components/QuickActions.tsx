import { Link } from "react-router-dom";

/**
 * Compact row of 1-tap shortcuts to the main corredor loops.
 */
export default function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link to="/gigs" className="btn-neon text-xs px-3 py-2">
        Trampos
      </Link>
      <Link to="/saideira" className="btn-neon text-xs px-3 py-2">
        Saideira
      </Link>
      <Link to="/chrome" className="btn-neon text-xs px-3 py-2">
        Cromo
      </Link>
      <Link to="/pvp" className="btn-neon text-xs px-3 py-2">
        PvP
      </Link>
    </div>
  );
}
