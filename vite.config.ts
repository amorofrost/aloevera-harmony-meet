import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Proxy API requests to backend during development
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://20.153.164.3:5002',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/debug': {
        target: process.env.VITE_API_URL || 'https://20.153.164.3:5002',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in development
        rewrite: (path) => path.replace(/^\/debug/, '/debug'),
      }
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Define global constants for environment variables
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'https://20.153.164.3:5002'),
  },
}));
