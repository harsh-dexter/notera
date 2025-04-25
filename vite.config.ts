import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// Removed lovable-tagger import

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './', // Add this line for Electron compatibility
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Removed componentTagger() usage
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
