import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#10253F",
        gold: "#B79254",
      },
    },
  },
  plugins: [],
};

export default config;
