import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rewriteAdmin = (path: string) => path.replace(/^\/api/, "");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..",
  server: {
    port: 3004,
    proxy: {
      "/auth": { target: "http://localhost:3003", changeOrigin: true },
      "/graphql": { target: "http://localhost:3006", changeOrigin: true },
      "/api/admin/users": { target: "http://localhost:3005", changeOrigin: true, rewrite: rewriteAdmin },
      "/api/admin/me": { target: "http://localhost:3005", changeOrigin: true, rewrite: rewriteAdmin },
      "/api/admin/stats": { target: "http://localhost:3005", changeOrigin: true, rewrite: rewriteAdmin },
      "/api/admin/stores": { target: "http://localhost:3006", changeOrigin: true, rewrite: rewriteAdmin },
      "/api/admin/orders": { target: "http://localhost:3007", changeOrigin: true, rewrite: rewriteAdmin },
      "/api/stripe": { target: "http://localhost:3008", changeOrigin: true },
    },
  },
});
