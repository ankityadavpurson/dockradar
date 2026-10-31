import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works from any host path (GitHub Pages project
// sites, a sub-folder, or a root domain) without further configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
