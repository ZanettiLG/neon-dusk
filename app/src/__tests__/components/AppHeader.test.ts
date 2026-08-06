import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import AppHeader from "@/components/AppHeader.vue";

describe("AppHeader", () => {
  function mountHeader() {
    return mount(AppHeader, {
      global: { plugins: [createPinia()] },
    });
  }

  it("should render the NEON//DUSK title", () => {
    const wrapper = mountHeader();

    expect(wrapper.get("h1").text()).toContain("NEON//DUSK");
  });

  it("should render the version tag", () => {
    const wrapper = mountHeader();

    expect(wrapper.text()).toContain("v0.1.0-alpha");
  });

  it("should contain the StatusBar navigation element", () => {
    const wrapper = mountHeader();

    expect(wrapper.findComponent({ name: "StatusBar" }).exists()).toBe(true);
  });

  it("should render a header element", () => {
    const wrapper = mountHeader();

    expect(wrapper.find("header").exists()).toBe(true);
  });
});
