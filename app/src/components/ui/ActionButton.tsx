import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { formatCountdown } from "@/lib/format";
import type { ActionStatus } from "./types";

/**
 * Design contract (docs/design/05-design-tokens.md §ActionButton): when
 * status is "blocked", `blockReason` is REQUIRED and rendered in the DOM;
 * any other status forbids it (`blockReason?: never`).
 */
export type ActionButtonProps = {
  variant?: "default" | "danger" | "gold";
  /** Seconds left on cooldown; drives a local 1s countdown that resyncs on prop change. */
  cooldownRemainingS?: number;
  /** Prefix shown before the countdown while on cooldown. */
  cooldownLabel?: string;
  /** Error message; rendered with role="alert" while the button stays enabled. */
  errorMessage?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
} & (
  | { status?: Exclude<ActionStatus, "blocked">; blockReason?: never }
  | { status: "blocked"; blockReason: string }
);

const VARIANT_CLASSES = {
  default: "btn-neon",
  danger: "btn-danger",
  gold: "btn-neon border-nd-gold text-nd-gold bg-nd-gold/10 hover:bg-nd-gold/20 hover:shadow-neon-gold",
} as const;

/**
 * Primary action button with full status derivation: loading (spinner),
 * cooldown (live countdown), blocked (reason + aria-describedby) and error
 * (magenta border + alert message, still clickable for retry).
 */
export default function ActionButton({
  variant = "default",
  status = "default",
  cooldownRemainingS,
  cooldownLabel,
  blockReason,
  errorMessage,
  disabled = false,
  onClick,
  children,
}: ActionButtonProps) {
  const reasonId = useId();

  // Live countdown that resyncs whenever a new value is pushed (GigCard pattern).
  const [remaining, setRemaining] = useState(cooldownRemainingS ?? 0);
  useEffect(() => {
    setRemaining(cooldownRemainingS ?? 0);
    if ((cooldownRemainingS ?? 0) <= 0) return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        const next = Math.max(0, r - 1);
        // Stop ticking at zero so the interval doesn't live until the next resync.
        if (next <= 0) clearInterval(timer);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemainingS]);

  const isLoading = status === "loading";
  const isCooldown = status === "cooldown" && remaining > 0;
  const isBlocked = status === "blocked";
  const isError = status === "error";
  const isDisabled = disabled || isLoading || isCooldown || isBlocked;

  return (
    <>
      <button
        type="button"
        className={`chip-tap ${VARIANT_CLASSES[variant]} ${
          isError
            ? "border-nd-magenta text-nd-magenta bg-nd-magenta/10 hover:shadow-neon-magenta"
            : ""
        }`}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        aria-describedby={isBlocked && blockReason ? reasonId : undefined}
        onClick={onClick}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-nd-cyan/30 border-t-nd-cyan"
            />
            {children}
          </span>
        ) : isCooldown ? (
          `${cooldownLabel ?? "cooldown"} ${formatCountdown(remaining)}`
        ) : (
          children
        )}
      </button>
      {isBlocked && blockReason && (
        <span id={reasonId} className="text-nd-label font-data text-nd-magenta">
          ⛔ {blockReason}
        </span>
      )}
      {isError && errorMessage && (
        <span role="alert" className="text-nd-label font-data text-nd-magenta">
          ✗ {errorMessage}
        </span>
      )}
    </>
  );
}
