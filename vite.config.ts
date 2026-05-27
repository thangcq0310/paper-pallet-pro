import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";

export default defineConfig({
  root: "public",
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths(),
    tanstackRouterGenerator(),
  ],
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
});