import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HumanityBar from "@/components/humanity/HumanityBar";
import type { HumanityInfo } from "@neon-dusk/shared";

// Issue #28 — Humanidade readout panel render tests. Presentational component:
// receives the HumanityInfo readout + an onRetry callback. Band labels come
// from the canonical BAND_LABELS map (lib/labels).

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
      clinic: { therapyType: "clinic", costMin: 5000, costMax: 20000, restoreMin: 10, restoreMax: 20 },
      attunement: { therapyType: "attunement", costMin: 2500, costMax: 10000, restoreMin: 5, restoreMax: 10 },
    },
    ...overrides,
  };
}

describe("HumanityBar", () => {
  it("should render the loading state (MetricBar skeleton)", () => {
    const { container } = render(
      <HumanityBar info={null} loading error={null} onRetry={vi.fn()} />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("should render the error state with a retry button", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(<HumanityBar info={null} loading={false} error="Falha ao carregar humanidade" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("should render nothing when there is no info yet", () => {
    const { container } = render(
      <HumanityBar info={null} loading={false} error={null} onRetry={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("should render the band label and the humanity meter", () => {
    render(<HumanityBar info={info({ humanity: 50, band: "instavel" })} loading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText("HUMANIDADE")).toBeInTheDocument();
    // The band label appears in the panel header AND in the MetricBar caption.
    expect(screen.getAllByText("Instável").length).toBeGreaterThan(0);
    expect(screen.getByRole("meter", { name: "Humanidade" })).toBeInTheDocument();
  });

  it("should render the cyberpsycho safety-net note", () => {
    render(<HumanityBar info={info({ humanity: 10, band: "cyberpsycho" })} loading={false} error={null} onRetry={vi.fn()} />);

    expect(screen.getByText(/perigo máximo. Rede de segurança ativa/)).toBeInTheDocument();
  });

  it("should render the flatline alert for an apagado character", () => {
    render(
      <HumanityBar
        info={info({ humanity: 0, band: "apagado", flatlined: true, flatlinedAt: "2026-08-29T10:00:00.000Z" })}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/FLATLINE — personagem apagado/)).toBeInTheDocument();
  });

  it("should render the scrubber regen status when installed", () => {
    render(
      <HumanityBar
        info={info({ scrubber: { installed: true, pendingRegen: 2, nextRegenAt: null, cap: 50 } })}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/Lavador Neural/)).toBeInTheDocument();
    expect(screen.getByText("+2 pendentes de regen.")).toBeInTheDocument();
  });

  it("should render the next-regen timestamp when no regen is pending", () => {
    render(
      <HumanityBar
        info={info({
          scrubber: {
            installed: true,
            pendingRegen: 0,
            nextRegenAt: new Date(Date.now() + 3_600_000).toISOString(),
            cap: 50,
          },
        })}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText(/Próximo \+1 em/)).toBeInTheDocument();
  });

  it("should render the cap notice when the scrubber is at its ceiling", () => {
    render(
      <HumanityBar
        info={info({ scrubber: { installed: true, pendingRegen: 0, nextRegenAt: null, cap: 50 } })}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("No teto do scrubber (50).")).toBeInTheDocument();
  });
});