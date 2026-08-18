import type { ReactNode } from "react";
import type { Tone } from "./types";

export interface StatusBadgeProps {
  tone?: Tone;
  label: string;
  icon?: ReactNode;
  size?: "sm" | "md";
}

/** Tone → border/text/background classes. `tier` shares the success channel. */
const TONE_CLASSES: Record<Tone, string> = {
  neutral: "text-nd-cyan border-nd-cyan/40 bg-nd-cyan/10",
  success: "text-nd-green border-nd-green/40 bg-nd-green/10",
  danger: "text-nd-magenta border-nd-magenta/40 bg-nd-magenta/10",
  gold: "text-nd-gold border-nd-gold/40 bg-nd-gold/10",
  hack: "text-nd-purple border-nd-purple/40 bg-nd-purple/10",
  tier: "text-nd-green border-nd-green/40 bg-nd-green/10",
};

const SIZE_CLASSES = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-1",
} as const;

/**
 * Display-only status badge. Color is never the only channel — always has a
 * text label (plus optional icon).
 */
export default function StatusBadge({ tone = "neutral", label, icon, size = "md" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-data uppercase tracking-widest border rounded-terminal ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]}`}
    >
      {icon}
      {label}
    </span>
  );
}
