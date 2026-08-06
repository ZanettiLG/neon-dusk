import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { nextTick } from "vue";
import DashboardView from "@/views/DashboardView.vue";
import { useAuthStore } from "@/stores/auth";
import type { Character, User } from "@neon-dusk/shared";

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
