/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0E1B32",
          50: "#EEF1F6",
          700: "#16233C",
          900: "#0E1B32",
        },
        accent: {
          DEFAULT: "#2F6FED",
          50: "#EBF1FE",
          100: "#D6E4FD",
          600: "#2F6FED",
          700: "#2258C7",
        },
        slate: {
          25: "#FBFBFC",
          50: "#F7F8FA",
          100: "#EEF0F3",
          200: "#E4E7EC",
        },
        risk: {
          critical: "#7F1D1D",
          high: "#B91C1C",
          medium: "#B45309",
          low: "#15803D",
        },
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 27, 50, 0.06), 0 1px 3px rgba(14, 27, 50, 0.08)",
      },
      borderRadius: {
        card: "12px",
      },
    },
  },
  plugins: [],
};
