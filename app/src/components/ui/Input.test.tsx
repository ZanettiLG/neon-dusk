import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Input from "./Input";

describe("Input", () => {
  it("should wire label htmlFor to the input id", () => {
    render(<Input label="Handle" />);
    const input = screen.getByLabelText("Handle");
    expect(input).toBeInTheDocument();
    const label = screen.getByText("Handle").closest("label");
    expect(label).toHaveAttribute("for", input.id);
  });

  it("should set aria-invalid and aria-describedby pointing to the error", () => {
    render(<Input label="Handle" error="Handle inválido." />);
    const input = screen.getByLabelText("Handle");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("Handle inválido.");
  });

  it("should render hint with its own describedby id", () => {
    render(<Input label="Handle" hint="4-16 caracteres" />);
    const input = screen.getByLabelText("Handle");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent("4-16 caracteres");
  });

  it("should forward required to the input", () => {
    render(<Input label="Handle" required />);
    expect(screen.getByLabelText("Handle")).toBeRequired();
  });

  it("should disable the input", () => {
    render(<Input label="Handle" disabled />);
    expect(screen.getByLabelText("Handle")).toBeDisabled();
  });

  it("should call onChange with the typed value", async () => {
    const onChange = vi.fn();
    render(<Input label="Handle" onChange={onChange} />);
    const input = screen.getByLabelText("Handle");
    await userEvent.setup().type(input, "abc");
    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveValue("abc");
  });
});
