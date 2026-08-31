import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  /** Error message; paints the border magenta and wires aria-invalid. */
  error?: string;
  /** Helper text rendered under the input (aria-describedby). */
  hint?: string;
  size?: "sm" | "md";
  /** Stretches the input to the full width of its container. */
  fullWidth?: boolean;
}

const SIZE_CLASSES = {
  sm: "px-2 py-1 text-nd-body-xs",
  md: "px-3 py-2 text-nd-body",
} as const;

/**
 * Text input with label, error and hint (issue #54). A11y wiring: label
 * htmlFor ↔ input id (useId), aria-invalid on error, aria-describedby for
 * error/hint with separate ids. Focus visibility comes from the global
 * :focus-visible ring (docs/design/05-design-tokens.md §10) — no outline
 * suppression here.
 */
export default function Input({
  label,
  error,
  hint,
  size = "md",
  fullWidth = false,
  id,
  className,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const errorId = useId();
  const hintId = useId();
  const inputId = id ?? generatedId;
  const describedBy =
    [error ? errorId : "", hint ? hintId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-nd-label font-data uppercase tracking-wider text-nd-text-secondary"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-terminal border bg-nd-surface font-body text-nd-text placeholder:text-nd-text-secondary/50 disabled:opacity-40 ${SIZE_CLASSES[size]} ${
          error ? "border-nd-magenta/60" : "border-nd-cyan/20"
        } ${fullWidth ? "w-full" : ""} ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error && (
        <p id={errorId} className="mt-1 text-xs font-data text-nd-magenta">
          ✗ {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-nd-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
