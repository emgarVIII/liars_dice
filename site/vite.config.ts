import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/liars_dice/" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
