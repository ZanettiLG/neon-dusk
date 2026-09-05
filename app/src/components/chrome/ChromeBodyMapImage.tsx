import type { CSSProperties } from "react";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";
import { SLOT_CAPACITY } from "@neon-dusk/shared";
import { CHROME_SLOT_LABELS } from "@/lib/labels";
import { SLOT_LABEL_POS } from "@/lib/chrome-body-map";
import bodyMapUrl from "@/assets/chrome/body-map.png";

// Body map of the 9 cromo slots (issues #94 → #188): the artwork is an
// AI-generated PNG (512×1024, noir silhouette) rendered decoratively at 55%
// width; the interactive layer is 9 label buttons flanking the figure in two
// side columns (labels-only redesign — the body itself is never a click
// target, per the approved clinic-inventory reference). Desktop (≥1024px): the label
// wrapper vanishes (lg:contents) and each button positions absolutely at its
// SLOT_LABEL_POS y anchor, column via left/right. Mobile (<1024px): the same
// DOM flows as a 2-column label grid under the figure — single DOM, no
// duplicates. Same a11y contract as before: group role, per-slot buttons
// with occupancy aria-labels, Enter/Space, full slot = tabIndex −1 + guard.
// Geometry is inline style / CSS var on purpose: percentage classes
// (w-[55%]) are banned in core by the token-usage guard (issue #53).

interface ChromeBodyMapImageProps {
  installed: InstalledChromeRecord[];
  selectedSlot: ChromeSlot | null;
  onSelectSlot: (slot: ChromeSlot) => void;
}

/** Label state classes (design #188): default cyan/70, hover cyan, selected
 * gold + pulse, full magenta/60 + cursor-not-allowed. */
function labelClass(state: { selected: boolean; full: boolean }): string {
  if (state.selected) return "text-nd-gold animate-pulse-neon";
  if (state.full) return "text-nd-magenta/60 cursor-not-allowed";
  return "text-nd-cyan/70 hover:text-nd-cyan cursor-pointer";
}

/**
 * Interactive body map (issues #10 + #28 + #94 + #188). Each slot label is a
 * keyboard-focusable button (Enter/Space) announcing its occupancy; the
 * status line ("N/M · CHEIO") is the redundant text channel for full slots.
 * Selection opens the surgery picker modal via onSelectSlot.
 */
export default function ChromeBodyMapImage({
  installed,
  selectedSlot,
  onSelectSlot,
}: ChromeBodyMapImageProps) {
  const countFor = (slot: ChromeSlot) =>
    installed.filter((rec) => rec.definition.slot === slot).length;

  return (
    <div
      role="group"
      aria-label="Mapa corporal de cromo"
      className="relative flex flex-col items-center gap-3 lg:block"
      style={{ "--label-w": "34%" } as CSSProperties}
    >
      {/* Artwork: decorative — the information lives in the labels' text + aria. */}
      <img
        src={bodyMapUrl}
        alt=""
        aria-hidden="true"
        className="mx-auto block h-auto"
        style={{ width: "55%" }}
        draggable={false}
      />

      {/* Mobile: 2-column label grid under the figure. Desktop: the wrapper
          vanishes (lg:contents) and the labels position absolutely against
          the map container (top from SLOT_LABEL_POS, column via left/right;
          the PNG's internal figure margins keep the 34% columns clear of the
          silhouette). */}
      <div className="grid w-full grid-cols-2 gap-2 lg:contents">
        {SLOT_LABEL_POS.map(({ slot, column, y }) => {
          const label = CHROME_SLOT_LABELS[slot] ?? slot;
          const capacity = SLOT_CAPACITY[slot];
          const count = countFor(slot);
          const full = count >= capacity;
          const selected = selectedSlot === slot;
          const left = column === "left";

          return (
            <button
              key={slot}
              type="button"
              tabIndex={full ? -1 : 0}
              data-slot={slot}
              aria-label={`${label}: ${count}/${capacity} ocupados`}
              aria-pressed={selected || undefined}
              aria-disabled={full || undefined}
              style={{ top: `${y}%` }}
              className={`flex max-lg:min-h-touch items-baseline gap-2 py-1.5 font-data text-xs uppercase tracking-wider transition-colors lg:absolute lg:w-[var(--label-w)] ${
                left ? "lg:left-0 lg:justify-end lg:text-right" : "lg:right-0 lg:justify-start"
              } ${labelClass({ selected, full })}`}
              onClick={() => {
                if (!full) onSelectSlot(slot);
              }}
              onKeyDown={(e) => {
                if (full) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSlot(slot);
                }
              }}
            >
              <span className="min-w-0 truncate">{label}</span>
              <span className="shrink-0 text-nd-micro normal-case tracking-normal">
                {count}/{capacity}
                {full ? " · CHEIO" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
