import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
      "/condition-api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/condition-api/, "")
      }
    }
  }
});
