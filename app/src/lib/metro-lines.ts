import type { Origin } from "@neon-dusk/shared";

// Schematic map of the São Paulo 2087 metro (02-mundo-e-universo.md): seven
// districts on two crossing lines. The Saideira sits inside an abandoned
// station of the old Linha 3-Vermelha (Babilônia) — the red line stays
// canonical; the lilac line is the second schematic.

/** One station on the map, positioned in the 400×300 viewBox. */
export interface StationNode {
  origin: Origin;
  /** Station center X in the 400×300 map viewBox. */
  x: number;
  /** Station center Y in the 400×300 map viewBox. */
  y: number;
}

export const STATION_NODES: StationNode[] = [
  { origin: "a_paraiso", x: 310, y: 55 },
  { origin: "o_fervo", x: 200, y: 235 },
  { origin: "o_fluxo", x: 185, y: 95 },
  { origin: "a_quebrada", x: 70, y: 70 },
  { origin: "babilonia", x: 130, y: 175 },
  { origin: "as_mortas", x: 320, y: 220 },
  { origin: "o_ponto", x: 55, y: 245 },
];

/** One schematic metro line: ordered stops + line colors. */
export interface MetroLine {
  id: string;
  /** Display label (pt-BR), e.g. "Linha 3-Vermelha". */
  label: string;
  /** Tailwind stroke class for the map line (literal — JIT scans verbatim). */
  color: string;
  /** Solid Tailwind bg class of the same color (bars, legends). */
  solid: string;
  /** Ordered stops along the line. */
  stops: Origin[];
}

export const METRO_LINES: MetroLine[] = [
  {
    id: "line-3-vermelha",
    label: "Linha 3-Vermelha",
    color: "stroke-nd-magenta/40",
    solid: "bg-nd-magenta",
    stops: ["o_ponto", "babilonia", "o_fluxo", "a_paraiso"],
  },
  {
    id: "line-4-lilas",
    label: "Linha 4-Lilás",
    color: "stroke-nd-purple/40",
    solid: "bg-nd-purple",
    stops: ["a_quebrada", "o_fluxo", "o_fervo", "as_mortas"],
  },
];

/**
 * The line serving a station. Transfer stations (O Fluxo, on both lines)
 * resolve to the first match — the red line.
 */
export function findLineFor(origin: Origin): MetroLine {
  return METRO_LINES.find((line) => line.stops.includes(origin)) ?? METRO_LINES[0];
}
