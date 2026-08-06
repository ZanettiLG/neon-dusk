<script setup lang="ts">
import { reactive, ref, computed } from "vue";
import type { Attributes, AttributeKey, CreateCharacterRequest, Origin, Role } from "@neon-dusk/shared";
import {
  ATTRIBUTE_KEYS,
  ATTR_TOTAL,
  BASE_ATTRIBUTES,
  MAX_ATTR,
  MIN_ATTR,
  ORIGINS,
  ROLES,
} from "@neon-dusk/shared";
import { ATTRIBUTE_LABELS, ORIGIN_LABELS, ROLE_LABELS } from "@/lib/labels";

const props = defineProps<{
  loading: boolean;
}>();

const emit = defineEmits<{
  submit: [payload: CreateCharacterRequest];
}>();

const name = ref("");
const origin = ref<Origin | "">("");
const role = ref<Role | "">("");

const attributes = reactive<Attributes>({
  body: BASE_ATTRIBUTES,
  reflexes: BASE_ATTRIBUTES,
  intelligence: BASE_ATTRIBUTES,
  technical: BASE_ATTRIBUTES,
  cool: BASE_ATTRIBUTES,
});

const spent = computed(() => ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributes[key], 0));
// Free pool: starts at 7 and shrinks as points are placed.
const remaining = computed(() => ATTR_TOTAL - spent.value);

const canIncrease = (key: AttributeKey) => remaining.value > 0 && attributes[key] < MAX_ATTR;
const canDecrease = (key: AttributeKey) => attributes[key] > MIN_ATTR;

function adjust(key: AttributeKey, delta: 1 | -1): void {
  if (delta === 1 && canIncrease(key)) attributes[key] += 1;
  if (delta === -1 && canDecrease(key)) attributes[key] -= 1;
}

const valid = computed(
  () =>
    name.value.trim().length >= 2 &&
    origin.value !== "" &&
    role.value !== "" &&
    remaining.value === 0,
);

function onSubmit() {
  if (!valid.value) return;
  emit("submit", {
    name: name.value.trim(),
    origin: origin.value as Origin,
    role: role.value as Role,
    attributes: { ...attributes },
  });
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="onSubmit">
    <!-- Identity -->
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block space-y-1">
        <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
          Codinome
        </span>
        <input
          v-model="name"
          type="text"
          required
          maxlength="24"
          placeholder="Ex.: Cobra, Ghost, Viper"
          class="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
        />
      </label>

      <label class="block space-y-1">
        <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
          Distrito de origem
        </span>
        <select
          v-model="origin"
          required
          class="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
        >
          <option value="" disabled>Selecione o distrito</option>
          <option v-for="o in ORIGINS" :key="o" :value="o">{{ ORIGIN_LABELS[o] }}</option>
        </select>
      </label>

      <label class="block space-y-1 sm:col-span-2">
        <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
          Role
        </span>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <button
            v-for="r in ROLES"
            :key="r"
            type="button"
            @click="role = r"
            :class="[
              'border rounded-terminal px-3 py-2 text-xs font-data uppercase tracking-wider transition-all',
              role === r
                ? 'border-nd-magenta bg-nd-magenta/10 text-nd-magenta shadow-neon-magenta'
                : 'border-nd-cyan/30 text-nd-text-secondary hover:border-nd-cyan/60 hover:text-nd-text',
            ]"
          >
            {{ ROLE_LABELS[r] }}
          </button>
        </div>
      </label>
    </div>

    <!-- Attributes -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
          Distribuição de atributos
        </span>
        <span
          :class="remaining === 0 ? 'text-nd-green' : 'text-nd-gold'"
          class="font-data text-sm"
        >
          {{ remaining }} ponto{{ remaining === 1 ? "" : "s" }} restante{{
            remaining === 1 ? "" : "s"
          }}
        </span>
      </div>

      <div class="space-y-2">
        <div
          v-for="key in ATTRIBUTE_KEYS"
          :key="key"
          class="flex items-center justify-between bg-nd-bg/60 border border-nd-cyan/20 rounded-terminal px-3 py-2"
        >
          <span class="text-nd-text text-sm w-28">{{ ATTRIBUTE_LABELS[key] }}</span>
          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="!canDecrease(key)"
              class="w-8 h-8 border border-nd-cyan/40 text-nd-cyan rounded-terminal hover:bg-nd-cyan/10 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Diminuir"
              @click="adjust(key, -1)"
            >
              −
            </button>
            <span class="font-data text-nd-cyan text-lg w-8 text-center tabular-nums">
              {{ attributes[key] }}
            </span>
            <button
              type="button"
              :disabled="!canIncrease(key)"
              class="w-8 h-8 border border-nd-cyan/40 text-nd-cyan rounded-terminal hover:bg-nd-cyan/10 disabled:opacity-30 disabled:hover:bg-transparent"
              aria-label="Aumentar"
              @click="adjust(key, 1)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <p class="text-nd-text-secondary text-xs">
        Base {{ BASE_ATTRIBUTES }} em cada atributo. Total: {{ spent }}/{{ ATTR_TOTAL }} pontos.
      </p>
    </div>

    <button type="submit" :disabled="!valid || props.loading" class="btn-neon w-full disabled:opacity-50">
      {{ props.loading ? "FORJANDO PERSONAGEM..." : "CRIAR PERSONAGEM" }}
    </button>
  </form>
</template>
