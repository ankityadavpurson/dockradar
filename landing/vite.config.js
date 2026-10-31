import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The app version shipped with this commit — the fallback shown if the live
// "latest release" lookup (src/useLatestVersion.js) is unavailable. The
// pipeline deploys the site before it cuts the release, so this lags the newest
// release by one; the runtime lookup is what keeps the page current.
function appVersion() {
  try {
    return JSON.parse(readFileSync(new URL('../frontend/package.json', import.meta.url), 'utf8')).version ?? ''
  } catch {
    return ''
  }
}

// Relative base so the build works from any host path (GitHub Pages project
// sites, a sub-folder, or a root domain) without further configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
