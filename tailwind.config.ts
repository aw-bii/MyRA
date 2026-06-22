import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  darkMode: "class",
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  theme: {
    extend: {
      transitionTimingFunction: {
        press: "cubic-bezier(0.23, 1, 0.32, 1)",
        drawer: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "bounce-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 300ms cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "bounce-dot": "bounce-dot 1.4s ease-in-out infinite",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: "none",
            // Remove backticks around inline code
            "code::before": { content: '""' },
            "code::after": { content: '""' },
            code: {
              fontSize: "0.85em",
              fontFamily:
                'ui-monospace, "Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
              backgroundColor: "rgb(243 244 246)", // gray-100
              padding: "0.15em 0.35em",
              borderRadius: "0.25rem",
              fontWeight: "400",
            },
            pre: {
              backgroundColor: "rgb(17 24 39)", // gray-900
              borderRadius: "0.5rem",
              fontSize: "0.82em",
            },
            "pre code": {
              backgroundColor: "transparent",
              padding: "0",
              borderRadius: "0",
              fontWeight: "400",
            },
          },
        },
        invert: {
          css: {
            code: {
              backgroundColor: "rgb(31 41 55)", // gray-800
            },
          },
        },
      },
    },
  },
  plugins: [
    typography,
    function ({ addVariant }: { addVariant: Function }) {
      addVariant("hoverable", "@media (hover: hover) and (pointer: fine)");
    },
  ],
} satisfies Config;
