/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#101820",
        seal: "#0B3B5C",
        "seal-dark": "#082A42",
        parchment: "#F7F3EA",
        brass: "#B98A3E",
        "brass-light": "#E4C88C",
        moss: "#3E6B4F",
        clay: "#B4483B",
        mist: "#E9EEF1",
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        seal: "3px",
      },
    },
  },
  plugins: [],
};
