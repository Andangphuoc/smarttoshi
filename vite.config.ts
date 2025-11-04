  import path from 'path';
  import { defineConfig, loadEnv } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig(({ mode }) => {
      const env = loadEnv(mode, '.', '');
      return {
        server: {
          port: 3000,
        },
        plugins: [react()],
        define: {
          // Prefer environment variables provided at build time (e.g. by Vercel).
          // If not present, fall back to .env files loaded by loadEnv.
          'process.env.API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY),
          'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY)
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '.'),
          }
        }
        ,
        build: {
          outDir: 'dist'
        }
      };
  });
