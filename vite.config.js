import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    proxy: { '/api': { target: 'http://127.0.0.1:4310', changeOrigin: true } },
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
