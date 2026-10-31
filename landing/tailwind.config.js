import xedonium from 'xedonium/tailwind-preset'

/** @type {import('tailwindcss').Config} */

// System type stacks — resolved from the OS, no web-font request.
const segoe = [
  '"Segoe UI Variable Text"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui',
  '-apple-system', 'BlinkMacSystemFont', 'Roboto', '"Helvetica Neue"', 'sans-serif',
]

// "Decelerate" curve used for entrance motion.
const easeDecelerate = 'cubic-bezier(0.1, 0.9, 0.2, 1)'

export default {
  presets: [xedonium],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}', './node_modules/xedonium/dist/**/*.js'],
  theme: {
    extend: {
      // Brand palette matched to the logo (radar blue ring, green sweep) — same as the dashboard.
      colors: {
        sky:     { 300: '#8fd3ff', 400: '#6fc9ff', 500: '#3fb6ff', 600: '#1a8fe8', 700: '#1478c4', 800: '#0f5f9c' },
        emerald: { 300: '#8ff5c0', 400: '#5ff0a6', 500: '#2ee58a', 600: '#16a864', 700: '#118650', 800: '#0e6a40' },
      },
      fontFamily: {
        sans:    segoe,
        display: ['"Segoe UI Variable Display"', ...segoe],
        mono:    ['"Cascadia Mono"', '"Cascadia Code"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        sweep: {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        blip: {
          '0%':   { opacity: '0', transform: 'scale(0.6)' },
          '15%':  { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(1.6)' },
        },
        fade_up: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        sweep:   'sweep 6s linear infinite',
        blip:    'blip 6s ease-out infinite',
        fade_up: `fade_up 0.6s ${easeDecelerate} both`,
      },
    },
  },
  plugins: [],
}
