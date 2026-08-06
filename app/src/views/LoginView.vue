<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const formError = ref<string | null>(null);

async function onSubmit() {
  formError.value = null;
  try {
    await auth.login({ email: email.value.trim(), password: password.value });
    const redirect =
      typeof route.query.redirect === "string" ? route.query.redirect : undefined;
    await router.push(redirect ?? "/dashboard");
  } catch (err) {
    formError.value = err instanceof Error ? err.message : "Falha na conexão";
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-12">
    <div class="card w-full max-w-md space-y-6">
      <div class="space-y-1">
        <h2 class="font-heading text-2xl text-nd-cyan tracking-widest">ACESSO RESTRITO</h2>
        <p class="text-nd-text-secondary text-sm">
          Autentique-se para entrar na rede do Neon//Dusk.
        </p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <label class="block space-y-1">
          <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
            E-mail
          </span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="fixer@neondusk.gg"
            class="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
            Senha
          </span>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
          />
        </label>

        <p v-if="formError" class="text-nd-magenta font-data text-sm">{{ formError }}</p>
        <p v-else-if="auth.error && !formError" class="text-nd-magenta font-data text-sm">
          {{ auth.error }}
        </p>

        <button type="submit" :disabled="auth.loading" class="btn-neon w-full disabled:opacity-50">
          {{ auth.loading ? "CONECTANDO..." : "ENTRAR" }}
        </button>
      </form>

      <p class="text-nd-text-secondary text-sm text-center">
        Ainda não tem um perfil?
        <RouterLink to="/register" class="text-nd-cyan hover:underline">Cadastre-se</RouterLink>
      </p>
    </div>
  </div>
</template>
