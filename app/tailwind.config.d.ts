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
      fontFamily: Record<string, string[]>;
      borderRadius: Record<string, string>;
      boxShadow: Record<string, string>;
      screens: Record<string, string>;
      fontSize: Record<string, [string, { lineHeight: string }]>;
      transitionDuration: Record<string, string>;
      zIndex: Record<string, number>;
      minHeight: Record<string, string>;
      minWidth: Record<string, string>;
      animation: Record<string, string>;
      keyframes: Record<string, Record<string, Record<string, string>>>;
    };
  };
};

export default config;
