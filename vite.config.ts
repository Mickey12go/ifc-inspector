import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Actions builds deploy to https://<user>.github.io/ifc-inspector/
  // (repo subpath), everything else (Vercel, local dev) serves from root.
  base: process.env.GITHUB_ACTIONS === "true" ? "/ifc-inspector/" : "/",
  plugins: [react()],
  optimizeDeps: {
    // Emscripten-based modules must not be pre-bundled by esbuild:
    // pre-bundling breaks the wasm glue (LinkError: __cxa_throw requires a callable).
    exclude: ["web-ifc", "@thatopen/components", "@thatopen/fragments"],
  },
});
