import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TherapyPanel from "@/components/humanity/TherapyPanel";
import type { HumanityInfo } from "@neon-dusk/shared";

// Issue #28 — Terapia panel render tests. Presentational component: receives
// the HumanityInfo readout + an onTherapy callback; the server stays
// authoritative on cost, restore and cooldown.

function info(overrides: Partial<HumanityInfo> = {}): HumanityInfo {
  return {
    humanity: 50,
    band: "instavel",
    flatlined: false,
    flatlinedAt: null,
    scrubber: { installed: false, pendingRegen: 0, nextRegenAt: null, cap: 50 },
    therapy: {
      lastCompletedAt: null,
      nextAvailableAt: null,
      cooldownRemainingMs: 0,
      clinic: {
        therapyType: "clinic",
        costMin: 5000,
        costMax: 20000,
        restoreMin: 10,
        restoreMax: 20,
      },
      attunement: {
        therapyType: "attunement",
        costMin: 2500,
        costMax: 10000,
        restoreMin: 5,
        restoreMax: 10,
      },
    },
    ...overrides,
  };
}

describe("TherapyPanel", () => {
  it("should render the loading state", () => {
    render(<TherapyPanel info={null} loading error={null} onTherapy={vi.fn()} />);

    expect(screen.getByText(/loading/)).toBeInTheDocument();
  });

  it("should render the error state", () => {
    render(
      <TherapyPanel info={null} loading={false} error="Falha na terapia" onTherapy={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Falha na terapia")).toBeInTheDocument();
  });

  it("should render nothing when there is no info yet", () => {
    const { container } = render(
      <TherapyPanel info={null} loading={false} error={null} onTherapy={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("should render both modality cards with cost/restore ranges", () => {
    render(<TherapyPanel info={info()} loading={false} error={null} onTherapy={vi.fn()} />);

    expect(screen.getByText("TERAPIA")).toBeInTheDocument();
    expect(screen.getByText("Clínica")).toBeInTheDocument();
    expect(screen.getByText("Sintonia")).toBeInTheDocument();
    expect(screen.getByText("G$ 5.000–G$ 20.000")).toBeInTheDocument();
    expect(screen.getByText("G$ 2.500–G$ 10.000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sessão (Clínica)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sessão (Sintonia)" })).toBeInTheDocument();
  });

  it("should show the cooldown label and disable both buttons while the anti-spam window runs", () => {
    render(
      <TherapyPanel
        info={info({
          therapy: {
            ...info().therapy,
            cooldownRemainingMs: 3_600_000,
            nextAvailableAt: new Date(Date.now() + 3_600_000).toISOString(),
          },
        })}
        loading={false}
        error={null}
        onTherapy={vi.fn()}
      />,
    );

    expect(screen.getByText(/Disponível em/)).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "Em cooldown" });
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it("should disable both buttons for a flatlined character", () => {
    render(
      <TherapyPanel
        info={info({ flatlined: true })}
        loading={false}
        error={null}
        onTherapy={vi.fn()}
      />,
    );

    expect(screen.getByText(/Personagem apagado — terapia indisponível/)).toBeInTheDocument();
    const clinic = screen.getByRole("button", { name: "Sessão (Clínica)" });
    const attunement = screen.getByRole("button", { name: "Sessão (Sintonia)" });
    expect(clinic).toBeDisabled();
    expect(attunement).toBeDisabled();
  });

  it("should call onTherapy with the selected modality", async () => {
    const onTherapy = vi.fn().mockResolvedValue({});
    const user = userEvent.setup();

    render(<TherapyPanel info={info()} loading={false} error={null} onTherapy={onTherapy} />);

    await user.click(screen.getByRole("button", { name: "Sessão (Clínica)" }));
    expect(onTherapy).toHaveBeenCalledWith("clinic");

    await user.click(screen.getByRole("button", { name: "Sessão (Sintonia)" }));
    expect(onTherapy).toHaveBeenCalledWith("attunement");
  });
});
