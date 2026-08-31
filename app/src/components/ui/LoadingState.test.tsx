import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingState from "./LoadingState";

describe("LoadingState", () => {
  it("should render N skeleton lines wrapped in aria-busy", () => {
    render(<LoadingState lines={4} />);
    const wrapper = document.querySelector('[aria-busy="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.querySelectorAll(".animate-pulse-neon")).toHaveLength(4);
  });

  it("should default to 3 skeleton lines", () => {
    render(<LoadingState />);
    expect(document.querySelectorAll(".animate-pulse-neon")).toHaveLength(3);
  });

  it("should pass skeletonClassName to every line", () => {
    render(<LoadingState lines={2} skeletonClassName="h-10 w-full" />);
    const lines = document.querySelectorAll(".animate-pulse-neon");
    expect(lines).toHaveLength(2);
    lines.forEach((line) => expect(line).toHaveClass("h-10", "w-full"));
  });

  it("should render the inline variant with the label", () => {
    render(<LoadingState variant="inline" label="processando" />);
    const status = screen.getByText("▌ processando...");
    expect(status).toBeInTheDocument();
    expect(status).toHaveClass("animate-pulse-neon", "font-data");
  });

  it("should use the default label for the inline variant", () => {
    render(<LoadingState variant="inline" />);
    expect(screen.getByText("▌ carregando...")).toBeInTheDocument();
  });
});
