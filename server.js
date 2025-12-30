import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy configuration for Ollama
app.use('/ollama-proxy', createProxyMiddleware({
    target: 'https://ollama.com',
    changeOrigin: true,
    pathRewrite: {
        '^/ollama-proxy': '',
    },
    on: {
        proxyReq: (proxyReq, req, res) => {
            // Inject the API key from server-side environment variables
            const apiKey = process.env.OLLAMA_API_KEY;
            console.log(`[Proxy] Routing ${req.method} ${req.url} -> ${proxyReq.path}`);
            if (apiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
                console.log('[Proxy] Authorization header injected');
            } else {
                console.warn('[Proxy] OLLAMA_API_KEY is not defined in environment variables');
            }
        },
        error: (err, req, res) => {
            console.error('[Proxy] Error:', err);
        }
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
