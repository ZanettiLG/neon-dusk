<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { CreateCharacterRequest } from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import CharacterForm from "@/components/CharacterForm.vue";

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const formError = ref<string | null>(null);

async function onSubmit(payload: CreateCharacterRequest) {
  formError.value = null;
  loading.value = true;
  try {
    await auth.createCharacter(payload);
    await router.push("/dashboard");
  } catch (err) {
    formError.value = err instanceof Error ? err.message : "Falha na conexão";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex items-center justify-center py-8">
    <div class="card w-full max-w-xl space-y-6">
      <div class="space-y-1">
        <h2 class="font-heading text-2xl text-nd-gold tracking-widest">MONTAR PERSONAGEM</h2>
        <p class="text-nd-text-secondary text-sm">
          Nome, origem, role e o seu corte de atributos. Depois disso, não tem volta.
        </p>
      </div>

      <p v-if="formError" class="text-nd-magenta font-data text-sm border border-nd-magenta/30 rounded-terminal px-3 py-2">
        {{ formError }}
      </p>

      <CharacterForm :loading="loading" @submit="onSubmit" />
    </div>
  </div>
</template>
