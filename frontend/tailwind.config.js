/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design system — clean clinical light theme
        surface: "#F4F6F8",       // page background
        card:    "#FFFFFF",       // card background
        teal: {
          50:  "#EAF6F5",
          100: "#C8ECEA",
          200: "#98D8D4",
          300: "#68C4BF",
          400: "#4BB3AD",
          500: "#3AA49E",         // primary accent
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
          900: "#1A1D23",
          800: "#2C3039",
          700: "#454A56",
          600: "#606570",
          500: "#8B8F99",
          400: "#B0B4BF",
          300: "#CDD0D8",
          200: "#E4E6EB",
          100: "#F0F2F5",
          50:  "#F8F9FA",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
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
