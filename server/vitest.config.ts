import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // fork pool: postgres-js and ioredis don't play well with worker threads
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    teardownTimeout: 10000,
  },
});
