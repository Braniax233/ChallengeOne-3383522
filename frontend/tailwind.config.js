/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: "#2E66F6",         // Bespoke modern clinical blue
        // Design system — clean clinical light theme
        surface: "#F8FAFC",       // softer slate-50 background
        card:    "#FFFFFF",       // card background
        teal: {
          50:  "#EAF6F5",
          100: "#C8ECEA",
          200: "#98D8D4",
          300: "#68C4BF",
          400: "#4BB3AD",
          500: "#3AA49E",         // keep teal for success/normal states
          600: "#2E9490",
          700: "#237F7A",
          800: "#1B6561",
          900: "#104241",
        },
        coral: {
          50:  "#FFF1EF",
          100: "#FFD8D3",
          200: "#FFB0A7",
          300: "#FF8877",
          400: "#F56152",         // warning / alert
          500: "#ED4C3C",
          600: "#D43929",
        },
        ink: {
          900: "#0F172A", // Deep rich slate instead of flat gray
          800: "#1E293B",
          700: "#334155",
          600: "#475569",
          500: "#64748B",
          400: "#94A3B8",
          300: "#CBD5E1",
          200: "#E2E8F0",
          100: "#F1F5F9",
          50:  "#F8FAFC",
        },
      },
      borderRadius: {
        xl:  "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card:   "0 1px 4px 0 rgba(0,0,0,0.06), 0 4px 16px 0 rgba(0,0,0,0.04)",
        "card-hover": "0 4px 20px 0 rgba(0,0,0,0.10)",
        soft:   "0 2px 8px 0 rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};
