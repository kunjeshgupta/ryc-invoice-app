import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'dist-file',
    assetsInlineLimit: 100_000_000, // inline everything — logo, fonts, all assets
    cssCodeSplit: false,
  },
})
