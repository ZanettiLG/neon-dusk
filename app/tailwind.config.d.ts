/**
 * Type declaration for tailwind.config.js (plain ESM, transpiled by Tailwind's
 * jiti loader at runtime — it has no TypeScript declaration of its own).
 * Keeps the dynamic `import("../../tailwind.config.js")` in
 * src/lib/tokens.test.ts type-safe without enabling allowJs.
 */
declare const config: {
  theme: {
    extend: {
      colors: Record<string, string>;
      boxShadow: Record<string, string>;
    };
  };
};

export default config;
