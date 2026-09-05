/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1B2733",
        canvas: "#93A9C2",        // outer page background (slate blue)
        seal: "#0C2E4E",          // sidebar / primary navy
        "seal-dark": "#081D33",   // deeper navy for hovers
        parchment: "#F8FAFC",     // near-white, used as text-on-navy
        brass: "#2F6FED",         // accent blue (links, active icon tint)
        "brass-light": "#E4ECFC",// light blue tint for badges/backgrounds
        moss: "#16A34A",          // success / positive delta / active
        clay: "#DC2626",          // danger / declined / late
        mist: "#EEF2F6",          // subtle field / divider background
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        seal: "3px",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(400px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};
