import { create } from "zustand";
import type {
  Property,
  Tenant,
  TenantWithStatus,
  PaymentAttempt,
  GlobalSettings,
  PaymentStatus,
  Factura,
  FacturaStatus,
  SubscriptionStatusView,
} from "@/lib/types";
import * as api from "@/lib/api";

// Auth (Fase 2 + 4a, cierra G1/G2): el landlordId se deriva de `GET /me` (no de
// env). El JWT vive en una cookie httpOnly que gestiona el BFF; el cliente solo
// sabe si HAY sesión (`authenticated`), nunca ve el token. La vía canónica para
// páginas sigue siendo `useStore((s) => s.landlordId)`.

// ── Helpers ───────────────────────────────────────────────────────────────────

// El estado de recordatorio ya es del servidor (tenant.lastReminderAt, gap G5
// cerrado): "enviado" significa enviado por WhatsApp dentro del mes en curso.
function reminderSentThisMonth(lastReminderAt: string | null | undefined): boolean {
  if (!lastReminderAt) return false;
  const sent = new Date(lastReminderAt);
  const now = new Date();
  return (
    sent.getFullYear() === now.getFullYear() && sent.getMonth() === now.getMonth()
  );
}

// ── State shape ───────────────────────────────────────────────────────────────

interface LoadState {
  loading: boolean;
  error: string | null;
}

type BotStatus = "checking" | "online" | "offline";

interface AppState {
  landlordId: string;
  authenticated: boolean;
  authReady: boolean;
  isAdmin: boolean;
  impersonatedBy: string | null; // email del admin cuando el token es de impersonación
  properties: Property[];
  tenants: Tenant[];
  allTenants: Tenant[];
  payments: PaymentAttempt[];
  tenantsWithStatus: TenantWithStatus[];
  facturas: Factura[];

  propertiesState: LoadState;
  tenantsState: LoadState;
  paymentsState: LoadState;
  facturasState: LoadState;

  botStatus: BotStatus;
  settings: GlobalSettings;
  // null = aún no cargada o no se pudo leer. `hasSubscription: false` es distinto:
  // significa "sin plan asignado", y ese caso NO se bloquea (§2.10).
  subscription: SubscriptionStatusView | null;

  hydrateAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  endImpersonation: () => Promise<void>;

  fetchProperties: () => Promise<void>;
  fetchAllTenants: () => Promise<void>;
  fetchTenantsForProperty: (propertyId: string) => Promise<void>;
  fetchPayments: () => Promise<void>;
  fetchLandlordSettings: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  checkHealth: () => Promise<void>;

  createProperty: (
    data: Parameters<typeof api.createProperty>[1]
  ) => Promise<Property>;
  updateProperty: (
    id: string,
    data: Parameters<typeof api.updateProperty>[1]
  ) => Promise<void>;
  removeProperty: (id: string) => Promise<void>;

  createTenant: (
    propertyId: string,
    data: Parameters<typeof api.createTenant>[1]
  ) => Promise<Tenant>;
  updateTenant: (
    id: string,
    data: Parameters<typeof api.updateTenant>[1]
  ) => Promise<void>;
  removeTenant: (id: string) => Promise<void>;

  sendReminder: (tenantId: string) => Promise<void>;
  updateSettings: (updates: Partial<GlobalSettings>) => void;

  fetchFacturas: () => Promise<void>;
  issueFactura: (data: Parameters<typeof api.issueFactura>[0]) => Promise<Factura>;
  cancelFactura: (id: string, data: Parameters<typeof api.cancelFactura>[1]) => Promise<void>;

  _recomputeTenantsWithStatus: () => void;

  tourActive: boolean;
  setTourActive: (active: boolean) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  landlordId: "",
  authenticated: false,
  authReady: false,
  isAdmin: false,
  impersonatedBy: null,
  properties: [],
  tenants: [],
  allTenants: [],
  payments: [],
  tenantsWithStatus: [],
  facturas: [],

  propertiesState: { loading: false, error: null },
  tenantsState: { loading: false, error: null },
  paymentsState: { loading: false, error: null },
  facturasState: { loading: false, error: null },

  botStatus: "checking",
  subscription: null,
  tourActive: false,
  setTourActive: (active) => set({ tourActive: active }),

  settings: {
    landlordName: "",
    email: "",
    phone: "",
    ownerBank: "",
    beneficiaryAccount: "",
    beneficiaryAccountType: "CLABE",
    autoRemindersEnabled: true,
    defaultReminderDays: 3,
    defaultGraceDays: 3, // mismo valor inicial que usa el backend
    notifyOnPayment: true,
    notifyOnOverdue: true,
    rfc: "",
    taxRegime: "",
    zipCode: "",
    fiscalName: "",
    facturasEnabled: false,
  },

  // ── Auth (§2.9, vía BFF) ───────────────────────────────────────────────────
  // La sesión vive en la cookie httpOnly; preguntamos "quién soy" con GET /me.
  hydrateAuth: async () => {
    try {
      const me = await api.getMe();
      set({
        authenticated: true,
        landlordId: me.id,
        isAdmin: me.isAdmin ?? false,
        impersonatedBy: me.impersonatedBy ?? null,
        authReady: true,
      });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.startsWith("401")) {
        // Sin cookie válida: no hay sesión → a login.
        set({ authenticated: false, landlordId: "", isAdmin: false, impersonatedBy: null, authReady: true });
      } else {
        // Backend caído / error transitorio: no expulsamos por un 5xx/red;
        // dejamos entrar (optimista) para que el dashboard muestre el banner.
        set({ authenticated: true, authReady: true });
      }
    }
  },

  login: async (email, password) => {
    await api.login(email, password);
    // GET /me tras el login para obtener landlordId e isAdmin en un solo paso.
    const me = await api.getMe();
    set({
      authenticated: true,
      landlordId: me.id,
      isAdmin: me.isAdmin ?? false,
      impersonatedBy: me.impersonatedBy ?? null,
      authReady: true,
    });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Aunque el logout del servidor falle, limpiamos el estado local igual.
    }
    set({ authenticated: false, landlordId: "", isAdmin: false, impersonatedBy: null });
    if (typeof window !== "undefined") window.location.href = "/login";
  },

  endImpersonation: async () => {
    await api.endImpersonation();
    await get().hydrateAuth();
    if (typeof window !== "undefined") window.location.href = "/admin/arrendadores";
  },

  fetchProperties: async () => {
    set({ propertiesState: { loading: true, error: null } });
    try {
      const props = await api.getProperties(get().landlordId);
      set({ properties: props, propertiesState: { loading: false, error: null } });
    } catch (e) {
      set({ propertiesState: { loading: false, error: (e as Error).message } });
    }
  },

  // Fuente principal de inquilinos: una sola llamada trae todos con su estado
  // de pago (docs/MEJORAS.md D6).
  fetchAllTenants: async () => {
    set({ tenantsState: { loading: true, error: null } });
    try {
      const tenants = await api.getAllTenants(get().landlordId);
      set({
        allTenants: tenants,
        tenants,
        tenantsState: { loading: false, error: null },
      });
      get()._recomputeTenantsWithStatus();
    } catch (e) {
      set({ tenantsState: { loading: false, error: (e as Error).message } });
    }
  },

  // Carga bajo demanda para el detalle de propiedad (propiedades/[id]).
  fetchTenantsForProperty: async (propertyId) => {
    set({ tenantsState: { loading: true, error: null } });
    try {
      const fresh = await api.getTenants(propertyId);
      set((state) => {
        const others = state.tenants.filter((t) => t.propertyId !== propertyId);
        return {
          tenants: [...others, ...fresh],
          tenantsState: { loading: false, error: null },
        };
      });
      get()._recomputeTenantsWithStatus();
    } catch (e) {
      set({ tenantsState: { loading: false, error: (e as Error).message } });
    }
  },

  fetchPayments: async () => {
    set({ paymentsState: { loading: true, error: null } });
    try {
      const payments = await api.getPayments(50);
      set({ payments, paymentsState: { loading: false, error: null } });
      get()._recomputeTenantsWithStatus();
    } catch (e) {
      set({ paymentsState: { loading: false, error: (e as Error).message } });
    }
  },

  // Carga el perfil/preferencias del landlord en `settings` al arrancar, para
  // que recordatorios, facturas y el sidebar vean valores reales sin pasar por
  // Configuración. Si falla, el banner de conexión ya avisa (los demás fetch
  // al mismo backend fallarán también).
  fetchLandlordSettings: async () => {
    try {
      const l = await api.getLandlord(get().landlordId);
      set((state) => ({
        settings: {
          ...state.settings,
          landlordName: l.name,
          email: l.email,
          phone: l.phone ?? "",
          ownerBank: l.ownerBank ?? "",
          beneficiaryAccount: l.beneficiaryAccount ?? "",
          beneficiaryAccountType: l.beneficiaryAccountType ?? "CLABE",
          rfc: l.rfc ?? "",
          taxRegime: l.taxRegime ?? "",
          zipCode: l.zipCode ?? "",
          fiscalName: l.fiscalName ?? "",
          facturasEnabled: l.facturasEnabled ?? false,
          autoRemindersEnabled: l.autoRemindersEnabled,
          defaultReminderDays: l.defaultReminderDays,
          notifyOnPayment: l.notifyOnPayment,
          notifyOnOverdue: l.notifyOnOverdue,
        },
      }));
    } catch {
      // No bloquea el arranque: la página de Configuración muestra su propio
      // error de carga y el ConnectionBanner cubre la caída del backend.
    }
  },

  // Estado del plan del arrendador (§2.10). Solo lectura: el pago es en efectivo
  // fuera de la plataforma. Si falla se deja en null y el banner no se pinta —
  // nunca se bloquea la app por no poder leer la suscripción.
  fetchSubscription: async () => {
    try {
      const sub = await api.getSubscriptionStatus(get().landlordId);
      set({ subscription: sub });
    } catch {
      set({ subscription: null });
    }
  },

  // Health real del backend (docs/MEJORAS.md D3). checkBackendHealth nunca lanza.
  checkHealth: async () => {
    const healthy = await api.checkBackendHealth(get().landlordId);
    set({ botStatus: healthy ? "online" : "offline" });
  },

  createProperty: async (data) => {
    const prop = await api.createProperty(get().landlordId, data);
    set((state) => ({ properties: [...state.properties, prop] }));
    return prop;
  },

  updateProperty: async (id, data) => {
    const updated = await api.updateProperty(id, data);
    set((state) => ({
      properties: state.properties.map((p) => (p.id === id ? updated : p)),
    }));
  },

  removeProperty: async (id) => {
    await api.deleteProperty(id);
    set((state) => ({
      properties: state.properties.filter((p) => p.id !== id),
      tenants: state.tenants.filter((t) => t.propertyId !== id),
    }));
    get()._recomputeTenantsWithStatus();
  },

  createTenant: async (propertyId, data) => {
    const tenant = await api.createTenant(propertyId, data);
    set((state) => ({ tenants: [...state.tenants, tenant] }));
    get()._recomputeTenantsWithStatus();
    return tenant;
  },

  updateTenant: async (id, data) => {
    const updated = await api.updateTenant(id, data);
    set((state) => ({
      tenants: state.tenants.map((t) => (t.id === id ? updated : t)),
    }));
    get()._recomputeTenantsWithStatus();
  },

  removeTenant: async (id) => {
    await api.deleteTenant(id);
    set((state) => ({ tenants: state.tenants.filter((t) => t.id !== id) }));
    get()._recomputeTenantsWithStatus();
  },

  // Recordatorio real por WhatsApp (POST /tenants/:id/reminder). Lanza si el
  // envío falla, para que la página muestre el error junto al botón.
  sendReminder: async (tenantId) => {
    const { sentAt } = await api.sendTenantReminder(tenantId);
    const patch = (list: Tenant[]) =>
      list.map((t) => (t.id === tenantId ? { ...t, lastReminderAt: sentAt } : t));
    set((state) => ({
      tenants: patch(state.tenants),
      allTenants: patch(state.allTenants),
    }));
    get()._recomputeTenantsWithStatus();
  },

  updateSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),

  fetchFacturas: async () => {
    set({ facturasState: { loading: true, error: null } });
    try {
      const facturas = await api.getLandlordFacturas(get().landlordId);
      set({ facturas, facturasState: { loading: false, error: null } });
    } catch (e) {
      set({ facturasState: { loading: false, error: (e as Error).message } });
    }
  },

  issueFactura: async (data) => {
    const f = await api.issueFactura(data);
    set((state) => ({ facturas: [f, ...state.facturas] }));
    return f;
  },

  // La respuesta es el registro de cancelación (§2.5): solo ACCEPTED implica
  // que la factura quedó CANCELLED; con PENDING sigue STAMPED hasta que el SAT
  // resuelva, y REJECTED/ERROR se propagan para que el diálogo los muestre.
  cancelFactura: async (id, data) => {
    const res = await api.cancelFactura(id, data);
    if (res.status === "REJECTED" || res.status === "ERROR") {
      throw new Error(res.errorMessage ?? "El SAT rechazó la cancelación.");
    }
    if (res.status === "ACCEPTED") {
      set((state) => ({
        facturas: state.facturas.map((f) =>
          f.id === id ? { ...f, status: "CANCELLED" as FacturaStatus } : f
        ),
      }));
    }
  },

  _recomputeTenantsWithStatus: () => {
    const { tenants, allTenants } = get();
    type AllTenantsStatus = {
      paymentStatus: PaymentStatus;
      lastPaymentDate: string | null;
      periodAdjustment: Tenant["periodAdjustment"];
    };
    const statusMap = new Map<string, AllTenantsStatus>();
    allTenants.forEach((t) => {
      statusMap.set(t.id, {
        // `Vigente` es el fallback correcto: es lo que manda el backend cuando no
        // hay cómo juzgar el plazo (sin `paymentDay`). Nunca asumir moroso.
        paymentStatus: t.paymentStatus ?? "Vigente",
        lastPaymentDate: t.lastPaymentDate ?? null,
        periodAdjustment: t.periodAdjustment ?? null,
      });
    });
    const withStatus: TenantWithStatus[] = tenants.map((tenant) => {
      const backend = statusMap.get(tenant.id);
      return {
        ...tenant,
        paymentStatus: backend?.paymentStatus ?? "Vigente",
        lastPaymentDate: backend?.lastPaymentDate ?? null,
        periodAdjustment: backend?.periodAdjustment ?? tenant.periodAdjustment ?? null,
        reminderSent: reminderSentThisMonth(tenant.lastReminderAt),
      };
    });
    set({ tenantsWithStatus: withStatus });
  },
}));
