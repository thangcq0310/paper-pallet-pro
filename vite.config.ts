import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths(),
    tanstackRouterGenerator({
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts"
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});