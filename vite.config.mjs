import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // <-- important for file:// loading in Electron
  plugins: [react(), tailwindcss()],
  // example: bump warning threshold
  build: {
    chunkSizeWarningLimit: 1000, // in kB
    outDir: 'dist',
  }
});
