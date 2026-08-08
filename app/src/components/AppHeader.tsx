import { Link } from "react-router-dom";
import StatusBar from "./StatusBar";
import StreetCredDisplay from "./StreetCredDisplay";
import { useAuthStore } from "@/stores/auth";

/** Top app bar: brand, connection status, street cred badge, version. */
export default function AppHeader() {
  const character = useAuthStore((s) => s.character);

  return (
    <header className="bg-nd-surface border-b border-nd-cyan/20 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <h1 className="font-heading text-nd-cyan text-xl tracking-widest">
            NEON<span className="text-nd-magenta">//</span>DUSK
          </h1>
          {character && (
            <nav className="hidden sm:flex items-center gap-4">
              <Link to="/dashboard" className="nav-link">Painel</Link>
              <Link to="/gigs" className="nav-link">Gigs</Link>
              <Link to="/saideira" className="nav-link">Saideira</Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          <StreetCredDisplay />
          <StatusBar />
          <span className="text-nd-text-secondary text-xs font-data"> v0.1.0-alpha </span>
        </div>
      </div>
    </header>
  );
}
