import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Numéro de version affiché en bas des Paramètres (à augmenter à chaque mise en production).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    port: 5173,
  },
})
