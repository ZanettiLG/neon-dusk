import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import { useAuthStore } from "./stores/auth";
import App from "./App.vue";
import "./style.css";

// Restore the stored session (localStorage tokens + /auth/me) BEFORE the first
// navigation so the router guards see the correct auth state.
async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  await useAuthStore(pinia).bootstrap();
  app.use(router);
  app.mount("#app");
}

void bootstrap();
