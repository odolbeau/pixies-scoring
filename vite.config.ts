import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Servi depuis le domaine custom pixies.bbnt.me (racine), pas depuis
  // /pixies-scoring/ : les assets doivent être résolus à la racine.
  base: '/',
  plugins: [react()],
})
