import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuthStore } from "@/stores/auth";
import { RequireAuth } from "@/components/guards/RequireAuth";
import { RequireCharacter } from "@/components/guards/RequireCharacter";
import { RequireCharacterless } from "@/components/guards/RequireCharacterless";
import { GuestOnly } from "@/components/guards/GuestOnly";
import type { Character } from "@neon-dusk/shared";

// Probes render at fixed destinations so redirect targets are observable.
function LoginProbe() {
  const location = useLocation();
  return <div>LOGIN PAGE {location.search}</div>;
}
const CreateCharacterProbe = () => <div>CREATE CHARACTER PAGE</div>;
const DashboardProbe = () => <div>DASHBOARD PAGE</div>;
const OutletProbe = () => <div>PROTECTED OUTLET</div>;

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "solo",
  body: 3,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderGuard(guard: ReactElement, entry: string, outletPath: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={guard}>
          <Route path={outletPath} element={<OutletProbe />} />
        </Route>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/create-character" element={<CreateCharacterProbe />} />
        <Route path="/dashboard" element={<DashboardProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("route guards", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
  });

  describe("RequireAuth", () => {
    it("should redirect unauthenticated users to /login?redirect=<path>", () => {
      renderGuard(<RequireAuth />, "/dashboard", "/dashboard");

      expect(screen.getByText("LOGIN PAGE ?redirect=%2Fdashboard")).toBeInTheDocument();
      expect(screen.queryByText("PROTECTED OUTLET")).not.toBeInTheDocument();
    });

    it("should render the outlet when a token exists", () => {
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt" });
      renderGuard(<RequireAuth />, "/dashboard", "/dashboard");

      expect(screen.getByText("PROTECTED OUTLET")).toBeInTheDocument();
      expect(screen.queryByText(/LOGIN PAGE/)).not.toBeInTheDocument();
    });
  });

  describe("RequireCharacter", () => {
    it("should redirect users without a character to /create-character", () => {
      useAuthStore.setState({ accessToken: "at", character: null });
      renderGuard(<RequireCharacter />, "/dashboard", "/dashboard");

      expect(screen.getByText("CREATE CHARACTER PAGE")).toBeInTheDocument();
      expect(screen.queryByText("PROTECTED OUTLET")).not.toBeInTheDocument();
    });

    it("should render the outlet when a character exists", () => {
      useAuthStore.setState({ accessToken: "at", character });
      renderGuard(<RequireCharacter />, "/dashboard", "/dashboard");

      expect(screen.getByText("PROTECTED OUTLET")).toBeInTheDocument();
    });
  });

  describe("RequireCharacterless", () => {
    it("should redirect users who already have a character to /dashboard", () => {
      useAuthStore.setState({ accessToken: "at", character });
      renderGuard(<RequireCharacterless />, "/create-character", "/create-character");

      expect(screen.getByText("DASHBOARD PAGE")).toBeInTheDocument();
      expect(screen.queryByText("PROTECTED OUTLET")).not.toBeInTheDocument();
    });

    it("should render the outlet when the user has no character", () => {
      useAuthStore.setState({ accessToken: "at", character: null });
      renderGuard(<RequireCharacterless />, "/create-character", "/create-character");

      expect(screen.getByText("PROTECTED OUTLET")).toBeInTheDocument();
    });
  });

  describe("GuestOnly", () => {
    it("should render the outlet for guests", () => {
      renderGuard(<GuestOnly />, "/login", "/login");

      expect(screen.getByText("PROTECTED OUTLET")).toBeInTheDocument();
    });

    it("should redirect authenticated users without a character to /create-character", () => {
      useAuthStore.setState({ accessToken: "at", character: null });
      renderGuard(<GuestOnly />, "/login", "/login");

      expect(screen.getByText("CREATE CHARACTER PAGE")).toBeInTheDocument();
    });

    it("should redirect authenticated users with a character to /dashboard", () => {
      useAuthStore.setState({ accessToken: "at", character });
      renderGuard(<GuestOnly />, "/register", "/register");

      expect(screen.getByText("DASHBOARD PAGE")).toBeInTheDocument();
    });
  });
});
