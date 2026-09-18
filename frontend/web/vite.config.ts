import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: "../..",
  server: {
    port: 3000,
    proxy: {
      "/auth": { target: "http://localhost:3003", changeOrigin: true },
      "/graphql": { target: "http://localhost:3006", changeOrigin: true },
      "/me/orders": { target: "http://localhost:3007", changeOrigin: true },
      "/me/sales": { target: "http://localhost:3007", changeOrigin: true },
      "/me/store": { target: "http://localhost:3006", changeOrigin: true },
      "/me/stripe": { target: "http://localhost:3006", changeOrigin: true },
      "/me/keys": { target: "http://localhost:3009", changeOrigin: true },
      "/me": { target: "http://localhost:3005", changeOrigin: true },
      "/checkout": { target: "http://localhost:3007", changeOrigin: true },
      "/config": { target: "http://localhost:3008", changeOrigin: true },
    },
  },
});
