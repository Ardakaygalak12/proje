import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const GEMINI_API_KEY = 'AIzaSyAAY-nW4x5mzgb7l1UkGN33JsACV0TlEUI';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
