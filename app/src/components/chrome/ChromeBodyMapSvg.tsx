import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";
import { CHROME_SLOTS, SLOT_CAPACITY } from "@neon-dusk/shared";
import { CHROME_SLOT_LABELS } from "@/lib/labels";

// Frontal silhouette geometry (viewBox 200×400). Hit zones are drawn as
// invisible shapes (transparent fill/stroke + explicit pointer-events) so each
// slot keeps a ≥44-viewBox-unit target without painting over the artwork.
// Paint order is bottom → top (later SVG siblings capture pointer events
// first): the torso (integumentary) is the base layer and the smaller slots
// render ON TOP of it, so skeleton/nervous_system hits never get swallowed by
// the torso fill. See LAYER_ORDER below.

const TORSO_D = "M40,92 L160,92 L165,235 L35,235 Z";
const ARMS_D = "M46,102 Q30,162 24,220 M154,102 Q170,162 176,220";
const SKELETON_D =
  "M100,72 L100,193 M100,108 Q74,116 58,146 M100,108 Q126,116 142,146 M100,140 Q80,146 70,170 M100,140 Q120,146 130,170";
const NERVOUS_D =
  "M100,158 L84,192 M100,158 L116,192 M100,192 L92,228 M100,192 L108,228";

/**
 * Render order of the slot layers, painted bottom → top. The torso polygon
 * (integumentary, x 35–165 / y 92–235) geometrically covers the skeleton
 * (x 58–142 / y 72–193) and nervous_system (x 84–116 / y 158–228) hit zones,
 * so it MUST paint first as the base layer; every smaller slot paints on top
 * and wins clicks where the hit zones overlap. Every slot appears exactly once.
 */
const LAYER_ORDER: ChromeSlot[] = [
  "integumentary",
  "nervous_system",
  "skeleton",
  "ocular",
  "frontal_cortex",
  "arms",
];

/** Pips/badge anchor per slot (pips centered horizontally on the anchor). */
const PIPS: Record<ChromeSlot, { x: number; y: number; gap: number }> = {
  frontal_cortex: { x: 100, y: 12, gap: 14 },
  ocular: { x: 100, y: 86, gap: 12 },
  arms: { x: 36, y: 246, gap: 12 },
  skeleton: { x: 112, y: 132, gap: 12 },
  nervous_system: { x: 112, y: 252, gap: 12 },
  integumentary: { x: 60, y: 252, gap: 12 },
};

interface ChromeBodyMapSvgProps {
  installed: InstalledChromeRecord[];
  selectedSlot: ChromeSlot | null;
  onSelectSlot: (slot: ChromeSlot) => void;
}

/** Visible artwork per slot (color comes from `strokeClass`/`fillClass`). */
function SlotVisuals({
  slot,
  strokeClass,
  fillClass,
}: {
  slot: ChromeSlot;
  strokeClass: string;
  fillClass: string;
}) {
  switch (slot) {
    case "frontal_cortex":
      return <ellipse cx={100} cy={30} rx={20} ry={16} className={strokeClass} fill={fillClass} strokeWidth={2} />;
    case "ocular":
      return (
        <>
          <ellipse cx={87} cy={57} rx={7} ry={5} className={strokeClass} fill={fillClass} strokeWidth={2} />
          <ellipse cx={113} cy={57} rx={7} ry={5} className={strokeClass} fill={fillClass} strokeWidth={2} />
        </>
      );
    case "arms":
      return <path d={ARMS_D} className={strokeClass} fill="none" strokeWidth={10} strokeLinecap="round" />;
    case "skeleton":
      return <path d={SKELETON_D} className={strokeClass} fill="none" strokeWidth={5} strokeLinecap="round" />;
    case "nervous_system":
      return <path d={NERVOUS_D} className={strokeClass} fill="none" strokeWidth={5} strokeLinecap="round" />;
    case "integumentary":
      return <path d={TORSO_D} className={strokeClass} fill={fillClass} strokeWidth={3} strokeLinejoin="round" />;
  }
}

/** Invisible ≥44-unit hit targets (pointer-events capture regardless of paint). */
function SlotHits({ slot }: { slot: ChromeSlot }) {
  switch (slot) {
    case "frontal_cortex":
      return <ellipse cx={100} cy={30} rx={27} ry={23} fill="transparent" pointerEvents="fill" />;
    case "ocular":
      return <ellipse cx={100} cy={60} rx={32} ry={23} fill="transparent" pointerEvents="fill" />;
    case "arms":
      return <path d={ARMS_D} fill="none" stroke="transparent" strokeWidth={40} pointerEvents="stroke" />;
    case "skeleton":
      return <path d={SKELETON_D} fill="none" stroke="transparent" strokeWidth={36} pointerEvents="stroke" />;
    case "nervous_system":
      return <path d={NERVOUS_D} fill="none" stroke="transparent" strokeWidth={30} pointerEvents="stroke" />;
    case "integumentary":
      return <path d={TORSO_D} fill="transparent" pointerEvents="fill" />;
  }
}

/** Selected halo — gold ring around the slot artwork (color is decorative). */
function SlotRings({ slot }: { slot: ChromeSlot }) {
  const ring = "stroke-nd-gold/60 animate-pulse-neon";
  switch (slot) {
    case "frontal_cortex":
      return <ellipse cx={100} cy={30} rx={25} ry={21} className={ring} fill="none" strokeWidth={2} pointerEvents="none" />;
    case "ocular":
      return (
        <>
          <ellipse cx={87} cy={57} rx={12} ry={10} className={ring} fill="none" strokeWidth={2} pointerEvents="none" />
          <ellipse cx={113} cy={57} rx={12} ry={10} className={ring} fill="none" strokeWidth={2} pointerEvents="none" />
        </>
      );
    case "arms":
      return <path d={ARMS_D} className={ring} fill="none" strokeWidth={16} strokeLinecap="round" pointerEvents="none" />;
    case "skeleton":
      return <path d={SKELETON_D} className={ring} fill="none" strokeWidth={9} strokeLinecap="round" pointerEvents="none" />;
    case "nervous_system":
      return <path d={NERVOUS_D} className={ring} fill="none" strokeWidth={9} strokeLinecap="round" pointerEvents="none" />;
    case "integumentary":
      return <path d={TORSO_D} className={ring} fill="none" strokeWidth={6} strokeLinejoin="round" pointerEvents="none" />;
  }
}

/** Dot count (filled = occupied). Decorative — the aria-label + legenda carry the count. */
function Pips({ x, y, gap, count, capacity }: { x: number; y: number; gap: number; count: number; capacity: number }) {
  const start = x - ((capacity - 1) * gap) / 2;
  return (
    <g aria-hidden="true" pointerEvents="none">
      {Array.from({ length: capacity }, (_, i) => (
        <circle
          key={i}
          cx={start + i * gap}
          cy={y}
          r={3.5}
          strokeWidth={1}
          className={i < count ? "fill-nd-cyan stroke-nd-cyan" : "fill-none stroke-nd-cyan/40"}
        />
      ))}
    </g>
  );
}

/** Full-slot badge — text, never color alone. */
function FullBadge({ x, y }: { x: number; y: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      aria-hidden="true"
      pointerEvents="none"
      className="fill-nd-magenta font-data text-[9px] font-bold"
    >
      CHEIO
    </text>
  );
}

/**
 * Interactive body map of the 6 cromo slots (issue #10). Each slot is a
 * keyboard-focusable region (Enter/Space), announced with its occupancy.
 * Visual states: empty (weak stroke), partial (cyan fill + pips), full
 * (disabled + CHEIO badge) and selected (gold ring). Color is never the only
 * channel — occupancy is carried by aria-label, pips, badge and a legenda HTML.
 */
export default function ChromeBodyMapSvg({ installed, selectedSlot, onSelectSlot }: ChromeBodyMapSvgProps) {
  return (
    <div>
      <svg
        viewBox="0 0 200 400"
        role="group"
        aria-label="Mapa corporal de cromo"
        className="w-full max-w-[240px] mx-auto"
      >
        <g aria-hidden="true" pointerEvents="none">
          <circle cx={100} cy={45} r={24} className="fill-nd-cyan/5 stroke-nd-cyan/15" strokeWidth={1} />
          <path d={TORSO_D} className="fill-nd-cyan/5 stroke-nd-cyan/15" strokeWidth={1} strokeLinejoin="round" />
        </g>

        {LAYER_ORDER.map((slot) => {
          const label = CHROME_SLOT_LABELS[slot] ?? slot;
          const capacity = SLOT_CAPACITY[slot];
          const count = installed.filter((rec) => rec.definition.slot === slot).length;
          const full = count >= capacity;
          const partial = count > 0;
          const selected = selectedSlot === slot;
          const pip = PIPS[slot];

          const strokeClass = selected
            ? "stroke-nd-gold"
            : full
              ? "stroke-nd-magenta/40"
              : partial
                ? "stroke-nd-cyan/70"
                : "stroke-nd-cyan/25";
          const fillClass =
            partial && !full ? (slot === "integumentary" ? "fill-nd-cyan/10" : "fill-nd-cyan/15") : "fill-none";

          return (
            <g
              key={slot}
              role="button"
              tabIndex={full ? -1 : 0}
              aria-label={`${label} — ${count}/${capacity} ocupados`}
              aria-pressed={selected || undefined}
              aria-disabled={full || undefined}
              data-slot={slot}
              className={`chrome-svg-slot ${full ? "cursor-not-allowed" : "cursor-pointer"}`}
              onClick={full ? undefined : () => onSelectSlot(slot)}
              onKeyDown={(e) => {
                if (full) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectSlot(slot);
                }
              }}
            >
              {selected && <SlotRings slot={slot} />}
              <SlotVisuals slot={slot} strokeClass={strokeClass} fillClass={fillClass} />
              <SlotHits slot={slot} />
              {full ? (
                <FullBadge x={pip.x} y={pip.y} />
              ) : (
                <Pips x={pip.x} y={pip.y} gap={pip.gap} count={count} capacity={capacity} />
              )}
            </g>
          );
        })}
      </svg>

      <dl className="mt-3 space-y-1 text-xs font-data" aria-label="Ocupação dos slots de cromo">
        {CHROME_SLOTS.map((slot) => {
          const inSlot = installed.filter((rec) => rec.definition.slot === slot);
          const count = inSlot.length;
          const capacity = SLOT_CAPACITY[slot];
          return (
            <div key={slot} className="flex items-baseline justify-between gap-2">
              <dt className="text-nd-text-secondary">{CHROME_SLOT_LABELS[slot] ?? slot}</dt>
              <dd className="text-nd-text">
                {count}/{capacity} — {count === 0 ? "vazio" : inSlot.map((rec) => rec.definition.name).join(", ")}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
