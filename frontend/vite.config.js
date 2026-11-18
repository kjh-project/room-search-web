import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 개발 중 /api 요청은 Express 서버(기본 4000번)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
