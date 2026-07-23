import type { NextConfig } from "next";

// La conexión con el backend (NestJS) pasa por el BFF en
// `src/app/api/[...path]/route.ts`, que lee `BACKEND_URL` y adjunta el token
// httpOnly. Ya NO se usa un rewrite: así el token nunca vive en el cliente.
// Ver docs/CONTRATOS_API.md §1 y DECISIONS.md.
const nextConfig: NextConfig = {};

export default nextConfig;
