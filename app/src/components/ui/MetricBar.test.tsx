import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MetricBar from "./MetricBar";

describe("MetricBar", () => {
  it("should render a meter with label and value", () => {
    render(<MetricBar resource="nil" value={50} label="NIL" />);
    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-label", "NIL");
    expect(meter).toHaveAttribute("aria-valuenow", "50");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("NIL")).toBeInTheDocument();
  });

  it("should apply the correct fill class and band label per band", () => {
    const { rerender } = render(<MetricBar resource="nil" value={10} label="NIL" />);
    // 10 → crítico (bg-nd-magenta)
    expect(screen.getByText("· crítico")).toBeInTheDocument();
    expect(screen.getByRole("meter").querySelector("div")).toHaveClass("bg-nd-magenta");

    rerender(<MetricBar resource="nil" value={50} label="NIL" />);
    // 50 → atenção (bg-nd-gold)
    expect(screen.getByText("· atenção")).toBeInTheDocument();
    expect(screen.getByRole("meter").querySelector("div")).toHaveClass("bg-nd-gold");

    rerender(<MetricBar resource="nil" value={90} label="NIL" />);
    // 90 → estável (bg-nd-cyan)
    expect(screen.getByText("· estável")).toBeInTheDocument();
    expect(screen.getByRole("meter").querySelector("div")).toHaveClass("bg-nd-cyan");
  });

  it("should clamp value below 0 to 0", () => {
    render(<MetricBar resource="nil" value={-20} label="NIL" />);
    // percent clamped to 0 → crítico band (fill width 0%)
    expect(screen.getByText("· crítico")).toBeInTheDocument();
    expect(screen.getByRole("meter").querySelector("div")).toHaveStyle({ width: "0%" });
  });

  it("should clamp value above max to 100", () => {
    render(<MetricBar resource="nil" value={200} label="NIL" />);
    // percent clamped to 100 → estável band
    expect(screen.getByText("· estável")).toBeInTheDocument();
  });

  it("should apply pulse class when band has pulse flag", () => {
    // humanity 10 → Cyberpsycho band (pulse: true)
    render(<MetricBar resource="humanity" value={10} label="HUM" />);
    expect(screen.getByRole("meter").querySelector("div")).toHaveClass("animate-pulse-neon");
  });

  it("should not pulse when band has no pulse flag", () => {
    render(<MetricBar resource="nil" value={50} label="NIL" />);
    expect(screen.getByRole("meter").querySelector("div")).not.toHaveClass("animate-pulse-neon");
  });

  it("should render meter with value 0 when value is undefined", () => {
    render(<MetricBar resource="nil" label="NIL" />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
    // undefined value → safeValue 0 → crítico band
    expect(screen.getByText("· crítico")).toBeInTheDocument();
  });

  it("should show loading skeleton with aria-busy", () => {
    render(<MetricBar resource="nil" label="NIL" status="loading" />);
    expect(screen.queryByText("NIL")).not.toBeInTheDocument();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(document.querySelector(".animate-pulse-neon")).toBeInTheDocument();
  });

  it("should show error alert", () => {
    render(<MetricBar resource="nil" label="NIL" status="error" />);
    expect(screen.getByRole("alert")).toHaveTextContent("erro ao carregar");
  });

  it("should show empty message", () => {
    render(<MetricBar resource="nil" label="NIL" status="empty" />);
    expect(screen.getByText("sem dados")).toBeInTheDocument();
  });

  it("should use custom bands when provided", () => {
    const bands = [
      { min: 0, max: 49, color: "bg-nd-green", label: "baixo" },
      { min: 50, max: 100, color: "bg-nd-magenta", label: "alto" },
    ];
    render(<MetricBar bands={bands} value={80} label="CUSTOM" />);
    expect(screen.getByText("· alto")).toBeInTheDocument();
    expect(screen.getByRole("meter").querySelector("div")).toHaveClass("bg-nd-magenta");
  });

  it("should render label always alongside the color", () => {
    render(<MetricBar resource="nil" value={50} label="NIL" />);
    // label + numeric value + band label are all present (color is never the only channel)
    expect(screen.getByText("NIL")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("· atenção")).toBeInTheDocument();
  });
});
