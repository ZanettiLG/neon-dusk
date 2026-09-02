import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { Character, MetroMapResponse, Origin, VendorRecord } from "@neon-dusk/shared";
import MetroView from "@/views/MetroView";
import { useMetroStore, METRO_TRAVEL_MS } from "@/stores/metro";
import { useAuthStore } from "@/stores/auth";

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

const character: Character = {
  id: "c1",
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

const vendors: VendorRecord[] = [
  { id: "v1", name: "Doc Fios", type: "RIPPERDOC", district: "babilonia", description: null },
  { id: "v2", name: "Zé do Pó", type: "STIM_DEALER", district: "o_fervo", description: null },
];

const ORIGINS: Origin[] = [
  "a_paraiso",
  "o_fervo",
  "o_fluxo",
  "a_quebrada",
  "babilonia",
  "as_mortas",
  "o_ponto",
];

/** Zero-filled metro payload (no trampos/heat/territory anywhere). */
const EMPTY_METRO: MetroMapResponse = {
  districts: ORIGINS.map((origin) => ({
    origin,
    gigsAvailable: 0,
    heat: 0,
    territoryCrewTag: null,
  })),
};

/**
 * Route-aware mock: /api/vendors → vendor list, /api/metro → district map.
 * Both resolve by default; pass explicit values to override per test.
 */
function mockMapApi(opts: { vendors?: VendorRecord[]; metro?: MetroMapResponse } = {}) {
  const vendorData = opts.vendors ?? [];
  const metroData = opts.metro ?? EMPTY_METRO;
  mocks.api.get.mockImplementation((url: string) =>
    url === "/api/metro" ? Promise.resolve(metroData) : Promise.resolve(vendorData),
  );
}

const STATIONS: [Origin, string][] = [
  ["a_paraiso", "A Paraíso"],
  ["o_fervo", "O Fervo"],
  ["o_fluxo", "O Fluxo"],
  ["a_quebrada", "A Quebrada"],
  ["babilonia", "Babilônia"],
  ["as_mortas", "As Mortas"],
  ["o_ponto", "O Ponto"],
];

describe("MetroView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    // Module-level crossing timer + store state must not leak between tests.
    useMetroStore.getState().cancelTravel();
    useMetroStore.setState(useMetroStore.getInitialState());
    useAuthStore.setState({ character });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should show a loading state while vendors and the metro map are being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    render(<MetroView />);

    expect(screen.getByText("▌ carregando mapa...")).toBeInTheDocument();
  });

  it("should show the error state with a retry that reloads the map", async () => {
    mocks.api.get.mockImplementation(() =>
      Promise.reject(new Error("Falha ao carregar vendedores")),
    );

    render(<MetroView />);

    expect(await screen.findByText(/Falha ao carregar vendedores/)).toBeInTheDocument();

    mockMapApi();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(
      await screen.findByRole("img", { name: "Mapa do metrô de São Paulo 2087" }),
    ).toBeInTheDocument();
    // Initial load = 2 calls (vendors + metro), retry = 2 more.
    expect(mocks.api.get).toHaveBeenCalledTimes(4);
  });

  it("should show the error state when only the /api/metro fetch fails", async () => {
    mocks.api.get.mockImplementation((url: string) =>
      url === "/api/metro"
        ? Promise.reject(new Error("Falha ao carregar o mapa"))
        : Promise.resolve([]),
    );

    render(<MetroView />);

    expect(await screen.findByText(/Falha ao carregar o mapa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("should render the map without vendor badges when no vendors exist", async () => {
    mockMapApi();

    render(<MetroView />);

    expect(
      await screen.findByRole("img", { name: "Mapa do metrô de São Paulo 2087" }),
    ).toBeInTheDocument();
    for (const origin of ORIGINS) {
      expect(screen.queryByTestId(`metro-vendors-${origin}`)).not.toBeInTheDocument();
    }
  });

  it("should badge the districts that have vendors", async () => {
    mockMapApi({ vendors });

    render(<MetroView />);

    await screen.findByRole("img", { name: "Mapa do metrô de São Paulo 2087" });

    expect(
      within(screen.getByTestId("metro-vendors-babilonia")).getByText("1"),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId("metro-vendors-o_fervo")).getByText("1")).toBeInTheDocument();
    expect(screen.queryByTestId("metro-vendors-a_paraiso")).not.toBeInTheDocument();

    // The count is also announced in the station accessible name.
    expect(
      screen.getByRole("button", { name: "Estação Babilônia, 1 vendedor" }),
    ).toBeInTheDocument();
  });

  it("should pass trampos, heat and territory indicators from /api/metro to the map", async () => {
    const metro: MetroMapResponse = {
      districts: ORIGINS.map((origin) => ({
        origin,
        gigsAvailable: origin === "o_fervo" ? 3 : 0,
        heat: origin === "babilonia" ? 60 : 0,
        territoryCrewTag: origin === "a_paraiso" ? "BLD" : null,
      })),
    };
    mockMapApi({ metro });

    render(<MetroView />);

    await screen.findByRole("img", { name: "Mapa do metrô de São Paulo 2087" });

    // Derived props reached the map: badges, heat label and territory tag.
    expect(within(screen.getByTestId("metro-gigs-o_fervo")).getByText("3")).toBeInTheDocument();
    expect(screen.getByTestId("metro-heat-babilonia")).toHaveTextContent("PEGANDO FOGO");
    expect(screen.getByTestId("metro-territory-a_paraiso")).toHaveTextContent("[BLD]");

    // Composited station labels.
    expect(screen.getByRole("button", { name: "Estação O Fervo, 3 trampos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Estação Babilônia, calor PEGANDO FOGO (60)",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Estação A Paraíso, território do bonde BLD" }),
    ).toBeInTheDocument();

    // Districts without data render nothing.
    expect(screen.queryByTestId("metro-gigs-a_paraiso")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metro-heat-o_fervo")).not.toBeInTheDocument();
  });

  it("should highlight the character origin station on mount", async () => {
    mockMapApi();

    render(<MetroView />);

    await screen.findByRole("img", { name: "Mapa do metrô de São Paulo 2087" });

    // Banner defaults to the character origin.
    expect(screen.getByText(/A PARAÍSO/)).toBeInTheDocument();

    const station = screen.getByRole("button", { name: "Estação A Paraíso" });
    expect(station).toHaveAttribute("data-origin", "true");
    expect(station).toHaveAttribute("data-current", "true");
    expect(within(station).getByText("VOCÊ ESTÁ AQUI")).toBeInTheDocument();
  });

  it("should cross to the selected district through the diegetic overlay", async () => {
    vi.useFakeTimers();
    mockMapApi({ vendors });

    render(<MetroView />);

    // Flush the vendors fetch (microtask) — no timer-based waiting under fake timers.
    await act(async () => {});
    expect(
      screen.getByRole("img", { name: "Mapa do metrô de São Paulo 2087" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Estação O Fervo, 1 vendedor" }));

    // Boarding beat on the lilac line.
    expect(screen.getByText("▌ EMBARCANDO NA LINHA 4-LILÁS...")).toBeInTheDocument();

    // Crossing beat — destination callout (half the ride).
    act(() => {
      vi.advanceTimersByTime(METRO_TRAVEL_MS / 2);
    });
    expect(screen.getByText("▌ ATRAVESSANDO PARA O FERVO...")).toBeInTheDocument();

    // Ride completes: overlay closes, banner + current station flip to O Fervo.
    act(() => {
      vi.advanceTimersByTime(METRO_TRAVEL_MS / 2);
    });
    expect(screen.queryByText("▌ ATRAVESSANDO PARA O FERVO...")).not.toBeInTheDocument();
    expect(useMetroStore.getState().traveling).toBe(false);
    expect(useMetroStore.getState().currentDistrict).toBe("o_fervo");

    expect(screen.getByText(/O FERVO/)).toBeInTheDocument();
    const fervo = screen.getByRole("button", { name: "Estação O Fervo, 1 vendedor" });
    expect(fervo).toHaveAttribute("data-current", "true");
    expect(within(fervo).getByText("VOCÊ ESTÁ AQUI")).toBeInTheDocument();

    const paraiso = screen.getByRole("button", { name: "Estação A Paraíso" });
    expect(within(paraiso).queryByText("VOCÊ ESTÁ AQUI")).not.toBeInTheDocument();
  });

  it("should cancel a pending crossing when the view unmounts", async () => {
    vi.useFakeTimers();
    mockMapApi({ vendors });

    const { unmount } = render(<MetroView />);
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: "Estação O Fervo, 1 vendedor" }));
    expect(useMetroStore.getState().traveling).toBe(true);

    unmount();

    // The module-level crossing timer must be cleared — advancing it after
    // unmount must not swap the district.
    act(() => {
      vi.advanceTimersByTime(METRO_TRAVEL_MS);
    });

    const s = useMetroStore.getState();
    expect(s.traveling).toBe(false);
    expect(s.currentDistrict).toBe("a_paraiso");
  });

  it("should render the map without origin or current markers when the character has no origin", async () => {
    useAuthStore.setState({ character: null });
    mockMapApi();

    render(<MetroView />);

    await screen.findByRole("img", { name: "Mapa do metrô de São Paulo 2087" });

    // Banner falls back to the hub (Babilônia).
    expect(screen.getByText(/BABILÔNIA/)).toBeInTheDocument();

    for (const [origin, label] of STATIONS) {
      const station = screen.getByRole("button", { name: `Estação ${label}` });
      expect(station, `${origin} station`).not.toHaveAttribute("data-origin");
      expect(station).not.toHaveAttribute("data-current");
    }
  });
});
