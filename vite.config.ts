import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

// Fail the build when Supabase config is missing, rather than shipping a bundle
// that throws on first paint. Vercel ignores committed .env files, so on Vercel
// these must be set in Project Settings → Environment Variables (loadEnv also
// picks up VITE_-prefixed vars from the build environment, which is how they
// arrive there); locally they come from .env.
function assertRequiredEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const missing = REQUIRED_ENV.filter((key) => !env[key] && !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}.\n` +
        `Set them in .env (see .env.example) for local builds, or in Vercel under\n` +
        `Project Settings → Environment Variables for deployed builds.`,
    );
  }
}

// Plain Vite + React SPA — no SSR, no server entry, no Cloudflare/nitro target.
// `@` path alias resolves from tsconfig.json's "paths".
export default defineConfig(({ command, mode }) => {
  if (command === "build") assertRequiredEnv(mode);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      tsconfigPaths: true,
    },
    build: {
      outDir: "dist",
    },
  };
});
