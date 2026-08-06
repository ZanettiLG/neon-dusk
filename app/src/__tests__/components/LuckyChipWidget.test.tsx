import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import LuckyChipWidget from "@/components/LuckyChipWidget";

// Feature ND-008 — Lucky Chip widget. The component awaits a 600ms "roll
// animation" setTimeout after the API call, so these tests run under fake
// timers and advance past it inside `act` (React schedules its render on a
// macrotask that timer-advancing alone doesn't await).
//
// The bet input is queried via getByRole("spinbutton"): the widget's <label>
// has no htmlFor/id association, so getByLabelText can't find the control
// (accessibility gap — noted in the handoff).

const mocks = vi.hoisted(() => ({
  api: { post: vi.fn() },
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

// The mocked module's ApiError class — dynamically imported so tests can build
// real instances that satisfy the widget's `err instanceof ApiError` branch.
async function makeApiError(status: number, code: string, message: string): Promise<Error> {
  const { ApiError } = await import("@/api/client");
  return new ApiError(status, code, message);
}

function betInput() {
  return screen.getByRole("spinbutton") as HTMLInputElement;
}

function rollButton() {
  return screen.getByRole("button", { name: "ROLL D20" });
}

/** Click ROLL D20 and advance past the 600ms roll animation, flushing renders. */
async function roll(): Promise<void> {
  await act(async () => {
    fireEvent.click(rollButton());
    await vi.advanceTimersByTimeAsync(600);
  });
}

describe("LuckyChipWidget", () => {
  beforeEach(() => {
    mocks.api.post.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render the title and default bet of 10", () => {
    render(<LuckyChipWidget />);

    expect(screen.getByText("CASSINO // LUCKY CHIP")).toBeInTheDocument();
    expect(betInput()).toHaveValue(10);
    expect(rollButton()).toBeInTheDocument();
  });

  it("should show a placeholder balance before the first roll", () => {
    render(<LuckyChipWidget />);
    expect(screen.getByText("Saldo: —")).toBeInTheDocument();
  });

  it("should disable the button when the bet is empty", () => {
    render(<LuckyChipWidget />);

    fireEvent.change(betInput(), { target: { value: "" } });

    expect(rollButton()).toBeDisabled();
  });

  it("should disable the button when the bet is below 1", () => {
    render(<LuckyChipWidget />);

    fireEvent.change(betInput(), { target: { value: "0" } });

    expect(rollButton()).toBeDisabled();
  });

  it("should call the API with the parsed bet on roll", async () => {
    mocks.api.post.mockResolvedValue({ roll: 15, won: true, payout: 20, balance: 1010 });
    render(<LuckyChipWidget />);

    await roll();

    expect(mocks.api.post).toHaveBeenCalledTimes(1);
    expect(mocks.api.post).toHaveBeenCalledWith("/api/game/lucky-chip", { bet: 10 });
  });

  it("should not call the API when the bet is invalid", () => {
    render(<LuckyChipWidget />);
    fireEvent.change(betInput(), { target: { value: "0" } });

    fireEvent.click(rollButton());

    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should show the loading state while rolling and disable the controls", async () => {
    mocks.api.post.mockReturnValue(new Promise(() => {})); // never resolves
    render(<LuckyChipWidget />);

    await act(async () => {
      fireEvent.click(rollButton());
    });

    expect(screen.getByRole("button", { name: "ROLANDO..." })).toBeDisabled();
    expect(betInput()).toBeDisabled();
  });

  it("should display a win result with the win colors", async () => {
    mocks.api.post.mockResolvedValue({ roll: 15, won: true, payout: 20, balance: 1010 });
    render(<LuckyChipWidget />);

    await roll();

    expect(screen.getByText("15")).toBeInTheDocument();
    const ganhou = screen.getByText("GANHOU +20 €$");
    expect(ganhou).toHaveClass("text-nd-cyan");
    expect(ganhou.parentElement).toHaveClass("border-nd-cyan/40");
    expect(screen.getByText("Saldo: 1010 €$")).toBeInTheDocument();
  });

  it("should display a loss result with the loss colors", async () => {
    mocks.api.post.mockResolvedValue({ roll: 5, won: false, payout: 0, balance: 990 });
    render(<LuckyChipWidget />);

    await roll();

    expect(screen.getByText("5")).toBeInTheDocument();
    const perdeu = screen.getByText("PERDEU");
    expect(perdeu).toHaveClass("text-nd-magenta");
    expect(perdeu.parentElement).toHaveClass("border-nd-magenta/40");
    expect(screen.getByText("Saldo: 990 €$")).toBeInTheDocument();
  });

  it("should update the displayed balance after a successful roll", async () => {
    mocks.api.post.mockResolvedValue({ roll: 11, won: true, payout: 20, balance: 1010 });
    render(<LuckyChipWidget />);

    expect(screen.getByText("Saldo: —")).toBeInTheDocument();

    await roll();

    expect(screen.getByText("Saldo: 1010 €$")).toBeInTheDocument();
    expect(screen.queryByText("Saldo: —")).not.toBeInTheDocument();
  });

  it("should display the ApiError message on failure", async () => {
    mocks.api.post.mockRejectedValue(
      await makeApiError(400, "INVALID_BET", "Not enough eddies (have 1000, need 1001)"),
    );
    render(<LuckyChipWidget />);

    await roll();

    expect(screen.getByText("Not enough eddies (have 1000, need 1001)")).toBeInTheDocument();
  });

  it("should show a generic message when the failure is not an ApiError", async () => {
    mocks.api.post.mockRejectedValue(new Error("network down"));
    render(<LuckyChipWidget />);

    await roll();

    expect(screen.getByText("Falha na conexão")).toBeInTheDocument();
  });
});
