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
        harvest: {
          DEFAULT: "#E8B84A",
          soft: "#FBF3D5",
          strong: "#C4921A",
        },
        // Warm field canvas
        neutral: {
          DEFAULT: "#F6F3EA",
          50: "#F6F3EA",
          100: "#EEE8D8",
          200: "#E4DDCC",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#5C6B63",
          600: "#4B5563",
          700: "#374151",
          800: "#1F2937",
          900: "#1A2E24",
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
        sand: "#F6F3EA",
        ink: "#1A2E24",
        muted: "#5C6B63",
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
        caption: ["15px", { lineHeight: "22px" }],
        body: ["18px", { lineHeight: "28px" }],
        "body-lg": ["20px", { lineHeight: "30px" }],
        title: ["24px", { lineHeight: "32px" }],
        display: ["32px", { lineHeight: "40px" }],
        hero: ["40px", { lineHeight: "48px" }],
      },
      minHeight: {
        touch: "52px",
        "touch-lg": "64px",
      },
      borderRadius: {
        card: "16px",
      },
    },
  },
  plugins: [],
};
