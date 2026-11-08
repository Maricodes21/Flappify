import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
