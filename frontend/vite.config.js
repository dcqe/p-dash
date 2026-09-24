import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4310',
        changeOrigin: true,
        headers: { Origin: 'http://127.0.0.1:4310' },
      },
      '/terminal': {
        target: 'ws://127.0.0.1:4310',
        ws: true,
        changeOrigin: true,
        headers: { Origin: 'http://127.0.0.1:4310' },
      },
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          terminal: ['@xterm/xterm', '@xterm/addon-fit'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
