import type { KeyboardEvent } from "react";
import type { Origin } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";
import { DISTRICT_THEMES } from "@/lib/district-meta";
import { METRO_LINES, STATION_NODES } from "@/lib/metro-lines";
import { HEAT_LEVELS, heatLevelFor } from "@/lib/heat";

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
  /** Trampos disponíveis per district (left badge, issue #18). */
  gigsByDistrict?: Partial<Record<Origin, number>>;
  /** Live district heat per district (label below the station, issue #18). */
  heatByDistrict?: Partial<Record<Origin, number>>;
  /** Crew tag claiming the district (label above the station, issue #18). */
  territoryByDistrict?: Partial<Record<Origin, string>>;
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
  gigsByDistrict = {},
  heatByDistrict = {},
  territoryByDistrict = {},
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
          const gigCount = gigsByDistrict[origin] ?? 0;
          const heat = heatByDistrict[origin] ?? 0;
          const territory = territoryByDistrict[origin] ?? null;
          const heatLevel = heatLevelFor(heat);
          const heatBand = HEAT_LEVELS.find((b) => b.level === heatLevel) ?? HEAT_LEVELS[0];
          // The indicator contents are announced with the station (they stay
          // aria-hidden — they only duplicate the label visually).
          const countSuffix =
            count > 0 ? `, ${count} ${count === 1 ? "vendedor" : "vendedores"}` : "";
          const gigsSuffix = gigCount > 0 ? `, ${gigCount} ${gigCount === 1 ? "trampo" : "trampos"}` : "";
          const heatSuffix = heat > 0 ? `, calor ${heatBand.label} (${heat})` : "";
          const territorySuffix = territory ? `, território do bonde ${territory}` : "";
          const disabled = traveling;

          return (
            <g
              key={origin}
              role="button"
              tabIndex={0}
              aria-label={`Estação ${label}${countSuffix}${gigsSuffix}${heatSuffix}${territorySuffix}`}
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

              {/* Vendor badge: Grana icon + count. Centered on the station's
                  right side (x+27, y) — the ONE position for every case: it
                  clears the "VOCÊ ESTÁ AQUI" band (y-24.5..y-15.5), the
                  pt-BR label (y+14..y+22) and the birth ring (r=14) while
                  staying inside the 400×300 viewBox for the eastern stations.
                  Solid nd-bg fill keeps the chip legible over line crossings.
                  The count is announced via the station aria-label, so the
                  badge itself is aria-hidden (visual duplication only). */}
              {count > 0 && (
                <g
                  transform={`translate(${x + 27} ${y})`}
                  data-testid={`metro-vendors-${origin}`}
                  aria-hidden="true"
                >
                  <circle
                    r={12}
                    fill="none"
                    strokeWidth="1"
                    className="fill-nd-bg stroke-nd-gold/60"
                  />
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

              {/* Trampos badge: cyan circle + count, mirrored on the station's
                  left side (x-27, y) so it never collides with the vendor
                  badge (x+27). Spans x-39..x-15 — inside the viewBox even for
                  the western o_ponto (x=55 → 16..40). Count announced via the
                  station aria-label; the badge itself is aria-hidden. */}
              {gigCount > 0 && (
                <g
                  transform={`translate(${x - 27} ${y})`}
                  data-testid={`metro-gigs-${origin}`}
                  aria-hidden="true"
                >
                  <circle
                    r={12}
                    fill="none"
                    strokeWidth="1"
                    className="fill-nd-bg stroke-nd-cyan/70"
                  />
                  <text
                    x={0}
                    y={5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="'Fira Code', monospace"
                    fontSize="10"
                    className="fill-nd-cyan"
                  >
                    {gigCount}
                  </text>
                </g>
              )}

              {/* Calor label: heat band word centered under the district label
                  (y+34). Only renders above zero (LIMPO is never shown — a
                  clean district shows nothing). Pulse animation on INFERNO.
                  Band text spans x±33 max ("PEGANDO FOGO") — inside the
                  viewBox for every station, clears the district label above
                  (y+14..y+22) and the viewBox bottom (o_ponto y=245 →
                  279+5=284 < 300). Announced via the station aria-label. */}
              {heat > 0 && (
                <text
                  x={x}
                  y={y + 34}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="'Fira Code', monospace"
                  fontSize="10"
                  letterSpacing="0.5"
                  className={`${heatBand.color} ${"pulse" in heatBand ? "animate-pulse-neon" : ""}`}
                  data-testid={`metro-heat-${origin}`}
                  aria-hidden="true"
                >
                  {heatBand.label}
                </text>
              )}

              {/* Território label: [TAG] above the station (y-32) — clears the
                  "VOCÊ ESTÁ AQUI" band (y-24.5..y-15.5) and the viewBox top
                  (a_paraiso y=55 → 23-5=18 > 0). Announced via the station
                  aria-label. */}
              {territory && (
                <text
                  x={x}
                  y={y - 32}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="'Fira Code', monospace"
                  fontSize="10"
                  letterSpacing="1"
                  className="fill-nd-gold"
                  data-testid={`metro-territory-${origin}`}
                  aria-hidden="true"
                >
                  [{territory}]
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Line + heat keys — color is never the only channel. */}
      <div className="mt-2 flex flex-wrap items-center gap-4">
        {METRO_LINES.map((line) => (
          <span
            key={line.id}
            className="flex items-center gap-1.5 font-data text-nd-micro uppercase tracking-widest text-nd-text-secondary"
          >
            <span aria-hidden="true" className={`h-1 w-6 ${line.solid}`} />
            {line.label}
          </span>
        ))}
        {/* Heat bands that can render on the map (LIMPO never shows a chip).
            Same swatch + label pattern as the line key. */}
        <span
          data-testid="metro-heat-legend"
          className="flex items-center gap-3 font-data text-nd-micro uppercase tracking-widest text-nd-text-secondary"
        >
          {HEAT_LEVELS.filter((band) => band.level !== "limpo").map((band) => (
            <span key={band.level} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`h-1 w-6 ${band.solid}`} />
              {band.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
