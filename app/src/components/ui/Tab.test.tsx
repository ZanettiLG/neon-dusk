import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tab from "./Tab";

describe("Tab", () => {
  it("should render with role=tab and be clickable when active", async () => {
    const onClick = vi.fn();
    render(<Tab state="active" onClick={onClick}>Gigs</Tab>);
    const tab = screen.getByRole("tab", { name: "Gigs" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toBeEnabled();
    await userEvent.setup().click(tab);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should render inactive tab with aria-selected false", () => {
    render(<Tab state="inactive">Gigs</Tab>);
    const tab = screen.getByRole("tab", { name: "Gigs" });
    expect(tab).toHaveAttribute("aria-selected", "false");
    expect(tab).toBeEnabled();
  });

  it("should disable and block onClick when disabled", async () => {
    const onClick = vi.fn();
    render(<Tab state="disabled" onClick={onClick}>Gigs</Tab>);
    const tab = screen.getByRole("tab", { name: "Gigs" });
    expect(tab).toBeDisabled();
    expect(tab).toHaveAttribute("aria-disabled", "true");
    await userEvent.setup().click(tab);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should expose disabledReason via title and sr-only description", () => {
    render(<Tab state="disabled" disabledReason="Requer nível 5">Gigs</Tab>);
    const tab = screen.getByRole("tab");
    // pointer tooltip
    expect(tab).toHaveAttribute("title", "Requer nível 5");
    // AT announcement via aria-describedby → sr-only text present in the DOM
    const describedBy = tab.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reasonEl = document.getElementById(describedBy!);
    expect(reasonEl).toHaveTextContent("Requer nível 5");
    expect(reasonEl).toHaveClass("sr-only");
  });

  it("should not render a description when disabled without disabledReason", () => {
    render(<Tab state="disabled">Gigs</Tab>);
    const tab = screen.getByRole("tab");
    expect(tab).not.toHaveAttribute("aria-describedby");
    expect(tab).not.toHaveAttribute("title");
  });

  it("should apply active class", () => {
    render(<Tab state="active">Gigs</Tab>);
    expect(screen.getByRole("tab")).toHaveClass("border-nd-cyan");
  });
});
