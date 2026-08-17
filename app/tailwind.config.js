/** @type {import('tailwindcss').Config} */
import forms from "@tailwindcss/forms";
import { tokens } from "./src/lib/tokens";

export default {
  content: ["./index.html", "./src/**/*.{tsx,ts,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: {
        heading: ['"JetBrains Mono"', "monospace"],
        body: ["Inter", "sans-serif"],
        data: ['"Fira Code"', "monospace"],
        terminal: ['"Courier New"', '"Fira Code"', "monospace"],
      },
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      screens: tokens.screens,
      fontSize: tokens.fontSize,
      transitionDuration: tokens.transitionDuration,
      animation: {
        glitch: "glitch 0.2s ease-in-out infinite alternate",
        flicker: "flicker 0.15s ease-in-out infinite alternate",
        "pulse-neon": "pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        glitch: {
          "0%": { transform: "translate(0)" },
          "20%": { transform: "translate(-1px, 1px)" },
          "40%": { transform: "translate(1px, -1px)" },
          "60%": { transform: "translate(-1px, 0)" },
          "80%": { transform: "translate(1px, 0)" },
          "100%": { transform: "translate(0)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        "pulse-neon": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [forms],
};
