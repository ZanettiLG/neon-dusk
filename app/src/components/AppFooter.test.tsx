import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppFooter from "@/components/AppFooter";

describe("AppFooter", () => {
  it("should render the tagline", () => {
    render(<AppFooter />);

    expect(
      screen.getByText("Monta teu cromo. Queima teu nome. Vira lenda."),
    ).toBeInTheDocument();
  });
});
