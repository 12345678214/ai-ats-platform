import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the API is proxied so the browser talks to a single origin (no CORS setup needed).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'], react: ['react', 'react-dom', 'react-router-dom'] } } } },
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true } } },
});
