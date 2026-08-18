/**
 * Shared pulsing skeleton line (decorative). Used by Panel, MetricBar and
 * EventLog loading states so the loading look stays consistent and DRY.
 */
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse-neon bg-nd-cyan/10 rounded ${className}`}
    />
  );
}
