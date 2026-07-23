import { NextRequest, NextResponse } from "next/server";

/**
 * Guard de sesión en el servidor (Fase 4c). Si no hay cookie httpOnly `rc_token`,
 * redirige a /login ANTES de renderizar — así el dashboard se puede renderizar en
 * servidor sin depender de un guard de cliente (elimina el spinner del AuthGate y
 * habilita el primer paint con datos SSR).
 *
 * Aquí solo exigimos que EXISTA la sesión; la validez del token la comprueba el
 * backend en cada request (un 401 hace que el cliente/BFF redirija a /login).
 */
const TOKEN_COOKIE = "rc_token";

export function middleware(req: NextRequest) {
  if (!req.cookies.has(TOKEN_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Protege todo salvo /login, el BFF (/api/*, con su propia auth) y los estáticos.
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
