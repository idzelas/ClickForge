import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss({ optimize: false }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  envDir: path.resolve(import.meta.dirname, "..", ".."),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split three.js + R3F + drei out of the main bundle.  These weigh in
        // at multiple MB minified and are only needed by the Studio route, so
        // breaking them into their own chunk lets the marketing home page
        // and sign-in pages load without paying their parse cost.
        manualChunks: (id) => {
          if (
            id.includes("/node_modules/three/") ||
            id.includes("/node_modules/@react-three/")
          ) {
            return "three-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port,
    strictPort: false,
    host: "localhost",
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "localhost",
  },
});
