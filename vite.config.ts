import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ command }) => ({
  // En producción el portal se sirve bajo festivaldanzarte.com/portal/, así que
  // los assets tienen que referenciarse desde ahí. En dev el servidor escucha en
  // la raíz. Antes esto era "/" fijo y había que acordarse de pasar
  // `--base=/portal/` a mano: un build sin el flag rompía el sitio.
  base: command === "build" ? "/portal/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
}));
