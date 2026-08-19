import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Suspense, lazy, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { create } from "zustand";
import { useAuthStore } from "@/stores/auth";
import { RequireAuth } from "@/components/guards/RequireAuth";
import { RequireCharacter } from "@/components/guards/RequireCharacter";
import type {
  Character,
  Crew,
  CrewDetailResponse,
} from "@neon-dusk/shared";

// The 7 new views are lazy-loaded by the real router (src/router/index.tsx);
// mirror the same route table + guards with MemoryRouter (jsdom has no
// history for createBrowserRouter, and the data-router variant trips over the
// jsdom AbortController/undici Request mismatch in this Node combo — same
// MemoryRouter approach as router-auth.test.tsx).
const ChromeView = lazy(() => import("@/views/ChromeView"));
const VendorsView = lazy(() => import("@/views/VendorsView"));
const VendorDetailView = lazy(() => import("@/views/VendorDetailView"));
const PvpView = lazy(() => import("@/views/PvpView"));
const EconomyView = lazy(() => import("@/views/EconomyView"));
const CrewsView = lazy(() => import("@/views/CrewsView"));
const CrewDetailView = lazy(() => import("@/views/CrewDetailView"));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<span>▌ loading...</span>}>{children}</Suspense>;
}

// Probes for the guard redirect destinations (mirror router-auth.test.tsx).
const LoginProbe = () => <div>LOGIN PAGE</div>;
const CreateCharacterProbe = () => <div>CREATE CHARACTER PAGE</div>;

// API responses for the direct-fetch views (ChromeView/Vendors/PvP/Economy).
// Crews/CrewDetail read from the crew store, mocked below.
const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
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

// Crew views go through the crew store — mock it as a controllable singleton
// (same pattern as SaideiraView.test.tsx) so no real EventSource is needed.
const storeMocks = vi.hoisted(() => {
  const crew: Crew = {
    id: "c1",
    name: "As Gralhas",
    tag: "GRL",
    leaderId: "char-1",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const crewDetail: CrewDetailResponse = {
    crew,
    members: [
      {
        id: "m1",
        characterId: "char-1",
        characterName: "Ghost",
        streetCred: 50,
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    bonuses: [],
    leaderboardPosition: 1,
  };
  return {
    initial: {
      crews: [] as Crew[],
      crewsLoading: false,
      crewsError: null as string | null,
      crewDetail: crewDetail as CrewDetailResponse | null,
      detailLoading: false,
      detailError: null as string | null,
      messages: [],
      chatStatus: "offline" as const,
      chatSendLoading: false,
      chatSendError: null as string | null,
      fetchCrews: vi.fn(),
      fetchCrewDetail: vi.fn(),
      createCrew: vi.fn(),
      inviteMember: vi.fn(),
      joinCrew: vi.fn(),
      leaveCrew: vi.fn(),
      kickMember: vi.fn(),
      dissolveCrew: vi.fn(),
      sendMessage: vi.fn(),
      connectChat: vi.fn(),
      disconnectChat: vi.fn(),
      fetchChatHistory: vi.fn(),
    },
  };
});

vi.mock("@/stores/crew", () => ({
  useCrewStore: create(() => ({ ...storeMocks.initial })),
}));

const { useCrewStore } = await import("@/stores/crew");

const character: Character = {
  id: "char-1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "bicho",
  body: 3,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route element={<RequireCharacter />}>
            <Route path="/chrome" element={<Lazy><ChromeView /></Lazy>} />
            <Route path="/vendors" element={<Lazy><VendorsView /></Lazy>} />
            <Route path="/vendors/:id" element={<Lazy><VendorDetailView /></Lazy>} />
            <Route path="/pvp" element={<Lazy><PvpView /></Lazy>} />
            <Route path="/economy" element={<Lazy><EconomyView /></Lazy>} />
            <Route path="/crews" element={<Lazy><CrewsView /></Lazy>} />
            <Route path="/crews/:id" element={<Lazy><CrewDetailView /></Lazy>} />
          </Route>
        </Route>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/create-character" element={<CreateCharacterProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("router: new views", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    useCrewStore.setState({ ...storeMocks.initial });
    mocks.api.get.mockReset();
    // Default: empty data per endpoint so every direct-fetch view settles.
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/chrome") return Promise.resolve([]);
      if (url === "/api/chrome/installed") {
        return Promise.resolve({
          installed: [],
          effectiveHumanity: 70,
          humanitySpent: 0,
          statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
          hpBonus: 0,
          gigSuccessBonus: 0,
          nilMaxBonus: 0,
        });
      }
      if (url === "/api/vendors") return Promise.resolve([]);
      if (url.startsWith("/api/vendors/")) {
        return Promise.resolve({
          vendor: {
            id: "v1",
            name: "Ferrageiro Zé",
            type: "RIPPERDOC",
            district: "A Paraíso",
          },
          inventory: [],
        });
      }
      if (url === "/api/pvp/attackable") return Promise.resolve({ targets: [] });
      if (url === "/api/pvp/history") {
        return Promise.resolve({ combats: [], nextCursor: null });
      }
      if (url === "/api/economy/balance") {
        return Promise.resolve({ balance: 0, escrow: 0, lifetimeEarned: 0, lifetimeSpent: 0 });
      }
      if (url === "/api/economy/transactions") {
        return Promise.resolve({ transactions: [], nextCursor: null });
      }
      return Promise.resolve([]);
    });
  });

  it("should redirect unauthenticated users away from the new routes (RequireAuth)", () => {
    renderAt("/chrome");

    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("should redirect authenticated users without a character (RequireCharacter)", () => {
    useAuthStore.setState({ accessToken: "at", character: null });

    renderAt("/crews");

    expect(screen.getByText("CREATE CHARACTER PAGE")).toBeInTheDocument();
  });

  it("should render ChromeView at /chrome", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/chrome");

    expect(await screen.findByText("CROMO")).toBeInTheDocument();
    expect(await screen.findByText("Nenhum implante disponível.")).toBeInTheDocument();
  });

  it("should render VendorsView at /vendors", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/vendors");

    expect(await screen.findByText("VENDEDORES")).toBeInTheDocument();
    expect(await screen.findByText("Nenhum vendedor disponível.")).toBeInTheDocument();
  });

  it("should render VendorDetailView at /vendors/:id", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/vendors/v1");

    expect(await screen.findByText("Ferrageiro Zé")).toBeInTheDocument();
    expect(await screen.findByText("Estoque vazio.")).toBeInTheDocument();
  });

  it("should render PvpView at /pvp", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/pvp");

    expect(await screen.findByText("PvP")).toBeInTheDocument();
    expect(await screen.findByText("Nenhum alvo disponível.")).toBeInTheDocument();
  });

  it("should render EconomyView at /economy", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/economy");

    expect(await screen.findByText("ECONOMIA")).toBeInTheDocument();
    expect(await screen.findByText("Nenhuma transação registrada.")).toBeInTheDocument();
  });

  it("should render CrewsView at /crews", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/crews");

    expect(await screen.findByText("BONDES")).toBeInTheDocument();
    expect(await screen.findByText("Nenhum bonde fundado ainda.")).toBeInTheDocument();
  });

  it("should render CrewDetailView at /crews/:id", async () => {
    useAuthStore.setState({ accessToken: "at", character });

    renderAt("/crews/c1");

    expect(await screen.findByText("As Gralhas")).toBeInTheDocument();
    expect(await screen.findByText("[GRL]")).toBeInTheDocument();
  });
});
