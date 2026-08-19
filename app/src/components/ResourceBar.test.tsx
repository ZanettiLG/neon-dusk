import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResourceBar from "@/components/ResourceBar";

// ND-139 — ResourceBar: value/max readout, width by percent, color band +
// band label (color is never the only channel), optional etaText/action slots.

describe("ResourceBar", () => {
  it("should render the label and value/max text", () => {
    render(<ResourceBar label="NIL // CARGA NEURAL" value={80} max={100} resource="nil" />);

    expect(screen.getByText("NIL // CARGA NEURAL")).toBeInTheDocument();
    expect(screen.getByText("80 / 100")).toBeInTheDocument();
  });

  it("should size the fill bar by the percentage", () => {
    const { container } = render(
      <ResourceBar label="NIL" value={80} max={100} resource="nil" />,
    );

    expect(container.querySelector(".bg-nd-cyan")).toHaveStyle({ width: "80%" });
  });

  it("should label a low NIL as crítico and a high NIL as estável", () => {
    const low = render(<ResourceBar label="NIL" value={20} max={100} resource="nil" />);
    expect(low.container.querySelector(".bg-nd-magenta")).toHaveStyle({ width: "20%" });
    expect(low.getByText("crítico")).toBeInTheDocument();

    const high = render(<ResourceBar label="NIL" value={80} max={100} resource="nil" />);
    expect(high.getByText("estável")).toBeInTheDocument();
  });

  it("should label humanity bands by the cyberpsychosis thresholds", () => {
    const unstable = render(
      <ResourceBar label="HUMANIDADE" value={50} max={100} resource="humanity" />,
    );
    expect(unstable.container.querySelector(".bg-nd-gold")).toHaveStyle({ width: "50%" });
    expect(unstable.getByText("Instável")).toBeInTheDocument();

    const integral = render(
      <ResourceBar label="HUMANIDADE" value={100} max={100} resource="humanity" />,
    );
    expect(integral.container.querySelector(".bg-nd-green")).toHaveStyle({ width: "100%" });
    expect(integral.getByText("Íntegro")).toBeInTheDocument();
  });

  it("should render the etaText hint when provided and omit it otherwise", () => {
    const { rerender } = render(
      <ResourceBar label="NIL" value={80} max={100} resource="nil" etaText="Próximo +1 em 4 min" />,
    );
    expect(screen.getByText("Próximo +1 em 4 min")).toBeInTheDocument();

    rerender(<ResourceBar label="NIL" value={80} max={100} resource="nil" />);
    expect(screen.queryByText("Próximo +1 em 4 min")).not.toBeInTheDocument();
  });

  it("should render the action slot when provided", () => {
    render(
      <ResourceBar
        label="NIL"
        value={80}
        max={100}
        resource="nil"
        action={<button>PINGADO</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "PINGADO" })).toBeInTheDocument();
  });
});
