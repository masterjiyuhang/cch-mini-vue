import { defineConfig } from 'vitest/config'
import { entries } from './scripts/aliases'
import codspeedPlugin from '@codspeed/vitest-plugin'

export default defineConfig({
  define: {
    __TEST__: true
  },
  resolve: {
    alias: entries
  },
  plugins: [codspeedPlugin()],
  test: {
    globals: true
  }
})
