<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import type { AttributeKey } from "@neon-dusk/shared";
import { ATTRIBUTE_KEYS, BASE_ATTRIBUTES, SOFT_CAP } from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import { ATTRIBUTE_LABELS, ORIGIN_LABELS, ROLE_LABELS } from "@/lib/labels";

const router = useRouter();
const auth = useAuthStore();

const character = computed(() => auth.character);
const user = computed(() => auth.user);

const attributeHighlight = (key: AttributeKey) =>
  (character.value?.[key] ?? 0) >= SOFT_CAP
    ? "text-nd-magenta"
    : (character.value?.[key] ?? 0) > BASE_ATTRIBUTES
      ? "text-nd-cyan"
      : "text-nd-text";

async function onLogout() {
  await auth.logout();
  await router.push("/login");
}
</script>

<template>
  <div class="py-8 space-y-6">
    <!-- Session header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 class="font-heading text-2xl text-nd-cyan tracking-widest">PAINEL DO CORREDOR</h2>
        <p class="text-nd-text-secondary text-sm">
          Conectado como <span class="font-data text-nd-text">{{ user?.email }}</span>
        </p>
      </div>
      <button class="btn-danger text-xs self-start" @click="onLogout">Desconectar</button>
    </div>

    <template v-if="character">
      <div class="card space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 class="font-heading text-3xl text-nd-gold">{{ character.name }}</h3>
            <p class="text-nd-text-secondary font-data text-sm mt-1">
              {{ ROLE_LABELS[character.role] }} · Origem: {{ ORIGIN_LABELS[character.origin] }}
            </p>
          </div>
          <span
            class="self-start font-data text-xs uppercase tracking-widest border border-nd-cyan/40 text-nd-cyan rounded-terminal px-2 py-1"
          >
            ROUND 1 // ATIVO
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div
            v-for="key in ATTRIBUTE_KEYS"
            :key="key"
            class="bg-nd-bg/60 border border-nd-cyan/20 rounded-terminal p-3 text-center"
          >
            <div class="text-nd-text-secondary text-xs font-data uppercase tracking-wider">
              {{ ATTRIBUTE_LABELS[key] }}
            </div>
            <div :class="['font-data text-3xl mt-1', attributeHighlight(key)]">
              {{ character[key] }}
            </div>
          </div>
        </div>
      </div>

      <p class="text-nd-text-secondary text-xs font-data">
        // Sistemas de gig, chrome e street cred chegam na próxima fase do grid.
      </p>
    </template>

    <div v-else class="card text-center space-y-3">
      <p class="text-nd-text-secondary">Nenhum personagem vinculado a esta conta.</p>
      <RouterLink to="/create-character" class="btn-neon inline-block">Criar personagem</RouterLink>
    </div>
  </div>
</template>
