import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TabPanel from "./TabPanel";

describe("TabPanel", () => {
  it("should render role=tabpanel with tabIndex 0 and children", () => {
    render(<TabPanel value="a">conteúdo</TabPanel>);
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("should wire id and aria-labelledby when injected by Tabs", () => {
    render(
      <TabPanel value="a" id="panel-1" aria-labelledby="tab-1">
        conteúdo
      </TabPanel>,
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("id", "panel-1");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-1");
  });

  it("should be hidden when the hidden prop is set", () => {
    render(
      <TabPanel value="a" hidden>
        conteúdo
      </TabPanel>,
    );
    // Hidden panels drop out of the accessibility tree, so query with hidden:true.
    expect(screen.getByRole("tabpanel", { hidden: true })).toHaveAttribute("hidden");
  });
});