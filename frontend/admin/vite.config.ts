import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { proxyTo } from "../vite.proxy";

const rewriteAdmin = (path: string) => path.replace(/^\/api/, "");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..",
  server: {
    port: 3004,
    proxy: {
      "/auth": proxyTo(3003),
      "/graphql": proxyTo(3006),
      "/api/admin/users": proxyTo(3005, { rewrite: rewriteAdmin }),
      "/api/admin/me": proxyTo(3005, { rewrite: rewriteAdmin }),
      "/api/admin/stats": proxyTo(3005, { rewrite: rewriteAdmin }),
      "/api/admin/stores": proxyTo(3006, { rewrite: rewriteAdmin }),
      "/api/admin/orders": proxyTo(3007, { rewrite: rewriteAdmin }),
      "/api/stripe": proxyTo(3008),
      "/media": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/media/, "/rwa"),
      },
    },
  },
});
