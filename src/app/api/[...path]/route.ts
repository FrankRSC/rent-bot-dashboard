import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

/**
 * BFF (Fase 4a). El navegador llama a `/api/*` (mismo origen); este handler lee la
 * cookie **httpOnly** `rc_token` y reenvía la petición a `BACKEND_URL` añadiendo
 * `Authorization: Bearer <token>`. Reemplaza al rewrite de `next.config.ts`.
 *
 * El JWT vive solo en la cookie httpOnly: **nunca** llega al JS del cliente (cierra
 * el vector XSS que tenía `localStorage`). Ver DECISIONS.md.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";
const TOKEN_COOKIE = "rc_token";
// Cookie que guarda el token del admin mientras está impersonando.
const ADMIN_SESSION_COOKIE = "rc_admin_session";
// 24 h, alineado a la expiración del JWT (§2.9 CONTRATOS_API.md).
const COOKIE_MAX_AGE = 60 * 60 * 24;

function cookieOpts(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/**
 * Lee el `accessToken` de una respuesta de auth (`login`, `impersonate`), que son
 * los dos únicos casos en los que el BFF necesita interpretar el body en vez de
 * reenviarlo tal cual. Devuelve el dato, o `null` si la respuesta no es lo que
 * decimos esperar.
 *
 * El 2xx-que-no-es-JSON no es un caso teórico: con `BACKEND_URL` apuntando al
 * propio Next, `POST /auth/login` terminaba redirigido a la página `/login` y
 * `res.json()` reventaba sobre el `<!DOCTYPE html>`. La ruta devolvía un 500 con
 * stack trace en vez de decir que la configuración estaba mal.
 */
async function readAuthBody(
  res: Response
): Promise<{ accessToken: string; landlord: unknown } | null> {
  if (!res.headers.get("content-type")?.includes("application/json")) return null;
  try {
    const data = (await res.json()) as { accessToken?: unknown; landlord?: unknown };
    if (typeof data.accessToken !== "string" || !data.accessToken) return null;
    return { accessToken: data.accessToken, landlord: data.landlord };
  } catch {
    // Content-type miente o el JSON viene truncado.
    return null;
  }
}

/** El backend contestó, pero con algo que no podemos usar. */
function badGateway() {
  return NextResponse.json(
    { message: "Respuesta inesperada del backend. Revisa BACKEND_URL." },
    { status: 502 }
  );
}

async function forward(req: NextRequest, path: string): Promise<Response> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const url = `${BACKEND_URL}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch {
    // Backend caído o inalcanzable — devolvemos JSON legible en vez de 500 HTML.
    return NextResponse.json({ message: "Backend no disponible" }, { status: 503 });
  }

  const out = new NextResponse(res.body, { status: res.status });
  const ct = res.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  return out;
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path: segments } = await ctx.params;
  const path = segments.join("/");

  // ── Login: interceptamos para guardar el token en la cookie httpOnly y NO
  //    devolverlo al cliente (solo el `landlord`). ──
  if (req.method === "POST" && path === "auth/login") {
    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: await req.arrayBuffer(),
        // Como en `forward()`: una redirección del backend se reporta, no se sigue.
        redirect: "manual",
      });
    } catch {
      return NextResponse.json({ message: "Backend no disponible" }, { status: 503 });
    }
    if (!res.ok) {
      if (res.status >= 300 && res.status < 400) return badGateway();
      return new NextResponse(res.body, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
      });
    }
    const data = await readAuthBody(res);
    if (!data) return badGateway();
    const out = NextResponse.json({ landlord: data.landlord });
    out.cookies.set(TOKEN_COOKIE, data.accessToken, cookieOpts(COOKIE_MAX_AGE));
    return out;
  }

  // ── Logout: limpiamos ambas cookies (también la de admin_session si existía). ──
  if (req.method === "POST" && path === "auth/logout") {
    const out = new NextResponse(null, { status: 204 });
    out.cookies.delete(TOKEN_COOKIE);
    out.cookies.delete(ADMIN_SESSION_COOKIE);
    return out;
  }

  // ── Fin de impersonación: restaura la sesión original del admin sin llamar
  //    al backend (el JWT stateless sigue siendo válido). ──
  if (req.method === "POST" && path === "auth/impersonate/end") {
    const adminToken = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
    const out = new NextResponse(null, { status: 204 });
    if (adminToken) {
      out.cookies.set(TOKEN_COOKIE, adminToken, cookieOpts(COOKIE_MAX_AGE));
    }
    out.cookies.delete(ADMIN_SESSION_COOKIE);
    return out;
  }

  // ── Impersonate: guarda el token del admin en rc_admin_session, reemplaza
  //    rc_token con el de impersonación (2h). El accessToken nunca llega al JS. ──
  //
  //    El patrón NO valida el formato del id a propósito: cuando eran numéricos
  //    esto era `\d+`, y al migrar a UUID dejó de coincidir — la petición caía a
  //    `forward()`, que devuelve el body del backend tal cual y filtraba el
  //    accessToken al JS del cliente (justo lo que este BFF existe para evitar).
  //    `auth/impersonate/end` ya se atendió arriba, así que aquí basta con exigir
  //    que sea un único segmento. Quién puede impersonar lo decide el backend.
  if (req.method === "POST" && /^auth\/impersonate\/[^/]+$/.test(path)) {
    const adminToken = (await cookies()).get(TOKEN_COOKIE)?.value;
    const impHeaders: Record<string, string> = { "content-type": "application/json" };
    if (adminToken) impHeaders["authorization"] = `Bearer ${adminToken}`;
    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/${path}`, {
        method: "POST",
        headers: impHeaders,
        redirect: "manual",
      });
    } catch {
      return NextResponse.json({ message: "Backend no disponible" }, { status: 503 });
    }
    if (!res.ok) {
      if (res.status >= 300 && res.status < 400) return badGateway();
      return new NextResponse(res.body, {
        status: res.status,
        headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
      });
    }
    const data = await readAuthBody(res);
    // Sin token válido no se toca `rc_token`: la sesión del admin queda intacta.
    if (!data) return badGateway();
    const out = NextResponse.json({ landlord: data.landlord });
    // Preserva el token del admin para poder volver sin re-login.
    if (adminToken) out.cookies.set(ADMIN_SESSION_COOKIE, adminToken, cookieOpts(COOKIE_MAX_AGE));
    out.cookies.set(TOKEN_COOKIE, data.accessToken, cookieOpts(60 * 60 * 2));
    return out;
  }

  return forward(req, path);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
