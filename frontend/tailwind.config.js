/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        bg: {
          base:    '#07090f',
          surface: '#0d1117',
          card:    '#111827',
          hover:   '#161f30',
        },
        border: '#1c2a3a',
        ink: {
          primary:   '#dde3f0',
          secondary: '#7a8799',
          muted:     '#3d5166',
        },
        accent: {
          blue:   '#00d4ff',
          cyan:   '#06ffa5',
          yellow: '#ffd43b',
          red:    '#ff6b6b',
          green:  '#51cf66',
        },
      },
      keyframes: {
        pulse_soft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.3' },
        },
        fade_in: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        pulse_soft: 'pulse_soft 1.5s ease-in-out infinite',
        fade_in:    'fade_in 0.25s ease-out both',
        shimmer:    'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
