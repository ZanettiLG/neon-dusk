import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import RegisterView from "@/views/RegisterView.vue";
import { useAuthStore } from "@/stores/auth";

const push = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ query: {} }),
}));

const authResponse = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user: { id: "u1", email: "runner@neondusk.test", createdAt: "x", updatedAt: "x" },
  character: null,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("RegisterView", () => {
  beforeEach(() => {
    push.mockReset();
  });

  function mountView() {
    const pinia = createPinia();
    const wrapper = mount(RegisterView, { global: { plugins: [pinia] } });
    return { wrapper, store: useAuthStore(pinia) };
  }

  it("should render the registration form with a confirm password field", () => {
    const { wrapper } = mountView();

    expect(wrapper.text()).toContain("CRIAR PERFIL");
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.findAll('input[type="password"]')).toHaveLength(2);
    expect(wrapper.text()).toContain("Confirmar senha");
    expect(wrapper.find('button[type="submit"]').text()).toContain("CADASTRAR");
  });

  it("should block submission when the passwords do not match", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper, store } = mountView();

    await wrapper.find('input[type="email"]').setValue("runner@neondusk.test");
    const [password, confirm] = wrapper.findAll('input[type="password"]');
    await password.setValue("StrongPass123!");
    await confirm.setValue("Different123!");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("As senhas não coincidem");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.isAuthenticated).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("should register and navigate to the dashboard when passwords match", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(authResponse));
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper, store } = mountView();

    await wrapper.find('input[type="email"]').setValue("runner@neondusk.test");
    const [password, confirm] = wrapper.findAll('input[type="password"]');
    await password.setValue("StrongPass123!");
    await confirm.setValue("StrongPass123!");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "runner@neondusk.test", password: "StrongPass123!" }),
      }),
    );
    expect(store.isAuthenticated).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard");
  });
});
