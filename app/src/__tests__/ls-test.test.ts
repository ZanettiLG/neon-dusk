import { it, expect } from "vitest";

// ponytail: rewritten for Zustand persist in the store migration issue (#10).
// Until then, keep the localStorage mock from setup.ts honest: it must behave
// like the real Storage API that Zustand persist relies on.
it("localStorage mock roundtrips values", () => {
  localStorage.setItem("nd:key", "value");
  expect(localStorage.getItem("nd:key")).toBe("value");
  localStorage.removeItem("nd:key");
  expect(localStorage.getItem("nd:key")).toBeNull();
});
