import { useEffect, useState } from "react";
import type { Origin } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";
import { DISTRICT_THEMES } from "@/lib/district-meta";
import { findLineFor } from "@/lib/metro-lines";

/** Beat between the boarding and crossing messages (half the ride). */
const CROSSING_PHASE_MS = 900;

type CrossingPhase = "boarding" | "crossing";

interface MetroCrossingProps {
  destination: Origin;
}

/**
 * Full-screen diegetic crossing overlay: boarding announcement on the line,
 * then the destination callout with the district glyph and a pulsing line
 * bar. Announcements are exposed to screen readers via role="status".
 */
export default function MetroCrossing({ destination }: MetroCrossingProps) {
  const [phase, setPhase] = useState<CrossingPhase>("boarding");
  const line = findLineFor(destination);
  const theme = DISTRICT_THEMES[destination];

  useEffect(() => {
    const timer = setTimeout(() => setPhase("crossing"), CROSSING_PHASE_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-nd-bg/95"
    >
      <div className="w-full max-w-md space-y-5 px-6 text-center">
        <p className="font-data text-sm text-nd-cyan sm:text-base">
          {phase === "boarding"
            ? `▌ EMBARCANDO NA ${line.label.toUpperCase()}...`
            : `▌ ATRAVESSANDO PARA ${ORIGIN_LABELS[destination].toUpperCase()}...`}
        </p>

        {/* Destination glyph — hexagon frame + two-letter glyph. */}
        <svg viewBox="0 0 64 64" className="mx-auto h-14 w-14" fill="none" aria-hidden="true">
          <polygon
            points="32,2 58,17 58,47 32,62 6,47 6,17"
            strokeWidth="2"
            className={theme.frame}
          />
          <text
            x="32"
            y="32"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Fira Code', monospace"
            fontSize="15"
            letterSpacing="1"
            className={theme.text}
          >
            {theme.glyph}
          </text>
        </svg>

        {/* Ride progress bar. */}
        <div className="h-1 overflow-hidden rounded-terminal bg-nd-surface">
          <div className={`h-full w-2/3 ${line.solid} animate-pulse-neon`} />
        </div>
      </div>
    </div>
  );
}
