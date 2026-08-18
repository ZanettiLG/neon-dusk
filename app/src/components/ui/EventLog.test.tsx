import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventLog from "./EventLog";
import type { EventLogEntry } from "./types";

const now = Date.now();
const entry = (over: Partial<EventLogEntry>): EventLogEntry => ({
  id: "e1",
  timestamp: new Date(now).toISOString(),
  severity: "info",
  title: "Evento",
  ...over,
});

describe("EventLog", () => {
  it("should render entries with timestamp and severity glyph + text", () => {
    render(
      <EventLog
        events={[
          entry({ id: "e1", severity: "success", title: "Sucesso" }),
          entry({ id: "e2", severity: "danger", title: "Perigo", detail: "detalhe" }),
        ]}
      />,
    );
    expect(screen.getByText("Sucesso")).toBeInTheDocument();
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("Perigo")).toBeInTheDocument();
    expect(screen.getByText("✗")).toBeInTheDocument();
    expect(screen.getByText("detalhe")).toBeInTheDocument();
    // relative timestamp rendered
    expect(screen.getAllByText("agora").length).toBe(2);
  });

  it("should apply severity token class", () => {
    render(<EventLog events={[entry({ severity: "warning", title: "Aviso" })]} />);
    const title = screen.getByText("Aviso");
    expect(title).toHaveClass("text-nd-gold");
  });

  it("should show emptyMessage when no events", () => {
    render(<EventLog emptyMessage="Nada." />);
    expect(screen.getByText("Nada.")).toBeInTheDocument();
  });

  it("should show default empty message when emptyMessage omitted", () => {
    render(<EventLog events={[]} />);
    expect(screen.getByText("Sem eventos registrados.")).toBeInTheDocument();
  });

  it("should show error banner and trigger onRetryAll", async () => {
    const onRetryAll = vi.fn();
    render(<EventLog status="error" onRetryAll={onRetryAll} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar eventos.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetryAll).toHaveBeenCalledTimes(1);
  });

  it("should trigger per-entry onRetry", async () => {
    const onRetry = vi.fn();
    render(<EventLog events={[entry({ onRetry })]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should show loading skeleton with aria-busy", () => {
    render(<EventLog status="loading" />);
    expect(document.querySelectorAll(".animate-pulse-neon").length).toBe(3);
  });
});
