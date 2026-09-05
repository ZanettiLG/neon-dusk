import type { CSSProperties } from "react";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";
import { CHROME_SLOTS, SLOT_CAPACITY } from "@neon-dusk/shared";
import { CHROME_SLOT_LABELS } from "@/lib/labels";
import { LAYER_ORDER, SLOT_HIT_AREAS, SLOT_PIPS, type SlotHitArea } from "@/lib/chrome-body-map";
import bodyMapUrl from "@/assets/chrome/body-map.png";

// Body map of the 9 cromo slots (issue #94): the artwork is an AI-generated
// PNG (512×1024, noir silhouette); the interactive layer is invisible
// percentage-positioned hit areas on top of it. Same a11y contract as the old
// ChromeBodyMapSvg (group role, per-slot buttons with occupancy aria-labels,
// Enter/Space, CHEIO badge + pips + HTML legenda as redundant text channels).
// Pips/badge are absolutely positioned in IMAGE space (SLOT_PIPS), so they
// render as pointer-events-none siblings of the buttons — they sit over the
// artwork and never steal clicks.

interface ChromeBodyMapImageProps {
  installed: InstalledChromeRecord[];
  selectedSlot: ChromeSlot | null;
  onSelectSlot: (slot: ChromeSlot) => void;
}

/** Tailwind border/animation classes per slot state (color is decorative). */
function hitAreaClass(state: { selected: boolean; full: boolean; partial: boolean }): string {
  if (state.selected) return "border-nd-gold/60 animate-pulse-neon";
  if (state.full) return "border-nd-magenta/40 cursor-not-allowed";
  if (state.partial) return "border-nd-cyan/40 hover:border-nd-cyan/60 cursor-pointer";
  return "border-transparent hover:border-nd-cyan/60 cursor-pointer";
}

/** Overlay content anchored in image space: pips (empty/partial) or CHEIO badge. */
function SlotMarker({
  slot,
  count,
  capacity,
  full,
}: {
  slot: ChromeSlot;
  count: number;
  capacity: number;
  full: boolean;
}) {
  const pip = SLOT_PIPS[slot];
  const anchor: CSSProperties = { left: `${pip.x}%`, top: `${pip.y}%` };
  if (full) {
    return (
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-data text-nd-micro font-bold text-nd-magenta"
        style={anchor}
      >
        CHEIO
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
      style={anchor}
    >
      {Array.from({ length: capacity }, (_, i) => (
        <span
          key={i}
          className={`size-2 rounded-full border ${i < count ? "border-nd-cyan bg-nd-cyan" : "border-nd-cyan/40"}`}
        />
      ))}
    </span>
  );
}

/**
 * Interactive body map over the AI artwork (issue #10 + #28 + #94). Each slot
 * is a keyboard-focusable region (Enter/Space), announced with its occupancy.
 * Visual states: empty (invisible area), partial (cyan pips), full (disabled
 * + CHEIO badge) and selected (gold ring). Color is never the only channel —
 * occupancy is carried by aria-label, pips, badge and a legenda HTML.
 */
export default function ChromeBodyMapImage({
  installed,
  selectedSlot,
  onSelectSlot,
}: ChromeBodyMapImageProps) {
  const hitAreas = LAYER_ORDER.flatMap((slot) =>
    SLOT_HIT_AREAS.filter((area) => area.slot === slot),
  );

  return (
    <div>
      <div
        role="group"
        aria-label="Mapa corporal de cromo"
        className="relative w-full max-w-[240px] mx-auto"
      >
        {/* Artwork: decorative — the information lives in the buttons + legenda. */}
        <img
          src={bodyMapUrl}
          alt=""
          aria-hidden="true"
          className="block w-full h-auto"
          draggable={false}
        />

        {hitAreas.map((area: SlotHitArea, i) => {
          const slot = area.slot;
          const label = CHROME_SLOT_LABELS[slot] ?? slot;
          const capacity = SLOT_CAPACITY[slot];
          const count = installed.filter((rec) => rec.definition.slot === slot).length;
          const full = count >= capacity;
          const partial = count > 0;
          const selected = selectedSlot === slot;

          return (
            <button
              key={`${slot}-${i}`}
              type="button"
              tabIndex={full ? -1 : 0}
              aria-label={`${label} — ${count}/${capacity} ocupados`}
              aria-pressed={selected || undefined}
              aria-disabled={full || undefined}
              data-slot={slot}
              className={`absolute border ${hitAreaClass({ selected, full, partial })}`}
              style={{
                left: `${area.x}%`,
                top: `${area.y}%`,
                width: `${area.w}%`,
                height: `${area.h}%`,
              }}
              onClick={full ? undefined : () => onSelectSlot(slot)}
              onKeyDown={(e) => {
                if (full) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSlot(slot);
                }
              }}
            />
          );
        })}

        {/* Pips/CHEIO badge — image-space markers over the buttons. */}
        {LAYER_ORDER.map((slot) => {
          const capacity = SLOT_CAPACITY[slot];
          const count = installed.filter((rec) => rec.definition.slot === slot).length;
          return (
            <SlotMarker
              key={slot}
              slot={slot}
              count={count}
              capacity={capacity}
              full={count >= capacity}
            />
          );
        })}
      </div>

      <dl className="mt-3 space-y-1 text-xs font-data" aria-label="Ocupação dos slots de cromo">
        {CHROME_SLOTS.map((slot) => {
          const inSlot = installed.filter((rec) => rec.definition.slot === slot);
          const count = inSlot.length;
          const capacity = SLOT_CAPACITY[slot];
          return (
            <div key={slot} className="flex items-baseline justify-between gap-2">
              <dt className="text-nd-text-secondary">{CHROME_SLOT_LABELS[slot] ?? slot}</dt>
              <dd className="text-nd-text">
                {count}/{capacity} —{" "}
                {count === 0 ? "vazio" : inSlot.map((rec) => rec.definition.name).join(", ")}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
