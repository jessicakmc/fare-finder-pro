import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Plain Vite + React SPA config — no SSR, no server entry, no Cloudflare/nitro target.
// `@` path alias resolves from tsconfig.json's "paths" via Vite's native tsconfig-paths support.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    outDir: "dist",
  },
});
