import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './', // <-- important for file:// loading in Electron
  plugins: [react(), tailwindcss()],
  // Strip console.log/warn/debug/info from production builds only (keep console.error)
  esbuild: {
    ...(mode === 'production' && {
      pure: ['console.log', 'console.warn', 'console.debug', 'console.info'],
    }),
  },
  build: {
    chunkSizeWarningLimit: 600, // in kB
    outDir: 'dist',
    rollupOptions: {
      // Exclude html2canvas — it's an optional transitive dep of jsPDF, never imported
      external: ['html2canvas'],
      output: {
        manualChunks: {
          // Separate heavy vendor libs into their own cacheable chunks
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-router': ['react-router-dom'],
        },
      },
    },
  }
}));