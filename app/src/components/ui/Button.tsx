import type { ReactNode } from "react";

export interface ButtonProps {
  variant?: "primary" | "danger" | "gold" | "ghost";
  size?: "sm" | "md";
  /** Renders a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  disabled?: boolean;
  /** Stretches the button to the full width of its container. */
  fullWidth?: boolean;
  onClick?: () => void;
  /** Native type, defaults to "button" (never submits a form by accident). */
  type?: "button" | "submit" | "reset";
  /** Extra classes appended after the variant/size classes. */
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASSES = {
  primary: "btn-neon",
  danger: "btn-danger",
  gold: "btn-neon border-nd-gold text-nd-gold bg-nd-gold/10 hover:bg-nd-gold/20 hover:shadow-neon-gold",
  ghost: "text-nd-text-secondary hover:text-nd-text",
} as const;

/** Size utilities live in the utilities layer, so they override the
 * component-layer padding/type of btn-neon/btn-danger (utilities beat
 * components in Tailwind's cascade). */
const SIZE_CLASSES = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

/**
 * Base action button (issue #54): four variants on the neon palette, sm/md
 * sizes, loading spinner with aria-busy, optional full width and a native
 * type="button". For status-driven flows (cooldown, blocked, error) use
 * ActionButton instead.
 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = "button",
  className,
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`chip-tap inline-flex items-center justify-center rounded-terminal font-heading uppercase tracking-wider transition-all ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className ?? ""}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-nd-cyan/30 border-t-nd-cyan"
          />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
