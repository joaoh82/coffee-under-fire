import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  server: {
    host: "0.0.0.0",
    // Temporary playtest sharing: accept LAN addresses and arbitrary tunnels.
    allowedHosts: true,
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
