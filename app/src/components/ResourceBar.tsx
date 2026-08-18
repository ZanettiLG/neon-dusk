import type { ReactNode } from "react";
import { bandFor } from "@/lib/tokens";

interface ResourceBarProps {
  label: string;
  value: number;
  max: number;
  resource: "nil" | "humanity";
  /** Optional right-aligned hint under the bar (e.g. regen countdown). */
  etaText?: string;
  /** Optional slot on the top row (e.g. an action button). */
  action?: ReactNode;
}

/**
 * Presentational resource bar (NIL / Humanidade). Renders label, value/max,
 * a color band, and the band's textual label — color is never the only
 * channel. Optional `etaText` and `action` slots for the caller's own content.
 */
export default function ResourceBar({
  label,
  value,
  max,
  resource,
  etaText,
  action,
}: ResourceBarProps) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  const band = bandFor(resource, percent);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-data text-xs uppercase tracking-widest text-nd-text-secondary">
            {label}
          </span>
          <span className="font-data text-sm text-nd-text">
            {value} / {max}
          </span>
        </div>
        {action}
      </div>
      <div className="h-2 w-full bg-nd-bg overflow-hidden rounded-full border border-nd-cyan/20">
        <div
          className={`h-full rounded-full transition-all duration-500 ${band.color}`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs font-data">
        <span className="text-nd-text-secondary">{band.label}</span>
        {etaText && <span className="text-nd-text-secondary">{etaText}</span>}
      </div>
    </div>
  );
}
