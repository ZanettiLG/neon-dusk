import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("../views/HomeView.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/register",
      name: "register",
      component: () => import("../views/RegisterView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/create-character",
      name: "create-character",
      component: () => import("../views/CharacterCreateView.vue"),
      meta: { requiresAuth: true, requiresCharacterless: true },
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: () => import("../views/DashboardView.vue"),
      meta: { requiresAuth: true, requiresCharacter: true },
    },
  ],
});

// Navigation guards:
// - requiresAuth: must be logged in (else → /login)
// - requiresCharacter: must have a character (else → /create-character)
// - requiresCharacterless: must NOT have a character yet (else → /dashboard)
// - guestOnly: must be logged out (else → dashboard or character creation)
router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  if (to.meta.requiresCharacter && !auth.hasCharacter) {
    return { name: "create-character" };
  }

  if (to.meta.requiresCharacterless && auth.hasCharacter) {
    return { name: "dashboard" };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return auth.hasCharacter ? { name: "dashboard" } : { name: "create-character" };
  }

  return true;
});
