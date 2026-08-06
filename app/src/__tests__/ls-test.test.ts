import { it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { router } from "@/router";

beforeEach(() => setActivePinia(createPinia()));

it("push alone resolves without install", async () => {
  await router.push("/login");
  expect(router.currentRoute.value.name).toBe("login");
});

it("guard redirects unauth /dashboard to login", async () => {
  await router.push("/dashboard");
  const r = router.currentRoute.value;
  console.log("landed:", r.name, "redirect:", r.query.redirect);
  expect(r.name).toBe("login");
});
