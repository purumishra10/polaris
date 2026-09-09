import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(rootDir, '..')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@docs': repoRoot,
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
})
