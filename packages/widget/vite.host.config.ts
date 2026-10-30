import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/host-sdk.ts"),
      name: "host",
      fileName: () => "host.iife.js",
      formats: ["iife"],
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
