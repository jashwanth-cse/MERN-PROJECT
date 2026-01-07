/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Reference Design Color Palette
        primary: '#36e27b',
        'background-light': '#f6f8f7',
        'background-dark': '#112117',
        'surface-dark': '#1a2b22',
        'border-dark': '#2a4535',
        'text-muted': '#95c6a9',
        'input-bg': '#111915',
        'input-placeholder': '#5a7865',
      },
      fontFamily: {
        sans: ['Spline Sans', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Spline Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(54, 226, 123, 0.3)',
        'glow-lg': '0 0 40px rgba(54, 226, 123, 0.4)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'wave': 'wave 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        'wave': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};


