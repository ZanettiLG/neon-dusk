import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Scratch/temp files (e.g. agent smoke tests) never gate lint.
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/migrations/**",
      "**/.opencode/**",
      "**/*.tmp.*",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    files: ["server/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
