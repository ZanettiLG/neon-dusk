import type { Band, ResourceBarKey } from "@/lib/tokens";
import { bandForBands, RESOURCE_BAR_BANDS } from "@/lib/tokens";
import Skeleton from "./Skeleton";
import type { DataStatus } from "./types";

export interface MetricBarProps {
  /** Built-in band set (nil, hp, humanity, gigDifficulty, streetCred). */
  resource?: ResourceBarKey;
  /** Custom band set; takes precedence over `resource`. */
  bands?: Band[];
  value?: number;
  max?: number;
  /** Caption shown above the bar (e.g. "NIL"). */
  label?: string;
  /** Unit suffix after the value. Defaults to "%". */
  unit?: string;
  status?: DataStatus;
  size?: "sm" | "md";
}

/**
 * Segmented resource bar (NIL, HP, humanity, difficulty...). Fill color comes
 * from the resolved band; the band label and numeric value are always visible
 * so color is never the only channel.
 */
export default function MetricBar({
  resource,
  bands,
  value,
  max = 100,
  label,
  unit = "%",
  status = "default",
  size = "md",
}: MetricBarProps) {
  const safeValue = value !== undefined && Number.isFinite(value) ? value : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const percent = Math.min(100, Math.max(0, (safeValue / safeMax) * 100));

  if (status === "loading") {
    return (
      <div className="space-y-1.5" aria-busy="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className={size === "sm" ? "h-1 w-full" : "h-2 w-full"} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <p role="alert" className="text-nd-magenta text-xs font-data">
        ✗ erro ao carregar
      </p>
    );
  }

  if (status === "empty") {
    return <p className="text-nd-text-secondary text-xs font-data">sem dados</p>;
  }

  const activeBands = bands ?? (resource ? RESOURCE_BAR_BANDS[resource] : undefined);
  const band = activeBands ? bandForBands(activeBands, percent) : undefined;
  const barHeight = size === "sm" ? "h-1" : "h-2";
  const captionSize = size === "sm" ? "text-nd-micro" : "text-xs";

  return (
    <div>
      <div
        className={`flex items-baseline justify-between gap-2 ${captionSize} font-data uppercase tracking-widest`}
      >
        <span className="text-nd-text-secondary">{label}</span>
        <span className="text-nd-text">
          {Math.round(percent)}
          <span className="text-nd-text-secondary">{unit}</span>
          {band && <span className="ml-2 text-nd-text-secondary">· {band.label}</span>}
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={Math.round(safeMax)}
        aria-valuenow={Math.round(Math.min(safeMax, Math.max(0, safeValue)))}
        aria-label={label}
        className={`mt-1 w-full ${barHeight} bg-nd-bg rounded-full border border-nd-cyan/20 overflow-hidden`}
      >
        <div
          className={`h-full rounded-full transition-all duration-nd-slow ${band?.color ?? "bg-nd-cyan"} ${
            band?.pulse ? "animate-pulse-neon" : ""
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
