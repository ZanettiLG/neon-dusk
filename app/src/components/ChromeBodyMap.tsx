import type { InstalledChromeRecord } from "@neon-dusk/shared";
import { CHROME_SLOTS, SLOT_CAPACITY } from "@neon-dusk/shared";
import { CHROME_SLOT_LABELS } from "@/lib/labels";

interface ChromeBodyMapProps {
  installed: InstalledChromeRecord[];
}

/**
 * Body-slot map: all 9 cromo slots (issue #28) with count/capacity and the
 * short names of installed implants. Empty slots render dimmed.
 */
export default function ChromeBodyMap({ installed }: ChromeBodyMapProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {CHROME_SLOTS.map((slot) => {
        const inSlot = installed.filter((rec) => rec.definition.slot === slot);
        const empty = inSlot.length === 0;
        return (
          <div
            key={slot}
            className={`rounded-terminal border p-2 ${
              empty ? "border-nd-cyan/10 opacity-60" : "border-nd-cyan/30"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-data text-nd-micro uppercase tracking-wider text-nd-text-secondary">
                {CHROME_SLOT_LABELS[slot] ?? slot}
              </span>
              <span className="font-data text-nd-micro text-nd-text">
                {inSlot.length}/{SLOT_CAPACITY[slot]}
              </span>
            </div>
            {empty ? (
              <span className="text-nd-text-secondary text-nd-micro font-data">—</span>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {inSlot.map((rec) => (
                  <li key={rec.installedId} className="truncate text-nd-cyan text-nd-label font-data">
                    {rec.definition.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
