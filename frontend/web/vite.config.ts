import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { proxyTo } from "../vite.proxy";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..",
  server: {
    port: 3000,
    proxy: {
      "/auth": proxyTo(3003),
      "/graphql": proxyTo(3006),
      "/me/orders": proxyTo(3007),
      "/me/sales": proxyTo(3007),
      "/me/store": proxyTo(3009),
      "/me/stripe": proxyTo(3009),
      "/me/keys": proxyTo(3009),
      "/me": proxyTo(3003),
      "/checkout": proxyTo(3007),
      "/cart": proxyTo(3007),
      "/config": proxyTo(3008),
      "/media": {
        target: "http://localhost:9000",
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/media/, "/rwa"),
      },
    },
  },
});
