/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Geist is Vercel/Next.js's own typeface — fall back to system sans
        sans:    ['"Geist"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Geist"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: {
          base:    '#000000',
          surface: 'rgba(0,0,0,0.5)',
          card:    '#111111',
          hover:   '#1a1a1a',
        },
        border:  '#333333',
        ink: {
          primary:   '#ededed',
          secondary: '#888888',
          muted:     '#444444',
        },
        accent: {
          white:  '#ffffff',
          blue:   '#0070f3',   // Vercel blue — used sparingly
          green:  '#50e3c2',
          yellow: '#f5a623',
          red:    '#e00',
        },
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
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        pulse_soft: 'pulse_soft 2s ease-in-out infinite',
        fade_in:    'fade_in 0.2s ease-out both',
        shimmer:    'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
}
