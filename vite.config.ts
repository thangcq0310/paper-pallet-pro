import { defineConfig } from "vite";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
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
