import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "./scripts/vite/sites-vite-plugin";
import { configureToolEnvironment } from "./scripts/tool-environment.mjs";

// Auth middleware runs before the Worker and only simulates identity on loopback.
configureToolEnvironment(process.cwd());
export default defineConfig({
  appType: "spa",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  plugins: [
    sites(),
    cloudflare({
      viteEnvironment: { name: "server" },
      inspectorPort: false,
      config: {
        name: "taskboard-worker",
        main: "worker/index.js",
        compatibility_date: "2026-05-15",
        compatibility_flags: ["nodejs_compat"],
        assets: {
          binding: "ASSETS",
          not_found_handling: "single-page-application",
          run_worker_first: ["/api/*"],
        },
        d1_databases: [
          {
            binding: "DB",
            database_name: "site-creator-d1",
            database_id: "00000000-0000-4000-8000-000000000000",
          },
        ],
      },
    }),
  ],
  environments: {
    client: { build: { outDir: "dist/client" } },
    server: { build: { outDir: "dist/server" } },
  },
});
