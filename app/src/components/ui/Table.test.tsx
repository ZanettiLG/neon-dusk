import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Table from "./Table";
import type { TableColumn } from "./types";

interface Row {
  id: string;
  name: string;
  tier: string;
}

const rows: Row[] = [
  { id: "1", name: "Alpha", tier: "T1" },
  { id: "2", name: "Beta", tier: "T2" },
];

const columns: TableColumn<Row>[] = [
  { key: "name", header: "Nome", cell: (r) => r.name },
  { key: "tier", header: "Tier", cell: (r) => r.tier },
];

describe("Table", () => {
  it("should render semantic headers with scope=col and rows", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent("Nome");
    expect(headers[0]).toHaveAttribute("scope", "col");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "T2" })).toBeInTheDocument();
  });

  it("should render custom cells", () => {
    render(
      <Table
        columns={[
          { key: "name", header: "Nome", cell: (r) => <strong>{r.name.toUpperCase()}</strong> },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByRole("cell", { name: "ALPHA" })).toBeInTheDocument();
  });

  it("should call rowKey for each row", () => {
    const rowKey = vi.fn((r: Row) => r.id);
    render(<Table columns={columns} rows={rows} rowKey={rowKey} />);
    expect(rowKey).toHaveBeenCalledTimes(2);
  });

  it("should show LoadingState skeleton while loading", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} status="loading" />);
    expect(document.querySelectorAll(".animate-pulse-neon")).toHaveLength(3);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("should show ErrorState with retry on error", async () => {
    const onRetry = vi.fn();
    render(
      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        status="error"
        errorMessage="Falha ao carregar."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao carregar.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should show EmptyState when there are no rows", () => {
    render(<Table columns={columns} rows={[]} rowKey={(r) => r.id} emptyMessage="Nada aqui." />);
    expect(screen.getByText("Nada aqui.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("should show the default empty message when rows are empty", () => {
    render(<Table columns={columns} rows={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText("Nenhum dado.")).toBeInTheDocument();
  });

  it("should apply rowClassName per row", () => {
    render(
      <Table
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowClassName={(r) => (r.id === "1" ? "bg-nd-cyan/5" : "")}
      />,
    );
    expect(screen.getByRole("row", { name: /Alpha/ })).toHaveClass("bg-nd-cyan/5");
    expect(screen.getByRole("row", { name: /Beta/ })).not.toHaveClass("bg-nd-cyan/5");
  });

  it("should apply hideBelow to th and td", () => {
    render(
      <Table
        columns={[
          { key: "name", header: "Nome", cell: (r) => r.name },
          { key: "tier", header: "Tier", cell: (r) => r.tier, hideBelow: "sm" },
        ]}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Tier" })).toHaveClass(
      "hidden",
      "sm:table-cell",
    );
    expect(screen.getByRole("cell", { name: "T1" })).toHaveClass("hidden", "sm:table-cell");
    expect(screen.getByRole("columnheader", { name: "Nome" })).not.toHaveClass("hidden");
  });

  it("should render a sr-only caption", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} caption="Trampos ativos" />);
    expect(screen.getByText("Trampos ativos")).toHaveClass("sr-only");
  });
});
