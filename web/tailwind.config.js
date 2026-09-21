/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#18251e',
          light: '#213229',
          dark: '#111a15',
          darker: '#0a100d',
        },
        brand: {
          50: '#edf8ea',
          100: '#d2efc9',
          200: '#a8df95',
          300: '#7dcc61',
          400: '#6dbe5a',
          500: '#4a9e38',
          600: '#3a7e2c',
          700: '#2a5e20',
          800: '#1a3e14',
          900: '#0d1f0a',
        },
        text: {
          primary: '#edf5ea',
          secondary: '#a9bca4',
          muted: '#72846e',
        },
        border: {
          DEFAULT: 'rgba(168,210,154,0.13)',
          strong: 'rgba(168,210,154,0.24)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
        sm: '6px',
      },
    },
  },
  plugins: [],
};
