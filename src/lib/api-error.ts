/**
 * Traduce el error que lanza `request<T>` (`api.ts`) a un texto mostrable.
 *
 * `request` tira `Error("<status>: <body crudo>")`, así que mostrar `err.message`
 * tal cual le pinta al usuario algo como
 * `409: {"message":"Tu plan cubre 3 inquilinos…","statusCode":409}`.
 * NestJS ya redacta el `message` en español para los casos que el usuario debe
 * entender (tope de plan, validaciones); este helper es el que lo saca.
 *
 * Misma regla que `field-labels.ts`: al usuario nunca le llega la forma cruda del
 * backend. Úsalo en TODO `catch` cuyo texto termine en pantalla.
 */
export function apiError(err: unknown, fallback = "Error al guardar. Inténtalo de nuevo."): string {
  if (!(err instanceof Error)) return fallback;
  const body = err.message.replace(/^\d+:\s*/, "");
  try {
    const p = JSON.parse(body) as { message?: unknown };
    const m = p.message;
    // `class-validator` manda un array de errores; NestJS a secas manda un string.
    if (Array.isArray(m)) return (m as string[]).join(", ");
    if (typeof m === "string" && m.trim()) return m;
  } catch {
    // Body no-JSON (502 de un proxy, HTML de error): cae al fallback en vez de
    // volcar el crudo en pantalla.
  }
  return fallback;
}

/** `true` si el error de `request<T>` trae ese status HTTP. */
export function isStatus(err: unknown, status: number): boolean {
  return err instanceof Error && err.message.startsWith(`${status}:`);
}
