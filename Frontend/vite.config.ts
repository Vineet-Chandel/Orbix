import react from '@vitejs/plugin-react'
import { defineConfig, createLogger } from 'vite'

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
export default defineConfig({
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
})
