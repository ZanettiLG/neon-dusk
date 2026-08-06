<script setup lang="ts">
import { onMounted } from "vue";
import { useAppStore } from "@/stores/app";

const store = useAppStore();

onMounted(() => {
  store.checkHealth();
});
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-8 py-16">
    <!-- Hero -->
    <div class="text-center space-y-4">
      <h2 class="font-heading text-4xl md:text-6xl text-nd-cyan">
        NEON<span class="text-nd-magenta">//</span>DUSK
      </h2>
      <p class="text-nd-text-secondary text-lg font-body max-w-md mx-auto">
        Build your chrome. Burn your name. Leave a legend.
      </p>
    </div>

    <!-- System Status Card -->
    <div class="card w-full max-w-md space-y-3">
      <h3 class="font-heading text-nd-cyan">System Status</h3>

      <div v-if="store.healthLoading" class="text-nd-text-secondary font-data text-sm">
        <span class="animate-pulse-neon">▌ Checking connection...</span>
      </div>

      <div v-else-if="store.healthError" class="space-y-2">
        <p class="text-nd-magenta font-data text-sm">{{ store.healthError }}</p>
        <button @click="store.checkHealth()" class="btn-neon text-xs">Retry</button>
      </div>

      <div v-else-if="store.health" class="font-data text-sm space-y-2">
        <div class="flex justify-between">
          <span class="text-nd-text-secondary">Status</span>
          <span :class="store.isHealthy ? 'text-nd-green' : 'text-nd-magenta'">
            {{ store.isHealthy ? "● ONLINE" : "◌ DEGRADED" }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-nd-text-secondary">Database</span>
          <span :class="store.dbConnected ? 'text-nd-green' : 'text-nd-magenta'">
            {{ store.health.services.database }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-nd-text-secondary">Redis</span>
          <span :class="store.redisConnected ? 'text-nd-green' : 'text-nd-magenta'">
            {{ store.health.services.redis }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-nd-text-secondary">Uptime</span>
          <span class="text-nd-gold">{{ Math.floor(store.health.uptime) }}s</span>
        </div>
        <div class="flex justify-between">
          <span class="text-nd-text-secondary">Version</span>
          <span class="text-nd-gold">{{ store.health.version }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
