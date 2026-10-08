import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativo: como la app usa HashRouter, funciona igual en localhost y en
// GitHub Pages sin importar cómo se llame el repo.
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
})
