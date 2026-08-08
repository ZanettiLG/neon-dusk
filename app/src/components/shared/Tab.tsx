import type { ReactNode } from "react";

/**
 * Reusable tab button used across views (Chrome, PvP, etc.).
 */
export default function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`font-data text-[11px] uppercase tracking-widest border rounded-terminal px-3 py-1 transition-colors ${
        active
          ? "border-nd-cyan text-nd-cyan bg-nd-cyan/10"
          : "border-nd-cyan/20 text-nd-text-secondary hover:border-nd-cyan/50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
