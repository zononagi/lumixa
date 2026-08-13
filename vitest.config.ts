import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/** Vitest resolves the same path aliases the app uses. */
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
})
