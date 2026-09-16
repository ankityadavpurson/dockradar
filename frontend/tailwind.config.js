/** @type {import('tailwindcss').Config} */

// Windows 11 type stacks — resolved from the OS, no web-font request.
const segoe = [
  '"Segoe UI Variable Text"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui',
  '-apple-system', 'BlinkMacSystemFont', 'Roboto', '"Helvetica Neue"', 'sans-serif',
]

// Fluent "decelerate" curve used for entrance motion.
const fluentEase = 'cubic-bezier(0.1, 0.9, 0.2, 1)'

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    segoe,
        display: ['"Segoe UI Variable Display"', ...segoe],
        mono:    ['"Cascadia Mono"', '"Cascadia Code"', 'Consolas', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        pulse_soft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        fade_in: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scale_in: {
          from: { opacity: '0', transform: 'scale(1.04)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        slide_in_right: {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        pulse_soft:     'pulse_soft 2s ease-in-out infinite',
        fade_in:        `fade_in 0.25s ${fluentEase} both`,
        scale_in:       `scale_in 0.25s ${fluentEase} both`,
        slide_in_right: `slide_in_right 0.3s ${fluentEase} both`,
        shimmer:        'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
