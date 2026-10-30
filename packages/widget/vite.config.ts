import { defineConfig } from "vite";
import { resolve } from "node:path";

function iife(entry: string, name: string) {
  return defineConfig({
    build: {
      lib: {
        entry: resolve(__dirname, entry),
        name,
        fileName: () => `${name}.iife.js`,
        formats: ["iife"],
      },
      outDir: "dist",
      emptyOutDir: name === "embed",
    },
  });
}

// Default: embed (host built via npm run build:host)
export default iife("src/embed.ts", "embed");
