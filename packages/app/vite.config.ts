import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// `--mode parity` builds only the parity-harness preview (parity-view.html) into dist-parity. The default build
// keeps Vite's default input (index.html) and never contains the preview entry.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Shown in the Lite footer's version line; defined in every mode.
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build:
    mode === 'parity'
      ? { outDir: 'dist-parity', emptyOutDir: true, rollupOptions: { input: { view: 'parity-view.html' } } }
      : { outDir: 'dist' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
}))
