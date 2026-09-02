// District heat bands for the metro map (issue #18). Display levels mirror
// the heat mechanics of 03-mecanicas-core.md §2: decay is applied server-side,
// the client only buckets the value for color/label. Tailwind classes are
// literal strings (JIT scans verbatim).

export const HEAT_LEVELS = [
  {
    level: "limpo",
    min: 0,
    max: 0,
    label: "LIMPO",
    color: "fill-nd-green",
    solid: "bg-nd-green",
  },
  {
    level: "quente",
    min: 1,
    max: 49,
    label: "QUENTE",
    color: "fill-nd-gold",
    solid: "bg-nd-gold",
  },
  {
    level: "pegando_fogo",
    min: 50,
    max: 99,
    label: "PEGANDO FOGO",
    color: "fill-nd-magenta",
    solid: "bg-nd-magenta",
  },
  {
    level: "inferno",
    min: 100,
    max: Infinity,
    label: "INFERNO",
    color: "fill-nd-magenta",
    solid: "bg-nd-magenta",
    pulse: true,
  },
] as const;

export type HeatLevel = (typeof HEAT_LEVELS)[number]["level"];

/** The heat band for a value: negative clamps to 0, non-finite → limpo. */
export function heatLevelFor(heat: number): HeatLevel {
  if (!Number.isFinite(heat)) return "limpo";
  const value = Math.max(0, heat);
  const band = HEAT_LEVELS.find((b) => value >= b.min && value <= b.max);
  return (band?.level ?? "limpo") as HeatLevel;
}
