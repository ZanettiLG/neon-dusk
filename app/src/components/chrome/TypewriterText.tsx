import { useEffect, useRef, useState } from "react";

interface TypewriterTextProps {
  text: string;
  /** ms per character; ignored under prefers-reduced-motion (full text immediately). */
  speedMs?: number;
  className?: string;
}

/** jsdom-safe guard for prefers-reduced-motion (RollTheater pattern). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Diegetic terminal log typing: reveals `text` one character per `speedMs`.
 * Under prefers-reduced-motion the full text renders instantly (motion is
 * decorative — the text content is the same either way).
 */
export default function TypewriterText({ text, speedMs = 24, className }: TypewriterTextProps) {
  const mountedRef = useRef(true);
  const [count, setCount] = useState(() => (prefersReducedMotion() ? text.length : 0));

  useEffect(() => {
    mountedRef.current = true;
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const timer = window.setInterval(() => {
      if (!mountedRef.current) return;
      setCount((c) => {
        const next = c + 1;
        if (next >= text.length) window.clearInterval(timer);
        return Math.min(next, text.length);
      });
    }, speedMs);
    return () => {
      window.clearInterval(timer);
      mountedRef.current = false;
    };
  }, [text, speedMs]);

  return <span className={className}>{text.slice(0, count)}</span>;
}
