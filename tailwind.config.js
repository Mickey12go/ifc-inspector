/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(217 19% 20%)",
        background: "hsl(222 25% 8%)",
        surface: "hsl(220 22% 12%)",
        surface2: "hsl(220 20% 16%)",
        foreground: "hsl(210 20% 92%)",
        muted: "hsl(215 15% 60%)",
        accent: "hsl(199 89% 55%)",
        success: "hsl(142 70% 45%)",
        warning: "hsl(38 92% 50%)",
        danger: "hsl(0 72% 55%)",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
