import { describe, it, expect } from "vitest";
import { router } from "../router";

describe("router", () => {
  it("should resolve the root path to the home route", () => {
    const resolved = router.resolve("/");

    expect(resolved.name).toBe("home");
    expect(resolved.matched.length).toBeGreaterThan(0);
  });

  it("should lazy-load HomeView for the root route", async () => {
    const route = router.resolve("/");
    const component = route.matched[0].components?.default as (() => Promise<unknown>) | undefined;

    // vue-router wraps lazy imports in a loader function
    expect(component).toBeDefined();
    if (component) {
      const loaded = (await component()) as { default: unknown };
      expect(loaded.default).toBeDefined();
    }
  });

  it("should resolve unknown routes to no matched routes", () => {
    const resolved = router.resolve("/this/route/does/not/exist");

    expect(resolved.matched).toHaveLength(0);
  });
});
