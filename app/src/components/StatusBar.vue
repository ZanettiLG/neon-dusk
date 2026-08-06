<script setup lang="ts">
import { onMounted } from "vue";
import { useAppStore } from "@/stores/app";

const store = useAppStore();

onMounted(() => {
  store.checkHealth();
});
</script>

<template>
  <div class="flex items-center gap-2 text-xs font-data">
    <!-- Loading -->
    <span v-if="store.healthLoading" class="text-nd-text-secondary animate-pulse-neon">
      ▌ connecting...
    </span>

    <!-- Error -->
    <span
      v-else-if="store.healthError"
      class="text-nd-magenta cursor-pointer"
      title="Click to retry"
      @click="store.checkHealth()"
    >
      ◌ offline
    </span>

    <!-- Healthy -->
    <span v-else-if="store.isHealthy" class="text-nd-green"> ● online </span>

    <!-- Degraded -->
    <span v-else class="text-nd-gold"> ◌ degraded </span>
  </div>
</template>
