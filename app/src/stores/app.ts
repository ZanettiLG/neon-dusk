import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { HealthResponse } from "@neon-dusk/shared";
import { api } from "@/api/client";

export const useAppStore = defineStore("app", () => {
  const health = ref<HealthResponse | null>(null);
  const healthError = ref<string | null>(null);
  const healthLoading = ref(false);

  const isHealthy = computed(() => health.value?.status === "ok");
  const dbConnected = computed(() => health.value?.services.database === "connected");
  const redisConnected = computed(() => health.value?.services.redis === "connected");

  async function checkHealth() {
    healthLoading.value = true;
    healthError.value = null;

    try {
      health.value = await api.get<HealthResponse>("/api/health");
    } catch (err) {
      healthError.value = err instanceof Error ? err.message : "Connection failed";
    } finally {
      healthLoading.value = false;
    }
  }

  return {
    health,
    healthError,
    healthLoading,
    isHealthy,
    dbConnected,
    redisConnected,
    checkHealth,
  };
});
