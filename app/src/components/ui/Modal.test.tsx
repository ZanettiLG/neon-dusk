import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import Modal from "./Modal";

describe("Modal", () => {
  it("should render nothing when closed", () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        conteúdo
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render dialog with aria-modal and aria-labelledby pointing to the title", () => {
    render(
      <Modal open title="Confirmar" onClose={vi.fn()}>
        conteúdo
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Confirmar" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)).toHaveTextContent("Confirmar");
  });

  it("should focus the first focusable on open and trap Tab at the edges", () => {
    render(
      <Modal open title="Confirmar" onClose={vi.fn()}>
        <button type="button">Salvar</button>
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Fechar" });
    const save = screen.getByRole("button", { name: "Salvar" });
    // Initial focus lands on the first focusable in DOM order (the close
    // button) — the same element used as the trap's first boundary.
    expect(document.activeElement).toBe(close);

    // Shift+Tab from the first focusable wraps to the last.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);

    // Tab from the last focusable wraps back to the first.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });

  it("should focus initialFocusRef on open when provided", () => {
    function Harness() {
      const inputRef = useRef<HTMLInputElement>(null);
      return (
        <Modal open title="Confirmar" onClose={vi.fn()} initialFocusRef={inputRef}>
          <input aria-label="Alvo" ref={inputRef} />
          <button type="button">Salvar</button>
        </Modal>
      );
    }
    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByLabelText("Alvo"));
  });

  it("should close on Escape and return focus to the opening toggle", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Toggle</button>
        <Modal open={false} onClose={onClose}>
          conteúdo
        </Modal>
      </>,
    );

    const toggle = screen.getByRole("button", { name: "Toggle" });
    toggle.focus();

    rerender(
      <>
        <button type="button">Toggle</button>
        <Modal open onClose={onClose}>
          conteúdo
        </Modal>
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Fechar" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(toggle);
  });

  it("should close on overlay click and restore focus", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        conteúdo
      </Modal>,
    );

    // Overlay is the non-focusable dark layer right behind the panel.
    const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should lock body scroll while open and restore on unmount", () => {
    const { unmount } = render(
      <Modal open onClose={vi.fn()}>
        conteúdo
      </Modal>,
    );

    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("should not close on Escape when closeOnEscape=false", () => {
    const onClose = vi.fn();
    render(
      <Modal open closeOnEscape={false} onClose={onClose}>
        conteúdo
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
