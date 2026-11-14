/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "neon-cyan": "#00f3ff",
        "neon-green": "#39ff14",
        // Palet halaman operator, nilai diambil dari desain Figma.
        navy: { DEFAULT: "#00324b", header: "#1c4966" },
        mist: "#d6ebff",
        canvas: "#f6f9ff",
        alert: { DEFAULT: "#ba1a1a", soft: "#ffd9d6" },
      },
      fontFamily: {
        operator: ['"Public Sans"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};