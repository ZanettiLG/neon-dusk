import StatusBar from "./StatusBar";
import StreetCredDisplay from "./StreetCredDisplay";

/** Top app bar: brand, connection status, street cred badge, version. */
export default function AppHeader() {
  return (
    <header className="bg-nd-surface border-b border-nd-cyan/20 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <h1 className="font-heading text-nd-cyan text-xl tracking-widest">
          NEON<span className="text-nd-magenta">//</span>DUSK
        </h1>
        <div className="flex items-center gap-4">
          <StreetCredDisplay />
          <StatusBar />
          <span className="text-nd-text-secondary text-xs font-data"> v0.1.0-alpha </span>
        </div>
      </div>
    </header>
  );
}
