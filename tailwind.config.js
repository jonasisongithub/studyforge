/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#598dff",
          500: "#3366ff",
          600: "#1f47e6",
          700: "#1a37b8",
          800: "#1b3193",
          900: "#1c2f75",
        },
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "pop": { "0%": { transform: "scale(0.96)" }, "60%": { transform: "scale(1.02)" }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out both",
        "pop": "pop 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
