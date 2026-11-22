import react from '@vitejs/plugin-react'
import { defineConfig, createLogger, loadEnv } from 'vite'
import { siteConfig } from '../shared/seo/site.js'

const logger = createLogger()
const loggerError = logger.error

logger.error = (msg, options) => {
  // Suppress transient proxy connection errors (e.g. during backend reload / offline)
  if (typeof msg === 'string' && (msg.includes('http proxy error') || msg.includes('ECONNREFUSED'))) {
    return
  }
  loggerError(msg, options)
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['SITE_', 'SEO_']);
  const site = siteConfig({ ...env, SITE_URL: process.env.SITE_URL || env.SITE_URL, SEO_INDEXING_ENABLED: process.env.SEO_INDEXING_ENABLED || env.SEO_INDEXING_ENABLED, NODE_ENV: mode });
  return {
  define: { __PUBLIC_SITE_CONFIG__: JSON.stringify(site) },
  build: { sourcemap: false },
  customLogger: logger,
  plugins: [react()],
  assetsInclude: ['**/*.md'],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && 'writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  status: 'error',
                  message: 'Backend server is temporarily unreachable or restarting.',
                })
              );
            }
          });
        },
      },
    },
  },
  };
})
