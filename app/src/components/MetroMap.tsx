import type { KeyboardEvent } from "react";
import type { Origin } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";
import { DISTRICT_THEMES } from "@/lib/district-meta";
import { METRO_LINES, STATION_NODES } from "@/lib/metro-lines";

// Raw hand-coded icons (24×24, currentColor). Width/height are injected at
// module load — the curated files ship without them so CSS can size them.
const VENDOR_ICONS = import.meta.glob("../assets/icons/*.svg", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>;
const GRANA_ICON = (VENDOR_ICONS["../assets/icons/icon-res-grana.svg"] ?? "").replace(
  "<svg ",
  '<svg width="10" height="10" ',
);

/** Station lookup by origin (7 entries — built once at module load). */
const nodeMap = new Map(STATION_NODES.map((node) => [node.origin, node]));

export interface MetroMapProps {
  /** District the character stands in — filled + "VOCÊ ESTÁ AQUI". */
  currentDistrict: Origin | null;
  /** District the character was born in — cyan ring. */
  originDistrict?: Origin | null;
  /** Vendor count per district (badges). Omitted/empty = no badges. */
  vendorsByDistrict?: Partial<Record<Origin, number>>;
  /** Crossing in flight — stations disabled. */
  traveling?: boolean;
  /** Called when the player picks a station. */
  onSelect: (origin: Origin) => void;
}

/**
 * Diegetic metro diagram of São Paulo 2087: two schematic lines crossing
 * seven stations. Each station is an accessible button (Enter/Space/click);
 * the current district is filled, the birth district wears a cyan ring, and
 * districts with vendors carry a Grana badge with the count.
 */
export default function MetroMap({
  currentDistrict,
  originDistrict = null,
  vendorsByDistrict = {},
  traveling = false,
  onSelect,
}: MetroMapProps) {
  function handleKeyDown(event: KeyboardEvent<SVGGElement>, origin: Origin): void {
    if (traveling) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(origin);
    }
  }

  return (
    <div>
      <svg
        viewBox="0 0 400 300"
        className="h-auto w-full"
        role="img"
        aria-label="Mapa do metrô de São Paulo 2087"
      >
        {/* Lines first — stations render on top. */}
        {METRO_LINES.map((line) => {
          const points = line.stops
            .map((origin) => {
              const node = nodeMap.get(origin);
              return node ? `${node.x},${node.y}` : "";
            })
            .join(" ");
          return (
            <polyline
              key={line.id}
              data-testid={`metro-line-${line.id}`}
              points={points}
              fill="none"
              strokeWidth={3}
              className={line.color}
            />
          );
        })}

        {STATION_NODES.map(({ origin, x, y }) => {
          const theme = DISTRICT_THEMES[origin];
          const label = ORIGIN_LABELS[origin];
          const isOrigin = origin === originDistrict;
          const isCurrent = origin === currentDistrict;
          const count = vendorsByDistrict[origin] ?? 0;
          const disabled = traveling;

          return (
            <g
              key={origin}
              role="button"
              tabIndex={0}
              aria-label={`Estação ${label}`}
              aria-disabled={disabled || undefined}
              className="cursor-pointer"
              data-origin={isOrigin ? "true" : undefined}
              data-current={isCurrent ? "true" : undefined}
              onClick={() => {
                if (!disabled) onSelect(origin);
              }}
              onKeyDown={(event) => handleKeyDown(event, origin)}
            >
              {/* Birth-district ring. */}
              {isOrigin && (
                <circle
                  cx={x}
                  cy={y}
                  r={14}
                  fill="none"
                  strokeWidth="1.5"
                  className="stroke-nd-cyan"
                />
              )}

              {/* Station core: district frame; filled when current. */}
              <circle
                cx={x}
                cy={y}
                r={10}
                fill="none"
                strokeWidth="2"
                className={`${theme.frame} ${isCurrent ? "fill-nd-cyan/20" : ""}`}
              />

              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="'Fira Code', monospace"
                fontSize="11"
                letterSpacing="0.5"
                className={theme.text}
              >
                {theme.glyph}
              </text>

              {/* pt-BR label under the station. */}
              <text
                x={x}
                y={y + 22}
                textAnchor="middle"
                fontFamily="'Fira Code', monospace"
                fontSize="10"
                className="fill-nd-text-secondary"
              >
                {label}
              </text>

              {/* Current-district marker. */}
              {isCurrent && (
                <text
                  x={x}
                  y={y - 20}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="'Fira Code', monospace"
                  fontSize="9"
                  letterSpacing="1"
                  className="fill-nd-cyan"
                >
                  VOCÊ ESTÁ AQUI
                </text>
              )}

              {/* Vendor badge: Grana icon + count (decorative — aria-hidden). */}
              {count > 0 && (
                <g
                  transform={`translate(${x + 24} ${y - 18})`}
                  data-testid={`metro-vendors-${origin}`}
                  aria-hidden="true"
                >
                  <circle r={12} fill="none" strokeWidth="1" className="stroke-nd-gold/60" />
                  <g
                    transform="translate(-7 -6)"
                    dangerouslySetInnerHTML={{ __html: GRANA_ICON }}
                  />
                  <text
                    x={7}
                    y={5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="'Fira Code', monospace"
                    fontSize="10"
                    className="fill-nd-gold"
                  >
                    {count}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Line key — color is never the only channel. */}
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {METRO_LINES.map((line) => (
          <span
            key={line.id}
            className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-widest text-nd-text-secondary"
          >
            <span aria-hidden="true" className={`h-1 w-6 ${line.solid}`} />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}
