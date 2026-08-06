import { describe, it, expect, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth";
import type { Character, User } from "@neon-dusk/shared";

// Navigation guard behavior: the real router singleton runs against a fresh
// Pinia per test, so the guards read the store state we set up.

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
  body: 5,
  reflexes: 4,
  intelligence: 4,
  technical: 4,
  cool: 5,
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

describe("router navigation guards", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    // Reset the singleton to the unguarded home route: pushing the same path
    // twice in a row (e.g. two tests ending on /login) makes vue-router skip
    // the redundant navigation and the guards never re-run.
    await router.push("/");
  });

  async function navigate(path: string) {
    // NOTE: `router.isReady()` hangs here — it waits for the initial
    // navigation that `app.use(router)` triggers, which never happens in a
    // test. `push()` starts its own navigation and resolves after the guards.
    await router.push(path);
    return router.currentRoute.value;
  }

  function setSession(opts: { hasCharacter?: boolean } = {}) {
    const store = useAuthStore();
    store.$patch({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user,
      character: opts.hasCharacter ? character : null,
    });
  }

  it("should redirect unauthenticated users from /dashboard to /login with a redirect query", async () => {
    const route = await navigate("/dashboard");

    expect(route.name).toBe("login");
    expect(route.query.redirect).toBe("/dashboard");
  });

  it("should redirect unauthenticated users from /create-character to /login", async () => {
    const route = await navigate("/create-character");

    expect(route.name).toBe("login");
    expect(route.query.redirect).toBe("/create-character");
  });

  it("should redirect authenticated users without a character from /dashboard to /create-character", async () => {
    setSession();
    const route = await navigate("/dashboard");

    expect(route.name).toBe("create-character");
  });

  it("should redirect authenticated users with a character from /create-character to /dashboard", async () => {
    setSession({ hasCharacter: true });
    const route = await navigate("/create-character");

    expect(route.name).toBe("dashboard");
  });

  it("should allow guests on /login", async () => {
    const route = await navigate("/login");

    expect(route.name).toBe("login");
  });

  it("should bounce authenticated guests from /login to the dashboard when they have a character", async () => {
    setSession({ hasCharacter: true });
    const route = await navigate("/login");

    expect(route.name).toBe("dashboard");
  });

  it("should bounce authenticated guests from /login to character creation when they have none", async () => {
    setSession();
    const route = await navigate("/login");

    expect(route.name).toBe("create-character");
  });

  it("should allow an authenticated user with a character on /dashboard", async () => {
    setSession({ hasCharacter: true });
    const route = await navigate("/dashboard");

    expect(route.name).toBe("dashboard");
  });
});
