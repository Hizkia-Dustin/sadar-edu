/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "neon-cyan": "#00f3ff",
        "neon-green": "#39ff14",
      },
    },
  },
  plugins: [],
};
