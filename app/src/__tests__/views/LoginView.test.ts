import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import LoginView from "@/views/LoginView.vue";
import { useAuthStore } from "@/stores/auth";

// The real view + store run against a stubbed fetch; vue-router is mocked so
// navigation side-effects are asserted directly (guard behavior lives in
// router-auth.test.ts).

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

describe("LoginView", () => {
  beforeEach(() => {
    push.mockReset();
  });

  function mountView() {
    const pinia = createPinia();
    const wrapper = mount(LoginView, { global: { plugins: [pinia] } });
    return { wrapper, store: useAuthStore(pinia) };
  }

  it("should render the login form", () => {
    const { wrapper } = mountView();

    expect(wrapper.text()).toContain("ACESSO RESTRITO");
    expect(wrapper.find('input[type="email"]').exists()).toBe(true);
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').text()).toContain("ENTRAR");
  });

  it("should submit credentials and navigate to the dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(authResponse));
    vi.stubGlobal("fetch", fetchMock);
    const { wrapper, store } = mountView();

    await wrapper.find('input[type="email"]').setValue("  runner@neondusk.test  ");
    await wrapper.find('input[type="password"]').setValue("StrongPass123!");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "runner@neondusk.test", password: "StrongPass123!" }),
      }),
    );
    expect(store.isAuthenticated).toBe(true);
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("should show the error message when credentials are rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" }, 401),
      ),
    );
    const { wrapper, store } = mountView();

    await wrapper.find('input[type="email"]').setValue("runner@neondusk.test");
    await wrapper.find('input[type="password"]').setValue("WrongPass123!");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Invalid email or password");
    expect(store.isAuthenticated).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
