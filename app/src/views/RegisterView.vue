<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const confirm = ref("");
const formError = ref<string | null>(null);

const passwordMismatch = computed(
  () => confirm.value.length > 0 && password.value !== confirm.value,
);

async function onSubmit() {
  formError.value = null;
  if (passwordMismatch.value) {
    formError.value = "As senhas não coincidem";
    return;
  }
  try {
    await auth.register({ email: email.value.trim(), password: password.value });
    await router.push("/dashboard");
  } catch (err) {
    formError.value = err instanceof Error ? err.message : "Falha na conexão";
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-12">
    <div class="card w-full max-w-md space-y-6">
      <div class="space-y-1">
        <h2 class="font-heading text-2xl text-nd-magenta tracking-widest">CRIAR PERFIL</h2>
        <p class="text-nd-text-secondary text-sm">
          Novos nomes no grid. Novo sangue na cidade.
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
            autocomplete="new-password"
            minlength="8"
            placeholder="Mínimo 8 caracteres"
            class="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
            Confirmar senha
          </span>
          <input
            v-model="confirm"
            type="password"
            required
            autocomplete="new-password"
            placeholder="Repita a senha"
            class="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
          />
        </label>

        <p v-if="formError" class="text-nd-magenta font-data text-sm">{{ formError }}</p>
        <p v-else-if="passwordMismatch" class="text-nd-magenta font-data text-sm">
          As senhas não coincidem
        </p>

        <button type="submit" :disabled="auth.loading" class="btn-neon w-full disabled:opacity-50">
          {{ auth.loading ? "GERANDO CREDENCIAIS..." : "CADASTRAR" }}
        </button>
      </form>

      <p class="text-nd-text-secondary text-sm text-center">
        Já tem um perfil?
        <RouterLink to="/login" class="text-nd-cyan hover:underline">Entrar</RouterLink>
      </p>
    </div>
  </div>
</template>
