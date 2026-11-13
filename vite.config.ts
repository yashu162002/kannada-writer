import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ['@tiptap/react', '@tiptap/starter-kit'],
          export: ['docx', 'jspdf', 'jszip'],
          vendor: ['react', 'react-dom', 'dexie'],
        },
      },
    },
  },
})
