/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Aronno Refined — Primary #064E3B
        primary: {
          DEFAULT: "#064E3B",
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
          950: "#022C22",
        },
        // Secondary mint #D1FAE5
        secondary: {
          DEFAULT: "#D1FAE5",
          soft: "#ECFDF5",
          strong: "#A7F3D0",
        },
        // Tertiary / bright action green #10B981
        tertiary: {
          DEFAULT: "#10B981",
          soft: "#D1FAE5",
          strong: "#059669",
        },
        // Neutral canvas #F9FAFB
        neutral: {
          DEFAULT: "#F9FAFB",
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#111827",
        },
        // Aliases used across existing components
        forest: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
        },
        leaf: {
          100: "#ECFDF5",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#10B981",
        },
        soil: {
          50: "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          500: "#6B7280",
          700: "#374151",
        },
        sand: "#F9FAFB",
        ink: "#111827",
        muted: "#6B7280",
        accent: {
          DEFAULT: "#10B981",
          soft: "#D1FAE5",
          strong: "#059669",
        },
        severity: {
          low: "#047857",
          "low-bg": "#D1FAE5",
          medium: "#B54708",
          "medium-bg": "#FCEFDF",
          high: "#B42318",
          "high-bg": "#FCE8E6",
        },
      },
      fontFamily: {
        bengali: ["NotoSansBengali_400Regular"],
        "bengali-medium": ["NotoSansBengali_500Medium"],
        "bengali-semibold": ["NotoSansBengali_600SemiBold"],
        "bengali-bold": ["NotoSansBengali_700Bold"],
      },
      fontSize: {
        caption: ["14px", { lineHeight: "20px" }],
        body: ["16px", { lineHeight: "24px" }],
        "body-lg": ["18px", { lineHeight: "28px" }],
        title: ["22px", { lineHeight: "30px" }],
        display: ["28px", { lineHeight: "36px" }],
        hero: ["40px", { lineHeight: "48px" }],
      },
      minHeight: {
        touch: "48px",
        "touch-lg": "56px",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
