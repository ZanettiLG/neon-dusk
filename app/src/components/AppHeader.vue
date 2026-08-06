<script setup lang="ts">
import StatusBar from "./StatusBar.vue";
</script>

<template>
  <header class="bg-nd-surface border-b border-nd-cyan/20 px-4 py-3">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <h1 class="font-heading text-nd-cyan text-xl tracking-widest">
        NEON<span class="text-nd-magenta">//</span>DUSK
      </h1>
      <div class="flex items-center gap-4">
        <StatusBar />
        <span class="text-nd-text-secondary text-xs font-data"> v0.1.0-alpha </span>
      </div>
    </div>
  </header>
</template>
