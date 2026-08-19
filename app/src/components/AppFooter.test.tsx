import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppFooter from "@/components/AppFooter";

describe("AppFooter", () => {
  it("should render the tagline", () => {
    render(<AppFooter />);

    expect(
      screen.getByText("Build your cromo. Burn your name. Leave a legend."),
    ).toBeInTheDocument();
  });
});
