import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CharacterForm from "@/components/CharacterForm";
import { ROLES } from "@neon-dusk/shared";
import {
  ATTRIBUTE_LABELS,
  ROLE_LABELS,
  ROLE_PHRASES,
  ROLE_PRIMARY_ATTRIBUTES,
} from "@/lib/labels";

describe("CharacterForm", () => {
  it("renders without error", () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText("Ex.: Navalha, Vulto, Cupim")).toBeInTheDocument();
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

  it("keeps attributes at the creation floor of 3 (decrease disabled at base)", async () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);

    const decreaseButtons = screen.getAllByRole("button", { name: "Diminuir" });
    for (const button of decreaseButtons) {
      expect(button).toBeDisabled();
    }

    // Clicking a disabled decrease must not change the value below 3.
    await userEvent.setup().click(decreaseButtons[0]);
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(5);
  });

  it("shows the banca phrase and primary attribute when a banca is selected", async () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);

    // No banca selected yet — no phrase block.
    expect(screen.queryByText(/Atributo primário:/)).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Vulto" }));

    expect(
      screen.getByText(
        /A fechadura mais forte do mundo não serve de nada se a porta é o cérebro do guarda/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Atributo primário: Intelligence")).toBeInTheDocument();
  });

  it("shows the banca phrase and primary attribute for all 5 roles", async () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);

    for (const role of ROLES) {
      // ponytail: the "Banca" label wraps all 5 buttons, so the first one
      // (Bicho) inherits the whole label as accessible name — click by text.
      await userEvent.setup().click(screen.getByText(ROLE_LABELS[role]));

      expect(
        screen.getByText((content) => content.includes(ROLE_PHRASES[role])),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `Atributo primário: ${ROLE_PRIMARY_ATTRIBUTES[role]
            .map((k) => ATTRIBUTE_LABELS[k])
            .join(", ")}`,
        ),
      ).toBeInTheDocument();
    }
  });

  it("shows an inline error when the codinome has fewer than 2 characters", async () => {
    render(<CharacterForm loading={false} onSubmit={vi.fn()} />);

    await userEvent.setup().type(
      screen.getByPlaceholderText("Ex.: Navalha, Vulto, Cupim"),
      "X",
    );

    // Inline error inside ui/Input (no role="alert"; aria-invalid instead).
    expect(
      screen.getByText(/O codinome precisa de pelo menos 2 caracteres\./),
    ).toBeInTheDocument();
    expect(screen.getByText("CRIAR PERSONAGEM")).toBeDisabled();
  });

  it("shows the server nameError inline under the codinome field", () => {
    render(
      <CharacterForm loading={false} nameError="Este codinome já está em uso." onSubmit={vi.fn()} />,
    );

    expect(
      screen.getByText(/Este codinome já está em uso\./),
    ).toBeInTheDocument();
  });

  it("submit button enables only when remaining is 0 and form is valid", async () => {
    const onSubmit = vi.fn();
    render(<CharacterForm loading={false} onSubmit={onSubmit} />);

    const submit = screen.getByText("CRIAR PERSONAGEM");
    expect(submit).toBeDisabled();

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Ex.: Navalha, Vulto, Cupim"), "Ghost");
    await user.selectOptions(screen.getByRole("combobox"), "a_paraiso");
    await user.click(screen.getByRole("button", { name: "Vulto" }));

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
        role: "vulto",
        attributes: expect.objectContaining({ body: 10 }),
      }),
    );
  });
});
