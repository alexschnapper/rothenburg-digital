import type { Config } from "tailwindcss";

/**
 * Farben, Schrift und Schriftgrößen kommen aus den Design-Tokens
 * (`public/design/tokens.css`, #119). Hier nur die Zuordnung zu den
 * Tailwind-Klassen; Werte ändern sich dort, nicht hier.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          fg: "var(--color-brand-fg)",
        },
      },
      textColor: {
        // Marke als Textfarbe: im Dunkeln heller, damit 7:1 hält
        brand: {
          DEFAULT: "var(--color-brand-text)",
          fg: "var(--color-brand-fg)",
        },
        // Gedämpfter Text mit geprüftem Kontrast — statt `opacity-*` auf Text
        muted: "var(--color-fg-muted)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
      // Skala aus den Tokens; `text-sm` ist bereits 16 px, `text-xs` nur für
      // kurze Beschriftungen, nicht für Fließtext.
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "1.5" }],
        sm: ["var(--text-sm)", { lineHeight: "1.5" }],
        base: ["var(--text-base)", { lineHeight: "1.55" }],
        lg: ["var(--text-lg)", { lineHeight: "1.45" }],
        xl: ["var(--text-xl)", { lineHeight: "1.4" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "1.3" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "1.25" }],
      },
      maxWidth: {
        measure: "var(--measure)",
      },
    },
  },
  plugins: [],
};

export default config;
