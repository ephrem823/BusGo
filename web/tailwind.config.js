/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#8b5cf6",
          dark:    "#7c3aed",
          light:   "#ede9fe",
        },
        cyan: {
          DEFAULT: "#06b6d4",
        },
        surface: {
          DEFAULT: "#0f0f1a",
          card:    "#13131f",
          border:  "rgba(255,255,255,0.08)",
        },
      },
    },
  },
  plugins: [],
};
