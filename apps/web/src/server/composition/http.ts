import "server-only";

/**
 * Comprueba que una mutación HTTP provenga del mismo origen.
 * Soporta proxies que encadenan `x-forwarded-proto` separado por comas (p. ej. "https, http")
 * y la normalización local de 127.0.0.1 / localhost en Next.js.
 */
export function isSameOriginRequest(request: Request): boolean {
  const source = request.headers.get("origin");
  if (!source) return false;
  const target = new URL(request.url);
  if (source === target.origin) return true;
  const host = request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const scheme = forwardedProto || target.protocol.slice(0, -1);
  return Boolean(host) && (scheme === "https" || scheme === "http") && source === `${scheme}://${host}`;
}

export function isJsonContentType(request: Request): boolean {
  return request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() === "application/json";
}
