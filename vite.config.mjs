import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // <-- important for file:// loading in Electron
  plugins: [react(), tailwindcss()],
  // Strip console.log/warn/debug/info from production builds (keep console.error)
  esbuild: {
    pure: ['console.log', 'console.warn', 'console.debug', 'console.info'],
  },
  build: {
    chunkSizeWarningLimit: 600, // in kB
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate heavy vendor libs into their own cacheable chunks
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-motion': ['framer-motion'],
          'vendor-router': ['react-router-dom'],
        },
      },
    },
  }
});
