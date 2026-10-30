// WHAT: Scans app and component files for utility classes.
// WHY: Color values live in CSS variables so both themes stay explicit and consistent.
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
