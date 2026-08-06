import { describe, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { useAppStore } from "@/stores/app";
import HomeView from "@/views/HomeView.vue";

const healthy = {
  status: "ok",
  timestamp: "2026-08-06T00:00:00.000Z",
  uptime: 42,
  version: "0.1.0",
  services: { database: "connected", redis: "connected" },
};

describe("HomeView", () => {
  function mountView() {
    const pinia = createPinia();
    const wrapper = mount(HomeView, { global: { plugins: [pinia] } });
    return { wrapper, store: useAppStore(pinia) };
  }

  it("should render the hero title and tagline", () => {
    const { wrapper } = mountView();

    expect(wrapper.text()).toContain("NEON//DUSK");
    expect(wrapper.text()).toContain("Build your chrome. Burn your name. Leave a legend.");
  });

  it("should show the system status card when healthy", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthy), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const { wrapper, store } = mountView();
    await flushPromises();

    expect(store.health?.status).toBe("ok");
    expect(wrapper.text()).toContain("System Status");
    expect(wrapper.text()).toContain("ONLINE");
    expect(wrapper.text()).toContain("connected");
  });

  it("should show the error state with a retry button when health check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network request failed")));

    const { wrapper, store } = mountView();
    await flushPromises();

    expect(store.healthError).toBe("Network request failed");
    expect(wrapper.text()).toContain("Network request failed");
    expect(wrapper.find("button").exists()).toBe(true);
  });
});
