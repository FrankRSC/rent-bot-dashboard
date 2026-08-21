import type { Page, Route } from "@playwright/test";
import type {
  CancelFacturaResponse,
  Factura,
  Landlord,
  LandlordReport,
  PaymentAttempt,
  Property,
  Tenant,
} from "../../src/lib/types";

/**
 * Mock del backend `rent-collector bot` para las pruebas E2E.
 *
 * Intercepta las peticiones del navegador ANTES de que salgan, en las dos
 * formas que contempla `docs/CONTRATOS_API.md`:
 *   - `/api/**` (mismo origen, resuelto por el rewrite de next.config.ts)
 *   - `http://localhost:3001/**` (llamada directa al backend)
 *
 * Las rutas usan `[^/]+` para los IDs (UUID string, no numérico — ver
 * rent-collector-sync.md 2026-08-05T00:10, "ruptura de contrato: IDs a UUID").
 */

// ── Datos de prueba ───────────────────────────────────────────────────────────

const now = new Date();
export const CURRENT_YM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

// Credenciales de prueba para el flujo de auth (§2.9). La sesión vive en una
// cookie httpOnly (gestionada por el BFF); en e2e la simulamos con estado en el
// mock: `/me` responde 200 si hay sesión, 401 si no.
export const VALID_PASSWORD = "test-password";

/** ISO de un día del mes en curso (para que el dashboard lo cuente como "este mes"). */
const dayOfMonth = (d: number) =>
  new Date(now.getFullYear(), now.getMonth(), d, 12, 0, 0).toISOString();

export interface MockData {
  landlord: Landlord;
  properties: Property[];
  tenants: Tenant[];
  payments: PaymentAttempt[];
  facturas: Factura[];
}

export function buildMockData(): MockData {
  const landlord: Landlord = {
    id: "landlord-2",
    name: "Francisco Jiménez",
    email: "francisco@ejemplo.com",
    phone: "5215500000000",
    isActive: true,
    createdAt: "2025-01-15T12:00:00.000Z",
    ownerBank: "BBVA",
    beneficiaryAccount: "012345678901234567",
    beneficiaryAccountType: "CLABE",
    rfc: "JIMF850101ABC",
    taxRegime: "606",
    zipCode: "06600",
    fiscalName: "Francisco Jiménez",
    facturasEnabled: true,
    autoRemindersEnabled: true,
    defaultReminderDays: 3,
    notifyOnPayment: true,
    notifyOnOverdue: true,
  };

  const properties: Property[] = [
    { id: "property-1", name: "Departamento 201", landlordId: landlord.id },
    { id: "property-2", name: "Casa Roma Norte", landlordId: landlord.id },
  ];

  const tenants: Tenant[] = [
    {
      id: "tenant-1",
      name: "María López García",
      phone: "5215512345678",
      propertyId: "property-1",
      paymentDay: 5,
      monthlyAmount: 8500,
      paymentStatus: "Pagado",
      lastPaymentDate: dayOfMonth(2),
      lastReminderAt: null,
    },
    {
      id: "tenant-2",
      name: "Carlos Ramírez Soto",
      phone: "5215587654321",
      propertyId: "property-1",
      paymentDay: 10,
      monthlyAmount: 9500,
      paymentStatus: "Vigente",
      lastPaymentDate: null,
      lastReminderAt: null,
    },
    {
      id: "tenant-3",
      name: "Ana Torres Vega",
      phone: "5215511122233",
      propertyId: "property-2",
      paymentDay: 1,
      monthlyAmount: 12000,
      // Equivale al antiguo "Vencido": sin pago y con el plazo (día 1 + gracia)
      // ya cumplido, pero el mes todavía corriendo.
      paymentStatus: "Atrasado",
      lastPaymentDate: null,
      lastReminderAt: null,
    },
  ];

  const payments: PaymentAttempt[] = [
    {
      id: "payment-101",
      tenantPhone: tenants[0].phone,
      tenantId: "tenant-1",
      status: "VERIFIED",
      source: "WHATSAPP",
      verifiedOnFirstTry: true,
      ocrData: { monto: 8500, bancoEmisor: "BBVA" },
      createdAt: dayOfMonth(2),
      completedAt: dayOfMonth(2),
      events: [],
      tenant: tenants[0],
    },
    {
      id: "payment-102",
      tenantPhone: tenants[1].phone,
      tenantId: "tenant-2",
      status: "PENDING",
      source: "WHATSAPP",
      verifiedOnFirstTry: false,
      createdAt: dayOfMonth(3),
      events: [],
      tenant: tenants[1],
    },
    {
      id: "payment-103",
      tenantPhone: tenants[2].phone,
      tenantId: "tenant-3",
      status: "REJECTED",
      source: "WHATSAPP",
      verifiedOnFirstTry: false,
      ocrData: { monto: 12000 },
      createdAt: dayOfMonth(1),
      events: [],
      tenant: tenants[2],
    },
  ];

  const facturas: Factura[] = [
    {
      id: "fac-001",
      landlordId: landlord.id,
      tenantId: "tenant-1",
      paymentAttemptId: "payment-101",
      uuidCfdi: "A1B2C3D4-0000-0000-0000-000000000001",
      serie: "A",
      folio: "1",
      subtotal: 8500,
      iva: 1360,
      total: 9860,
      concepto: "Arrendamiento de inmueble",
      billingPeriod: CURRENT_YM,
      status: "STAMPED",
      xmlUrl: null,
      pdfUrl: null,
      errorMessage: null,
      stampedAt: dayOfMonth(2),
      createdAt: dayOfMonth(2),
      tenant: tenants[0],
    },
    {
      id: "fac-002",
      landlordId: landlord.id,
      tenantId: "tenant-2",
      paymentAttemptId: null,
      uuidCfdi: null,
      serie: null,
      folio: null,
      subtotal: 9500,
      iva: 1520,
      total: 11020,
      concepto: "Arrendamiento de inmueble",
      billingPeriod: CURRENT_YM,
      status: "DRAFT",
      xmlUrl: null,
      pdfUrl: null,
      errorMessage: null,
      stampedAt: null,
      createdAt: dayOfMonth(3),
      tenant: tenants[1],
    },
  ];

  return { landlord, properties, tenants, payments, facturas };
}

// ── Reporte derivado de los datos ─────────────────────────────────────────────

function buildReport(data: MockData): LandlordReport {
  const paid = data.tenants.filter((t) => t.paymentStatus === "Pagado");
  const vigente = data.tenants.filter((t) => t.paymentStatus === "Vigente");
  const atrasado = data.tenants.filter((t) => t.paymentStatus === "Atrasado");
  const vencido = data.tenants.filter((t) => t.paymentStatus === "Vencido");
  const totalCobrado = paid.reduce((s, t) => s + Number(t.monthlyAmount ?? 0), 0);

  return {
    month: CURRENT_YM,
    summary: {
      totalCobrado,
      totalPendiente: [...vigente, ...atrasado, ...vencido].reduce(
        (s, t) => s + Number(t.monthlyAmount ?? 0),
        0
      ),
      cobradoCount: paid.length,
      vigenteCount: vigente.length,
      pendienteCount: vigente.length, // alias deprecado, igual que el backend
      atrasadoCount: atrasado.length,
      vencidoCount: vencido.length,
      totalTenants: data.tenants.length,
      verifiedOnFirstTryCount: data.payments.filter((p) => p.verifiedOnFirstTry).length,
    },
    byProperty: data.properties.map((p) => {
      const propTenants = data.tenants.filter((t) => t.propertyId === p.id);
      const propPaid = propTenants.filter((t) => t.paymentStatus === "Pagado");
      return {
        propertyId: p.id,
        propertyName: p.name,
        totalCobrado: propPaid.reduce((s, t) => s + Number(t.monthlyAmount ?? 0), 0),
        cobradoCount: propPaid.length,
        vigenteCount: propTenants.filter((t) => t.paymentStatus === "Vigente").length,
        pendienteCount: propTenants.filter((t) => t.paymentStatus === "Vigente").length,
        atrasadoCount: propTenants.filter((t) => t.paymentStatus === "Atrasado").length,
        vencidoCount: propTenants.filter((t) => t.paymentStatus === "Vencido").length,
        totalTenants: propTenants.length,
        paidPercent: propTenants.length
          ? Math.round((propPaid.length / propTenants.length) * 100)
          : 0,
      };
    }),
    byTenant: data.tenants.map((t) => ({
      tenantId: t.id,
      tenantName: t.name,
      phone: t.phone,
      propertyId: t.propertyId,
      propertyName:
        data.properties.find((p) => p.id === t.propertyId)?.name ?? "—",
      paymentDay: t.paymentDay ?? null,
      monthlyAmount: t.monthlyAmount ?? null,
      paymentStatus: t.paymentStatus ?? "Vigente",
      lastVerifiedAt: t.lastPaymentDate ?? null,
      amountPaid: t.paymentStatus === "Pagado" ? Number(t.monthlyAmount ?? 0) : null,
      attemptsCount: data.payments.filter((p) => p.tenantPhone === t.phone).length,
    })),
    monthlyTrend: [
      { month: CURRENT_YM, totalCobrado, cobradoCount: paid.length },
    ],
  };
}

// ── Interceptor ───────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

/**
 * Registra el mock del backend en la página. Debe llamarse ANTES de `page.goto`.
 * Devuelve los datos usados, mutables por test (p. ej. vaciar `tenants` para
 * probar estados vacíos) siempre que se muten antes de navegar.
 */
export async function mockBackend(
  page: Page,
  data: MockData = buildMockData(),
  options: { authenticated?: boolean } = {}
): Promise<MockData> {
  // Estado de sesión simulado: parte de `authenticated` (default true) y muta con
  // login/logout. `GET /me` responde según este flag.
  let authed = options.authenticated ?? true;
  let nextPropertySeq = data.properties.length + 1;
  let nextTenantSeq = data.tenants.length + 1;
  let nextFacturaSeq = data.facturas.length + 1;
  let nextLandlordSeq = 1000; // fuera del rango de los landlords fijos de arriba
  const registeredEmails = new Set<string>([data.landlord.email]);

  const handler = async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "");

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: CORS_HEADERS,
        body: JSON.stringify(body ?? null),
      });
    const empty = () => route.fulfill({ status: 204, headers: CORS_HEADERS });

    // Las navegaciones de página las sirve Next.js, no el mock.
    if (request.resourceType() === "document") return route.continue();

    if (method === "OPTIONS") return empty();

    let m: RegExpMatchArray | null;

    // ── Health ──
    if (method === "GET" && path === "/health") return json({ status: "ok" });

    // ── Auth (§2.9, vía BFF) — sesión simulada con estado `authed` + cookie ──
    // El BFF real fija/limpia la cookie httpOnly `rc_token`; aquí la replicamos con
    // Set-Cookie para que el middleware del servidor deje pasar (o redirija).
    if (method === "POST" && path === "/auth/login") {
      const body = request.postDataJSON() as { email: string; password: string };
      if (body.email === data.landlord.email && body.password === VALID_PASSWORD) {
        authed = true;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { ...CORS_HEADERS, "set-cookie": "rc_token=e2e; Path=/; SameSite=Lax" },
          body: JSON.stringify({ landlord: data.landlord }),
        });
      }
      return json({ statusCode: 401, message: "Unauthorized" }, 401);
    }
    if (method === "POST" && path === "/auth/logout") {
      authed = false;
      return route.fulfill({
        status: 204,
        headers: { ...CORS_HEADERS, "set-cookie": "rc_token=; Path=/; Max-Age=0" },
      });
    }
    if (method === "GET" && path === "/me") {
      return authed ? json(data.landlord) : json({ statusCode: 401, message: "Unauthorized" }, 401);
    }

    // ── Forgot / Reset password (públicos) ──
    if (method === "POST" && path === "/auth/forgot-password") {
      return empty(); // 204 siempre — no revela si el correo existe
    }
    if (method === "POST" && path === "/auth/reset-password") {
      const body = request.postDataJSON() as { token: string; password: string };
      if (body.token === "valid-token") return empty();
      return json({ message: "Token inválido o expirado" }, 400);
    }

    // ── Register (autoregistro público) ──
    if (method === "POST" && path === "/landlords") {
      const body = request.postDataJSON() as { name: string; email: string; phone: string; password: string };
      if (registeredEmails.has(body.email)) {
        return json({ statusCode: 409, message: "Email already exists" }, 409);
      }
      const newLandlord: Landlord = {
        id: `landlord-${nextLandlordSeq++}`,
        name: body.name,
        email: body.email,
        phone: body.phone,
        isActive: true,
        createdAt: new Date().toISOString(),
        facturasEnabled: false,
        autoRemindersEnabled: true,
        defaultReminderDays: 3,
        notifyOnPayment: true,
        notifyOnOverdue: true,
      };
      registeredEmails.add(body.email);
      return json(newLandlord, 201);
    }

    // ── Landlord ──
    if (method === "GET" && /^\/landlords\/[^/]+$/.test(path)) return json(data.landlord);
    if (method === "PATCH" && /^\/landlords\/[^/]+$/.test(path)) {
      Object.assign(data.landlord, request.postDataJSON());
      return json(data.landlord);
    }
    if (method === "PATCH" && /^\/landlords\/[^/]+\/fiscal$/.test(path)) {
      Object.assign(data.landlord, request.postDataJSON());
      return json(data.landlord);
    }
    if (method === "GET" && /^\/landlords\/[^/]+\/report$/.test(path)) {
      return json(buildReport(data));
    }

    // ── Properties ──
    if (method === "GET" && /^\/landlords\/[^/]+\/properties$/.test(path)) {
      return json(data.properties);
    }
    if (method === "POST" && /^\/landlords\/[^/]+\/properties$/.test(path)) {
      const body = request.postDataJSON() as { name: string };
      const property: Property = {
        id: `property-${nextPropertySeq++}`,
        name: body.name,
        landlordId: data.landlord.id,
      };
      data.properties.push(property);
      return json(property, 201);
    }
    if (method === "PATCH" && (m = path.match(/^\/properties\/([^/]+)$/))) {
      const property = data.properties.find((p) => p.id === m![1]);
      if (!property) return json({ message: "Not found" }, 404);
      Object.assign(property, request.postDataJSON());
      return json(property);
    }
    if (method === "DELETE" && (m = path.match(/^\/properties\/([^/]+)$/))) {
      data.properties = data.properties.filter((p) => p.id !== m![1]);
      return empty();
    }

    // ── Tenants ──
    if (method === "GET" && /^\/landlords\/[^/]+\/tenants$/.test(path)) {
      return json(data.tenants);
    }
    if (method === "GET" && (m = path.match(/^\/properties\/([^/]+)\/tenants$/))) {
      return json(data.tenants.filter((t) => t.propertyId === m![1]));
    }
    if (method === "POST" && (m = path.match(/^\/properties\/([^/]+)\/tenants$/))) {
      const body = request.postDataJSON() as Partial<Tenant> & { name: string; phone: string };
      const tenant: Tenant = {
        id: `tenant-${nextTenantSeq++}`,
        propertyId: m![1],
        paymentStatus: "Vigente",
        lastPaymentDate: null,
        lastReminderAt: null,
        ...body,
      };
      data.tenants.push(tenant);
      return json(tenant, 201);
    }
    if (method === "PATCH" && (m = path.match(/^\/properties\/tenants\/([^/]+)$/))) {
      const tenant = data.tenants.find((t) => t.id === m![1]);
      if (!tenant) return json({ message: "Not found" }, 404);
      Object.assign(tenant, request.postDataJSON());
      return json(tenant);
    }
    if (method === "DELETE" && (m = path.match(/^\/properties\/tenants\/([^/]+)$/))) {
      data.tenants = data.tenants.filter((t) => t.id !== m![1]);
      return empty();
    }
    if (method === "PATCH" && (m = path.match(/^\/tenants\/([^/]+)\/fiscal$/))) {
      const tenant = data.tenants.find((t) => t.id === m![1]);
      if (!tenant) return json({ message: "Not found" }, 404);
      Object.assign(tenant, request.postDataJSON());
      return json(tenant);
    }
    if (method === "POST" && (m = path.match(/^\/tenants\/([^/]+)\/reminder$/))) {
      const tenant = data.tenants.find((t) => t.id === m![1]);
      if (!tenant) return json({ message: "Not found" }, 404);
      tenant.lastReminderAt = new Date().toISOString();
      return json({ sentAt: tenant.lastReminderAt });
    }

    // ── Balance del periodo ──
    if (method === "GET" && (m = path.match(/^\/payments\/manual\/balance\/([^/]+)$/))) {
      const tenantId = m![1];
      const period = url.searchParams.get("period") ?? CURRENT_YM;
      const tenant = data.tenants.find((t) => t.id === tenantId);
      const attempts = data.payments.filter(
        (p) => p.tenantId === tenantId && (p.billingPeriod ?? p.createdAt.slice(0, 7)) === period
      );
      const paid = attempts
        .filter((p) => ["VERIFIED","INTRABANK_OK","MANUAL_VERIFIED","PARTIAL"].includes(p.status))
        .reduce((s, p) => s + Number(p.ocrData?.monto ?? p.amount ?? 0), 0);
      const expected = tenant?.monthlyAmount ?? null;
      const remaining = expected != null ? Math.max(0, expected - paid) : null;
      const status =
        expected == null ? "SIN_RENTA_CONFIGURADA"
        : paid >= expected ? "PAGADO"
        : paid > 0 ? "PARCIAL"
        : "PENDIENTE";
      return json({ tenantId, tenantName: tenant?.name ?? "—", period, expected, paid, remaining, status, attempts });
    }

    // ── Payments ──
    if (method === "GET" && path === "/payments") return json(data.payments);
    if (method === "GET" && (m = path.match(/^\/payments\/([^/]+)$/))) {
      const payment = data.payments.find((p) => p.id === m![1]);
      return payment ? json(payment) : json({ message: "Not found" }, 404);
    }

    // ── Facturas ──
    if (method === "GET" && /^\/landlords\/[^/]+\/facturas$/.test(path)) {
      const period = url.searchParams.get("period");
      return json(
        period ? data.facturas.filter((f) => f.billingPeriod === period) : data.facturas
      );
    }
    if (method === "POST" && path === "/facturas") {
      const body = request.postDataJSON() as {
        tenantId: string;
        billingPeriod?: string;
        amount?: number;
        concepto?: string;
      };
      const tenant = data.tenants.find((t) => t.id === body.tenantId);
      const subtotal = body.amount ?? Number(tenant?.monthlyAmount ?? 0);
      const iva = Math.round(subtotal * 0.16 * 100) / 100;
      const factura: Factura = {
        id: `fac-${String(nextFacturaSeq).padStart(3, "0")}`,
        landlordId: data.landlord.id,
        tenantId: body.tenantId,
        paymentAttemptId: null,
        uuidCfdi: `A1B2C3D4-0000-0000-0000-${String(nextFacturaSeq).padStart(12, "0")}`,
        serie: "A",
        folio: String(nextFacturaSeq),
        subtotal,
        iva,
        total: subtotal + iva,
        concepto: body.concepto ?? "Arrendamiento de inmueble",
        billingPeriod: body.billingPeriod ?? CURRENT_YM,
        status: "STAMPED",
        xmlUrl: null,
        pdfUrl: null,
        errorMessage: null,
        stampedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        tenant,
      };
      nextFacturaSeq++;
      data.facturas.unshift(factura);
      return json(factura, 201);
    }
    if (method === "POST" && (m = path.match(/^\/facturas\/([^/]+)\/cancel$/))) {
      const factura = data.facturas.find((f) => f.id === m![1]);
      if (!factura) return json({ message: "Not found" }, 404);
      const body = request.postDataJSON() as { motivo: "01" | "02" | "03" | "04"; uuidSustitucion?: string };
      factura.status = "CANCELLED";
      // Contrato §2.5: la respuesta es la CancelacionFactura, no la Factura.
      const cancelacion: CancelFacturaResponse = {
        id: `cancel-${factura.id}`,
        facturaId: factura.id,
        motivo: body.motivo,
        uuidSustitucion: body.uuidSustitucion ?? null,
        status: "ACCEPTED",
        providerResponse: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
      };
      return json(cancelacion);
    }

    // Endpoint sin mock: falla ruidosamente para detectar drift de contrato.
    return json({ message: `Sin mock para ${method} ${path}` }, 501);
  };

  await page.route("**/api/**", handler);
  await page.route("http://localhost:3001/**", handler);

  // Sesión inicial: sembramos la cookie que el middleware del servidor exige. Sin
  // ella (authenticated:false), el middleware redirige a /login (lo que prueba el
  // flujo de "sin sesión").
  if (authed) {
    await page.context().addCookies([
      { name: "rc_token", value: "e2e", domain: "localhost", path: "/" },
    ]);
  }
  return data;
}

/**
 * Simula backend caído: toda petición a la API falla a nivel de red. Como `GET /me`
 * también falla (error de red, no 401), el store entra en modo optimista y deja ver
 * el dashboard con su banner de error; un backend caído NO expulsa a login.
 */
export async function mockBackendDown(page: Page): Promise<void> {
  const abort = (route: Route) => route.abort("connectionrefused");
  await page.route("**/api/**", abort);
  await page.route("http://localhost:3001/**", abort);
  // Sesión ya iniciada (cookie presente) para pasar el middleware; como el backend
  // está caído, /me se aborta y el store entra optimista → se ve el banner de error.
  await page.context().addCookies([
    { name: "rc_token", value: "e2e", domain: "localhost", path: "/" },
  ]);
}
