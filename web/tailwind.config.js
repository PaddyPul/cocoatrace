/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1f2b22',
          light: '#243028',
          dark: '#161d17',
          darker: '#0f1410',
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
          primary: '#dde8d8',
          secondary: '#8fa888',
          muted: '#5a7055',
        },
        border: {
          DEFAULT: 'rgba(120,180,100,0.15)',
          strong: 'rgba(120,180,100,0.25)',
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
