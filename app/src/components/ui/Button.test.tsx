import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "./Button";

describe("Button", () => {
  it("should render children, default to type=button and call onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Executar</Button>);
    const btn = screen.getByRole("button", { name: "Executar" });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.setup().click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should disable, set aria-busy and show a spinner while loading", () => {
    render(<Button loading>Executar</Button>);
    const btn = screen.getByRole("button", { name: "Executar" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    const spinner = btn.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute("aria-hidden", "true");
  });

  it("should respect the explicit disabled prop", () => {
    render(<Button disabled>Executar</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should apply variant classes", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-neon");

    rerender(<Button variant="danger">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-danger");

    rerender(<Button variant="gold">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("btn-neon");
    expect(screen.getByRole("button")).toHaveClass("border-nd-gold");
    expect(screen.getByRole("button")).toHaveClass("text-nd-gold");
    expect(screen.getByRole("button")).toHaveClass("bg-nd-gold/10");

    rerender(<Button variant="ghost">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("text-nd-text-secondary");
    expect(screen.getByRole("button")).toHaveClass("hover:text-nd-text");
  });

  it("should apply size and fullWidth classes", () => {
    const { rerender } = render(<Button size="sm">A</Button>);
    expect(screen.getByRole("button")).toHaveClass("px-3", "py-1", "text-xs");

    rerender(<Button fullWidth>A</Button>);
    expect(screen.getByRole("button")).toHaveClass("w-full");
  });
});
