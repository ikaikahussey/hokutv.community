import type { Config } from "tailwindcss";

/**
 * Tailwind is configured so that NO color is hardcoded in components.
 * Every brand color resolves to a CSS custom property that the theming layer
 * (Phase 4) sets per-tenant via `tenants.theme`. Components reference
 * `bg-brand-500`, `text-brand-foreground`, etc.; the actual hex values live in
 * `:root` / per-tenant style scopes as `--brand-*` variables.
 *
 * This indirection is load-bearing for the spec rule "no hardcoded colors" and
 * for runtime re-skinning without a rebuild.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--brand-500)",
          foreground: "var(--brand-foreground)",
          50: "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          300: "var(--brand-300)",
          400: "var(--brand-400)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          800: "var(--brand-800)",
          900: "var(--brand-900)",
          950: "var(--brand-950)",
        },
        accent: {
          DEFAULT: "var(--accent-500)",
          foreground: "var(--accent-foreground)",
        },
        surface: "var(--surface)",
        ink: "var(--ink)",
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
      },
    },
  },
  plugins: [],
};

export default config;
