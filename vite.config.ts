import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Servi depuis https://odolbeau.github.io/pixies-scoring/ (GitHub Pages,
  // project page) : les assets doivent être résolus sous ce sous-chemin.
  base: '/pixies-scoring/',
  plugins: [react()],
})
