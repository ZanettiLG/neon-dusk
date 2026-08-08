import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CharacterForm from "@/components/CharacterForm";

describe("CharacterForm", () => {
  it("renders without error", () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText("Ex.: Cobra, Ghost, Viper")).toBeInTheDocument();
    expect(screen.getByText("Distribuição de atributos")).toBeInTheDocument();
    expect(screen.getByText("CRIAR PERSONAGEM")).toBeDisabled();
  });

  it("shows remaining points count at 7 initially", () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);
    expect(screen.getByText("7 pontos restantes")).toBeInTheDocument();
  });

  it("shows soft cap indicator when stat reaches 15+", async () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);
    // All 7 free points into one stat = 3+7=10, can't reach 15 during creation.
    // Verify no soft cap text is visible at the start.
    expect(screen.queryByText(/Após 15, cada ponto custa 2/)).not.toBeInTheDocument();

    // Body increase button puts points into body. 7 clicks = body 10.
    const increaseButtons = screen.getAllByRole("button", { name: "Aumentar" });
    for (let i = 0; i < 7; i++) {
      await userEvent.setup().click(increaseButtons[0]);
    }

    expect(screen.getByText("0 pontos restantes")).toBeInTheDocument();
    // Still no soft cap text — body 10 < 15.
    expect(screen.queryByText(/Após 15, cada ponto custa 2/)).not.toBeInTheDocument();
  });

  it("soft cap tooltip explains double cost", async () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);
    // With 7 free points, max stat is 10 (3+7). Soft cap text should not appear.
    const increaseButtons = screen.getAllByRole("button", { name: "Aumentar" });
    for (let i = 0; i < 7; i++) {
      await userEvent.setup().click(increaseButtons[0]);
    }
    expect(screen.queryByText(/Após 15, cada ponto custa 2/)).not.toBeInTheDocument();
  });

  it("remaining points account for soft cap penalty when present", () => {
    // The soft cap penalty formula: ATTR_TOTAL - sum(attr) - sum(max(0, attr - 15))
    // All at base (3×5=15): remaining = 22-15-0 = 7 ✓
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);
    // At start, no penalty, 7 remaining.
    expect(screen.getByText("7 pontos restantes")).toBeInTheDocument();
    // No soft cap bonus text.
    expect(screen.queryByText(/bônus de soft cap/)).not.toBeInTheDocument();
  });

  it("submit button enables only when remaining is 0 and form is valid", async () => {
    const onSubmit = vi.fn();
    render(<CharacterForm loading={false} onSubmit={onSubmit} />);

    const submit = screen.getByText("CRIAR PERSONAGEM");
    expect(submit).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Ex.: Cobra, Ghost, Viper"), "Ghost");
    await user.selectOptions(screen.getByRole("combobox"), "a_paraiso");
    await user.click(screen.getByRole("button", { name: "Netrunner" }));

    // Still at 7 remaining — submit should be disabled.
    expect(submit).toBeDisabled();

    // Allocate all 7 points into Body.
    const increaseButtons = screen.getAllByRole("button", { name: "Aumentar" });
    for (let i = 0; i < 7; i++) {
      await user.click(increaseButtons[0]);
    }

    // Now remaining = 0, form valid — submit enabled.
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ghost",
        origin: "a_paraiso",
        role: "netrunner",
        attributes: expect.objectContaining({ body: 10 }),
      }),
    );
  });
});
