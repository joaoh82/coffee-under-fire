import { SITE_HEAD } from "./packages/shared/site-meta";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Explicit shell opt-in for trusted tunnel hostnames; never accept every host.
const allowedHosts = (process.env.DEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);
if (
  allowedHosts.some(
    (host) => !/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host),
  )
) {
  throw new Error(
    "DEV_ALLOWED_HOSTS must contain exact hostnames, without schemes, paths, ports or wildcards",
  );
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "site-metadata",
      transformIndexHtml: (html) =>
        html.replace("<!-- SITE_METADATA -->", SITE_HEAD),
    },
  ],
  root: "apps/web",
  server: {
    host: "127.0.0.1",
    allowedHosts,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/leaderboard": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  build: { outDir: "../../dist/web", emptyOutDir: true },
});
