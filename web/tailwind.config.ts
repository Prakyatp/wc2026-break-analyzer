import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: {
        brand: { DEFAULT: "#2563eb", light: "#eff6ff", dark: "#1d4ed8" },
      },
    },
  },
  plugins: [],
};
export default config;
