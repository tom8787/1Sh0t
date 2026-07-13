import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "gh-pages-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      output: { entryFileNames: "assets/app-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" },
    },
  },
});
