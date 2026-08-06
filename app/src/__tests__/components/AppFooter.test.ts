import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppFooter from "@/components/AppFooter.vue";

describe("AppFooter", () => {
  it("should render the tagline", () => {
    const wrapper = mount(AppFooter);

    expect(wrapper.text()).toContain("Build your chrome. Burn your name. Leave a legend.");
  });

  it("should render a footer element", () => {
    const wrapper = mount(AppFooter);

    expect(wrapper.find("footer").exists()).toBe(true);
  });
});
