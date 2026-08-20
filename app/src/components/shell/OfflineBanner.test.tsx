import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OfflineBanner from "@/components/shell/OfflineBanner";
import { useAppStore } from "@/stores/app";

const mocks = vi.hoisted(() => ({
  useOnline: vi.fn(() => true),
}));

vi.mock("@/lib/useOnline", () => ({
  useOnline: mocks.useOnline,
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    mocks.useOnline.mockReturnValue(true);
    useAppStore.setState({ healthError: null });
  });

  it("renders nothing while online and healthy", () => {
    render(<OfflineBanner />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the assertive banner while offline", () => {
    mocks.useOnline.mockReturnValue(false);
    render(<OfflineBanner />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "assertive");
    expect(banner).toHaveTextContent(/sem conexão/i);
  });

  it("renders the banner when the health check failed", () => {
    useAppStore.setState({ healthError: "ECONNREFUSED" });
    render(<OfflineBanner />);

    expect(screen.getByRole("status")).toHaveTextContent(/sem conexão/i);
  });
});
