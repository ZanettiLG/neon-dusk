import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("should always render the label", () => {
    render(<StatusBadge label="Ativo" />);
    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });

  it.each([
    ["neutral", "text-nd-cyan"],
    ["success", "text-nd-green"],
    ["danger", "text-nd-magenta"],
    ["gold", "text-nd-gold"],
    ["hack", "text-nd-purple"],
    ["tier", "text-nd-green"],
  ] as const)("should apply %s tone class", (tone, cls) => {
    render(<StatusBadge tone={tone} label="X" />);
    expect(screen.getByText("X")).toHaveClass(cls);
  });

  it("should render optional icon", () => {
    render(<StatusBadge label="Ativo" icon={<span>★</span>} />);
    expect(screen.getByText("★")).toBeInTheDocument();
  });

  it("should apply size classes", () => {
    const { rerender } = render(<StatusBadge label="X" size="sm" />);
    expect(screen.getByText("X")).toHaveClass("text-nd-micro");
    rerender(<StatusBadge label="X" size="md" />);
    expect(screen.getByText("X")).toHaveClass("text-xs");
  });
});
