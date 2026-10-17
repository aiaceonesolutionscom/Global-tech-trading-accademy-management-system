import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          200: "#bcdbff",
          300: "#8ec5ff",
          400: "#59a4ff",
          500: "#2b80ff",
          600: "#0066ff",
          700: "#0052cc",
          800: "#003d99",
          900: "#002b66",
          950: "#001b48",
        },
        navy: {
          950: "#000c24",
          900: "#001B48",
          800: "#002B66",
          700: "#073B82",
        },
        azure: {
          600: "#0052CC",
          500: "#0066FF",
          400: "#0088FF",
          300: "#33A3FF",
          200: "#7CC7FC",
        },
      },
      fontFamily: {
        sans: ["Inter", "Plus Jakarta Sans", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        brand: "0 8px 30px -4px rgba(0, 43, 102, 0.15)",
        "brand-lg": "0 20px 45px -10px rgba(0, 82, 204, 0.25)",
        "brand-glow": "0 0 25px rgba(0, 102, 255, 0.45)",
        "card-hover": "0 16px 36px -6px rgba(0, 27, 72, 0.12), 0 4px 12px -2px rgba(0, 102, 255, 0.08)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #001B48 0%, #002B66 45%, #0066FF 100%)",
        "brand-radial": "radial-gradient(circle at top right, rgba(0, 136, 255, 0.22), transparent 65%)",
      },
    },
  },
  plugins: [],
};

export default config;
