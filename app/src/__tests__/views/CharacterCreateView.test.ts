import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import CharacterCreateView from "@/views/CharacterCreateView.vue";
import { useAuthStore } from "@/stores/auth";

const push = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}));

const createdCharacter = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "solo",
  body: 10,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CharacterCreateView", () => {
  beforeEach(() => {
    push.mockReset();
  });

  function mountView() {
    const pinia = createPinia();
    const wrapper = mount(CharacterCreateView, { global: { plugins: [pinia] } });
    return { wrapper, store: useAuthStore(pinia) };
  }

  it("should render the character form with name, origin, role and attributes", () => {
    const { wrapper } = mountView();

    expect(wrapper.text()).toContain("MONTAR PERSONAGEM");
    expect(wrapper.find('input[placeholder="Ex.: Cobra, Ghost, Viper"]').exists()).toBe(true);
    expect(wrapper.find("select").exists()).toBe(true);
    expect(wrapper.text()).toContain("Selecione o distrito");
    // 5 role buttons + 10 attribute steppers + submit.
    expect(wrapper.findAll("button").length).toBeGreaterThanOrEqual(16);
    expect(wrapper.find('button[type="submit"]').text()).toContain("CRIAR PERSONAGEM");
    expect(wrapper.findAll('[aria-label="Aumentar"]')).toHaveLength(5);
    expect(wrapper.findAll('[aria-label="Diminuir"]')).toHaveLength(5);
  });

  it("should create the character with the filled form and navigate to the dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(createdCharacter));
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper, store } = mountView();

    await wrapper.find('input[placeholder="Ex.: Cobra, Ghost, Viper"]').setValue("Ghost");
    await wrapper.find("select").setValue("a_paraiso");
    const roleButton = wrapper.findAll("button").find((b) => b.text().trim() === "Solo");
    expect(roleButton).toBeDefined();
    await roleButton!.trigger("click");

    // Default spread is 3×5=15; add the 7 free points to Body.
    const increaseButtons = wrapper.findAll('[aria-label="Aumentar"]');
    for (let i = 0; i < 7; i++) {
      await increaseButtons[0].trigger("click");
    }
    expect(wrapper.text()).toContain("0 pontos restantes");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/characters",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Ghost",
          origin: "a_paraiso",
          role: "solo",
          attributes: { body: 10, reflexes: 3, intelligence: 3, technical: 3, cool: 3 },
        }),
      }),
    );
    expect(store.hasCharacter).toBe(true);
    expect(store.character?.name).toBe("Ghost");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("should show the error and stay on the page when creation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: "NAME_TAKEN", message: "That name is already taken" }, 409),
      ),
    );
    const { wrapper, store } = mountView();

    await wrapper.find('input[placeholder="Ex.: Cobra, Ghost, Viper"]').setValue("Ghost");
    await wrapper.find("select").setValue("a_paraiso");
    const roleButton = wrapper.findAll("button").find((b) => b.text().trim() === "Solo");
    await roleButton!.trigger("click");
    const increaseButtons = wrapper.findAll('[aria-label="Aumentar"]');
    for (let i = 0; i < 7; i++) {
      await increaseButtons[0].trigger("click");
    }
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("That name is already taken");
    expect(store.hasCharacter).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
