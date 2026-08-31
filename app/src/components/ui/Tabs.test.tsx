import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs from "./Tabs";
import Tab from "./Tab";
import TabPanel from "./TabPanel";

function renderDefaultTabs() {
  return render(
    <Tabs ariaLabel="Seções" defaultValue="a">
      <Tab value="a">Alpha</Tab>
      <Tab value="b">Beta</Tab>
      <Tab value="c">Gama</Tab>
      <TabPanel value="a">Painel Alpha</TabPanel>
      <TabPanel value="b">Painel Beta</TabPanel>
      <TabPanel value="c">Painel Gama</TabPanel>
    </Tabs>,
  );
}

/** Panel wired to a tab via aria-controls (hidden panels lose their computed
 *  accessible name, so DOM lookup by id is the reliable handle here). */
function panelFor(tab: HTMLElement): HTMLElement {
  const id = tab.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  return document.getElementById(id!) as HTMLElement;
}

describe("Tabs", () => {
  it("should render tabs with roving tabindex and panels from defaultValue", () => {
    renderDefaultTabs();
    const tabA = screen.getByRole("tab", { name: "Alpha" });
    const tabB = screen.getByRole("tab", { name: "Beta" });
    const tabG = screen.getByRole("tab", { name: "Gama" });
    expect(tabA).toHaveAttribute("aria-selected", "true");
    expect(tabA).toHaveAttribute("tabindex", "0");
    expect(tabB).toHaveAttribute("aria-selected", "false");
    expect(tabB).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tabpanel", { name: "Alpha" })).toBeVisible();
    expect(panelFor(tabB)).toHaveAttribute("hidden");
    expect(panelFor(tabG)).toHaveAttribute("hidden");
  });

  it("should switch selection and panels on click", async () => {
    renderDefaultTabs();
    await userEvent.setup().click(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel", { name: "Beta" })).toBeVisible();
    expect(panelFor(screen.getByRole("tab", { name: "Alpha" }))).toHaveAttribute("hidden");
  });

  it("should support controlled mode via onValueChange", async () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Tabs ariaLabel="Seções" value="a" onValueChange={onValueChange}>
        <Tab value="a">Alpha</Tab>
        <Tab value="b">Beta</Tab>
        <TabPanel value="a">Painel Alpha</TabPanel>
        <TabPanel value="b">Painel Beta</TabPanel>
      </Tabs>,
    );

    await userEvent.setup().click(screen.getByRole("tab", { name: "Beta" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
    // Controlled: the value prop still wins until the parent updates.
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");

    rerender(
      <Tabs ariaLabel="Seções" value="b" onValueChange={onValueChange}>
        <Tab value="a">Alpha</Tab>
        <Tab value="b">Beta</Tab>
        <TabPanel value="a">Painel Alpha</TabPanel>
        <TabPanel value="b">Painel Beta</TabPanel>
      </Tabs>,
    );
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
  });

  it("should navigate with ArrowRight/ArrowLeft and select", () => {
    renderDefaultTabs();
    const tabA = screen.getByRole("tab", { name: "Alpha" });
    tabA.focus();

    fireEvent.keyDown(tabA, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Beta" }));

    fireEvent.keyDown(screen.getByRole("tab", { name: "Beta" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Alpha" }));
  });

  it("should wrap at the edges and support Home/End", () => {
    renderDefaultTabs();
    const tabA = screen.getByRole("tab", { name: "Alpha" });
    tabA.focus();

    // ArrowLeft from the first tab wraps to the last.
    fireEvent.keyDown(tabA, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gama" }));

    fireEvent.keyDown(screen.getByRole("tab", { name: "Gama" }), { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Alpha" }));

    fireEvent.keyDown(screen.getByRole("tab", { name: "Alpha" }), { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gama" }));
  });

  it("should skip disabled tabs in navigation and clicks", async () => {
    render(
      <Tabs ariaLabel="Seções" defaultValue="a">
        <Tab value="a">Alpha</Tab>
        <Tab value="b" state="disabled">
          Beta
        </Tab>
        <Tab value="c">Gama</Tab>
        <TabPanel value="a">Painel Alpha</TabPanel>
        <TabPanel value="b">Painel Beta</TabPanel>
        <TabPanel value="c">Painel Gama</TabPanel>
      </Tabs>,
    );

    const tabA = screen.getByRole("tab", { name: "Alpha" });
    tabA.focus();

    // ArrowRight skips the disabled Beta and lands on Gama.
    fireEvent.keyDown(tabA, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Gama" }));
    expect(screen.getByRole("tab", { name: "Gama" })).toHaveAttribute("aria-selected", "true");

    // Clicking the disabled tab never selects it.
    await userEvent.setup().click(screen.getByRole("tab", { name: "Beta" }));
    expect(screen.getByRole("tab", { name: "Gama" })).toHaveAttribute("aria-selected", "true");
  });

  it("should wire aria-controls and aria-labelledby across tabs and panels", () => {
    render(
      <Tabs ariaLabel="Seções" defaultValue="a">
        <Tab value="a">Alpha</Tab>
        <TabPanel value="a">Painel Alpha</TabPanel>
      </Tabs>,
    );
    const tab = screen.getByRole("tab", { name: "Alpha" });
    const panel = screen.getByRole("tabpanel", { name: "Alpha" });

    const controls = tab.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(panel.id).toBe(controls);

    const labelledBy = panel.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(tab.id).toBe(labelledBy);
  });
});
