import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Set VITE_BASE=/chuka-comrades/ when deploying to GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
