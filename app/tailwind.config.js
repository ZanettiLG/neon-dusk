/** @type {import('tailwindcss').Config} */
import forms from "@tailwindcss/forms";

export default {
  content: ["./index.html", "./src/**/*.{tsx,ts,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "nd-bg": "#0a0a0f",
        "nd-surface": "#12121a",
        "nd-cyan": "#00f0ff",
        "nd-magenta": "#ff00aa",
        "nd-gold": "#ffcc00",
        "nd-purple": "#aa00ff",
        "nd-text": "#e0e0e0",
        "nd-text-secondary": "#888899",
        "nd-green": "#00ff66",
      },
      fontFamily: {
        heading: ['"JetBrains Mono"', "monospace"],
        body: ["Inter", "sans-serif"],
        data: ['"Fira Code"', "monospace"],
        terminal: ['"Courier New"', '"Fira Code"', "monospace"],
      },
      borderRadius: {
        terminal: "2px",
      },
      boxShadow: {
        "neon-cyan": "0 0 10px rgba(0, 240, 255, 0.3), 0 0 20px rgba(0, 240, 255, 0.1)",
        "neon-magenta": "0 0 10px rgba(255, 0, 170, 0.3), 0 0 20px rgba(255, 0, 170, 0.1)",
        "neon-gold": "0 0 10px rgba(255, 204, 0, 0.3), 0 0 20px rgba(255, 204, 0, 0.1)",
        "neon-purple": "0 0 10px rgba(170, 0, 255, 0.3), 0 0 20px rgba(170, 0, 255, 0.1)",
      },
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
