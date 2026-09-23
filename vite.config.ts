import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/ — must match the repo name.
  base: "/ifc-inspector/",
  plugins: [react()],
  optimizeDeps: {
    // Emscripten-based modules must not be pre-bundled by esbuild:
    // pre-bundling breaks the wasm glue (LinkError: __cxa_throw requires a callable).
    exclude: ["web-ifc", "@thatopen/components", "@thatopen/fragments"],
  },
});
