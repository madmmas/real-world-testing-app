const gateway = (process.env.API_GATEWAY_URL ?? "").trim().replace(/\/$/, "");

export function proxyTo(port: number, extra: Record<string, unknown> = {}) {
  return {
    target: gateway || `http://localhost:${port}`,
    changeOrigin: true,
    xfwd: true,
    ...extra,
  };
}
