import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { nextTick } from "vue";
import DashboardView from "@/views/DashboardView.vue";
import { useAuthStore } from "@/stores/auth";
import type { Character, NilStatus, User } from "@neon-dusk/shared";

const push = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
  RouterLink: {
    name: "RouterLink",
    props: ["to"],
    template: "<a><slot /></a>",
  },
}));

const user: User = {
  id: "u1",
  email: "runner@neondusk.test",
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "solo",
  body: 10,
  reflexes: 4,
  intelligence: 4,
  technical: 4,
  cool: 0,
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

describe("DashboardView", () => {
  beforeEach(() => {
    push.mockReset();
  });

  function mountView() {
    const pinia = createPinia();
    const wrapper = mount(DashboardView, { global: { plugins: [pinia] } });
    return { wrapper, store: useAuthStore(pinia) };
  }

  it("should prompt for character creation when the user has none", () => {
    const { wrapper } = mountView();

    expect(wrapper.text()).toContain("PAINEL DO CORREDOR");
    expect(wrapper.text()).toContain("Nenhum personagem vinculado a esta conta.");
    const link = wrapper.find("a");
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("Criar personagem");
  });

  it("should render the character sheet when one exists", async () => {
    const { wrapper, store } = mountView();
    store.$patch({ user, character });
    // Flush the reactive render triggered by the store patch.
    await nextTick();

    expect(wrapper.text()).toContain("Ghost");
    expect(wrapper.text()).toContain("Solo · Origem: A Paraíso");
    expect(wrapper.text()).toContain("ROUND 1 // ATIVO");
    expect(wrapper.text()).toContain("10"); // body value
    expect(wrapper.text()).not.toContain("Nenhum personagem vinculado");
    expect(wrapper.text()).toContain("Desconectar");
  });

  it("should revoke the session and redirect to login on logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper, store } = mountView();
    store.$patch({ user, character, accessToken: "access-1", refreshToken: "refresh-1" });

    await wrapper.find("button").trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-1" }),
      }),
    );
    expect(store.isAuthenticated).toBe(false);
    expect(store.character).toBeNull();
    expect(push).toHaveBeenCalledWith("/login");
  });
});

// --- NIL (Feature #2) ---------------------------------------------------------
// The NIL readout lives on the auth store; these tests verify the dashboard
// renders it (bar width + regen countdown) and that the SYN-CAFÉ button drives
// the store action through the real api client.

function nilStatus(partial: Partial<NilStatus> = {}): NilStatus {
  return {
    current: 100,
    max: 100,
    nextTickSeconds: 0,
    regenerating: false,
    updatedAt: "2026-08-06T12:00:00.000Z",
    ...partial,
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DashboardView — NIL", () => {
  beforeEach(() => {
    push.mockReset();
  });

  /** Mount with a character + a fetch stub that serves the given readouts. */
  function mountWithNil(
    readout: NilStatus,
    fetchMock?: ReturnType<typeof vi.fn>,
  ) {
    const pinia = createPinia();
    const wrapper = mount(DashboardView, { global: { plugins: [pinia] } });
    const store = useAuthStore(pinia);
    store.$patch({ user, character, nilStatus: readout });
    // The view refetches on mount; default stub keeps serving the readout.
    vi.stubGlobal("fetch", fetchMock ?? vi.fn().mockResolvedValue(jsonResponse(readout)));
    return { wrapper, store };
  }

  it("should render the NIL bar with a percentage width matching nilPercent", async () => {
    const { wrapper } = mountWithNil(nilStatus({ current: 50, max: 100, regenerating: true }));
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).toContain("NIL // CARGA NEURAL");
    expect(wrapper.text()).toContain("50 / 100");
    const bar = wrapper.find(".h-full.rounded-full");
    expect(bar.exists()).toBe(true);
    expect(bar.attributes("style")).toContain("width: 50%");
  });

  it("should render a 0% width and the full-NIL label when NIL is empty", async () => {
    const { wrapper } = mountWithNil(nilStatus({ current: 0, regenerating: true, nextTickSeconds: 300 }));
    await nextTick();
    await flushPromises();

    const bar = wrapper.find(".h-full.rounded-full");
    expect(bar.attributes("style")).toContain("width: 0%");
    expect(wrapper.text()).toContain("Próximo +1 em");
  });

  it("should show NIL CHEIO and disable SYN-CAFÉ when NIL is full", async () => {
    const { wrapper } = mountWithNil(nilStatus({ current: 100 }));
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).toContain("NIL CHEIO");
    const stimButton = wrapper.find("button.btn-neon");
    expect(stimButton.exists()).toBe(true);
    expect(stimButton.attributes("disabled")).toBeDefined();
  });

  it("should call the store useStim action when SYN-CAFÉ is clicked", async () => {
    const readout = nilStatus({ current: 80, max: 100, regenerating: true, nextTickSeconds: 300 });
    const full = nilStatus({ current: 100, nextTickSeconds: 0, regenerating: false });
    const fetchMock = vi.fn((url: string) =>
      url.includes("/use-stim")
        ? Promise.resolve(jsonResponse({ added: 20, status: full }))
        : Promise.resolve(jsonResponse(readout)),
    );
    const { wrapper, store } = mountWithNil(readout, fetchMock);
    await nextTick();
    await flushPromises();

    await wrapper.find("button.btn-neon").trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/characters/me/nil/use-stim",
      expect.objectContaining({ method: "POST" }),
    );
    expect(store.nilStatus?.current).toBe(100);
    expect(store.nilStatus?.regenerating).toBe(false);
    expect(wrapper.text()).toContain("NIL CHEIO");
  });

  it("should surface a cooldown error message when the stim is rejected", async () => {
    const readout = nilStatus({ current: 80, max: 100, regenerating: true, nextTickSeconds: 300 });
    const fetchMock = vi.fn((url: string) =>
      url.includes("/use-stim")
        ? Promise.resolve(
            jsonResponse(
              { error: "NIL_STIM_COOLDOWN", message: "Syn-café is still on cooldown" },
              400,
            ),
          )
        : Promise.resolve(jsonResponse(readout)),
    );
    const { wrapper, store } = mountWithNil(readout, fetchMock);
    await nextTick();
    await flushPromises();

    await wrapper.find("button.btn-neon").trigger("click");
    await flushPromises();

    expect(store.nilError).toBe("Syn-café is still on cooldown");
    expect(wrapper.text()).toContain("Syn-café is still on cooldown");
  });
});
