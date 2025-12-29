import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/ollama-proxy': {
          target: 'https://ollama.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/ollama-proxy/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              const authHeader = req.headers.authorization;
              console.log(`[Proxy] ${req.method} ${proxyReq.path}`);
              console.log(`[Proxy] Auth Header Present: ${!!authHeader}`);
              if (authHeader) {
                console.log(`[Proxy] Auth Header Prefix: ${authHeader.substring(0, 15)}...`);
              }
            });
            proxy.on('error', (err, _req, _res) => {
              console.error('[Proxy] Error:', err);
            });
          },
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OLLAMA_API_KEY': JSON.stringify(env.OLLAMA_API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || 'https://vngtmamxhvcldecesfwh.supabase.co'),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
