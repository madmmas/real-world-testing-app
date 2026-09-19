export function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw;
}
