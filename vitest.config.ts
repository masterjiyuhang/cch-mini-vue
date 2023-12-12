import { defineConfig } from 'vite'
import { entries } from './scripts/aliases'

export default defineConfig({
  define: {
    __TEST__: true
  },
  resolve: {
    alias: entries
  }
})
