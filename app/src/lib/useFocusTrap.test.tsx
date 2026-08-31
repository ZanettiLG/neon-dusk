import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import type { RefObject } from "react";
import { useFocusTrap } from "./useFocusTrap";

interface HarnessProps {
  active: boolean;
  onClose: () => void;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/** Renders a trap container with two focusables and a close button wired to
 *  closeAndRestore, mirroring how Modal consumes the hook. */
function Harness({ active, onClose, closeOnEscape, initialFocusRef }: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { closeAndRestore } = useFocusTrap({
    active,
    onClose,
    containerRef,
    initialFocusRef,
    closeOnEscape,
  });
  return (
    <div ref={containerRef}>
      <button type="button" onClick={closeAndRestore}>
        Fechar
      </button>
      <button type="button">Último</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("should focus the first focusable on activation", () => {
    render(<Harness active onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar" }));
  });

  it("should focus initialFocusRef when provided", () => {
    // initialFocusRef points at a node outside the harness container.
    function Outer() {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <>
          <input aria-label="Alvo" ref={inputRef} />
          <Harness active onClose={vi.fn()} initialFocusRef={inputRef} />
        </>
      );
    }
    render(<Outer />);
    expect(document.activeElement).toBe(screen.getByLabelText("Alvo"));
  });

  it("should cycle Tab at the edges", () => {
    render(<Harness active onClose={vi.fn()} />);
    const close = screen.getByRole("button", { name: "Fechar" });
    const last = screen.getByRole("button", { name: "Último" });

    // Tab from the last focusable wraps to the first.
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);

    // Shift+Tab from the first focusable wraps to the last.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("should call onClose on Escape when closeOnEscape=true", () => {
    const onClose = vi.fn();
    render(<Harness active onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should not call onClose on Escape when closeOnEscape=false", () => {
    const onClose = vi.fn();
    render(<Harness active closeOnEscape={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should restore focus to the opener via closeAndRestore", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Toggle</button>
        <Harness active={false} onClose={onClose} />
      </>,
    );
    const toggle = screen.getByRole("button", { name: "Toggle" });
    toggle.focus();

    rerender(
      <>
        <button type="button">Toggle</button>
        <Harness active onClose={onClose} />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar" }));

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(toggle);
  });

  it("should restore focus to the opener when deactivated programmatically (active=false)", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Toggle</button>
        <Harness active={false} onClose={onClose} />
      </>,
    );
    const toggle = screen.getByRole("button", { name: "Toggle" });
    toggle.focus();

    rerender(
      <>
        <button type="button">Toggle</button>
        <Harness active onClose={onClose} />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar" }));

    // Programmatic close: the parent flips active=false without calling
    // closeAndRestore — the cleanup must still hand focus back to the opener.
    rerender(
      <>
        <button type="button">Toggle</button>
        <Harness active={false} onClose={onClose} />
      </>,
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(toggle);
  });

  it("should remove the keydown listener and restore body overflow on deactivation", () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness active onClose={onClose} />);
    expect(document.body.style.overflow).toBe("hidden");

    rerender(<Harness active={false} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("");

    // The trap no longer intercepts Escape after deactivation.
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
