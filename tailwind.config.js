/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  presets: [require("nativewind/preset")],
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0a",
          900: "#121212",
          800: "#1a1a1a",
        },
        accent: {
          purple: "#A855F7",
          blue: "#3B82F6",
          yellow: "#FACC15",
          green: "#22C55E",
          red: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};
