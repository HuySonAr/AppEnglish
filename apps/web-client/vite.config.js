import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  preview: { port: Number(process.env.WEB_CLIENT_PORT || 5173) },
  server: {
    port: Number(process.env.WEB_CLIENT_PORT || 5173),
    proxy: { '/auth': 'http://localhost:3000', '/health': 'http://localhost:3000' }
  },
  resolve: { alias: { '@': '/src' } }
});
