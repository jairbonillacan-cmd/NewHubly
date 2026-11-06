// Cabeceras de seguridad de Hubly (Constitución, Seguridad: «CSP con nonce y cabeceras estrictas»; issue #91).
// Sin dependencias de servidor: lo usa el middleware, que corre en el runtime de Next.

export interface CspOptions {
  nonce: string;
  isDev: boolean;
  /** Origen de Supabase (Auth); el navegador solo habla con él y con la propia app. */
  supabaseUrl?: string | undefined;
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const originOf = (url: string | undefined): string | null => {
  if (!url) return null;
  try { return new URL(url).origin; } catch { return null; }
};

export function buildContentSecurityPolicy({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const connect = ["'self'", ...(supabase ? [supabase] : []), ...(isDev ? ["ws:"] : [])];
  return [
    "default-src 'self'",
    // 'strict-dynamic' deja cargar los fragmentos que Next inyecta desde un script con nonce. 'unsafe-eval' solo en desarrollo (recarga en caliente).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Los componentes usan atributos style de React con valores de tokens; los atributos de estilo no ejecutan código.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/** Cabeceras fijas que acompañan a la CSP en todas las respuestas. */
export function staticSecurityHeaders(isProduction: boolean): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    // Sin «preload»: inscribir el dominio en la lista de precarga de los navegadores es una decisión del dueño y difícil de revertir.
    ...(isProduction ? { "Strict-Transport-Security": "max-age=63072000; includeSubDomains" } : {}),
  };
}
