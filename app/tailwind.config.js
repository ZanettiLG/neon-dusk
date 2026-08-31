/** @type {import('tailwindcss').Config} */
import forms from "@tailwindcss/forms";
import { tokens } from "./src/lib/tokens";

export default {
  content: ["./index.html", "./src/**/*.{tsx,ts,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.boxShadow,
      screens: tokens.screens,
      fontSize: tokens.fontSize,
      transitionDuration: tokens.transitionDuration,
      zIndex: tokens.zIndex,
      minHeight: tokens.minHeight,
      minWidth: tokens.minWidth,
      animation: tokens.animation,
      keyframes: tokens.keyframes,
    },
  },
  plugins: [forms],
};
