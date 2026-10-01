/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#2563EB", dark: "#1D4ED8", light: "#DBEAFE" },
      },
    },
  },
  plugins: [],
};
