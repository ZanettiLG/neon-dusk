import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorState from "./ErrorState";

describe("ErrorState", () => {
  it("should render role=alert with the default message", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toHaveTextContent("Erro ao carregar.");
  });

  it("should render the provided message", () => {
    render(<ErrorState message="Falha na operação." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falha na operação.");
  });

  it("should trigger onRetry with the retryLabel", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Falha." onRetry={onRetry} retryLabel="Tentar outra vez" />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar outra vez" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should not render a retry button without onRetry", () => {
    render(<ErrorState message="Falha." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
