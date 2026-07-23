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
  landlordId: number;
  authenticated: boolean;
  authReady: boolean;
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

  hydrateAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  fetchProperties: () => Promise<void>;
  fetchAllTenants: () => Promise<void>;
  fetchTenantsForProperty: (propertyId: number) => Promise<void>;
  fetchPayments: () => Promise<void>;
  fetchLandlordSettings: () => Promise<void>;
  checkHealth: () => Promise<void>;

  createProperty: (
    data: Parameters<typeof api.createProperty>[1]
  ) => Promise<Property>;
  updateProperty: (
    id: number,
    data: Parameters<typeof api.updateProperty>[1]
  ) => Promise<void>;
  removeProperty: (id: number) => Promise<void>;

  createTenant: (
    propertyId: number,
    data: Parameters<typeof api.createTenant>[1]
  ) => Promise<Tenant>;
  updateTenant: (
    id: number,
    data: Parameters<typeof api.updateTenant>[1]
  ) => Promise<void>;
  removeTenant: (id: number) => Promise<void>;

  sendReminder: (tenantId: number) => Promise<void>;
  updateSettings: (updates: Partial<GlobalSettings>) => void;

  fetchFacturas: () => Promise<void>;
  issueFactura: (data: Parameters<typeof api.issueFactura>[0]) => Promise<Factura>;
  cancelFactura: (id: string, data: Parameters<typeof api.cancelFactura>[1]) => Promise<void>;

  _recomputeTenantsWithStatus: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  landlordId: 0,
  authenticated: false,
  authReady: false,
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

  settings: {
    landlordName: "",
    email: "",
    phone: "",
    ownerBank: "",
    beneficiaryAccount: "",
    beneficiaryAccountType: "CLABE",
    autoRemindersEnabled: true,
    defaultReminderDays: 3,
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
      set({ authenticated: true, landlordId: me.id, authReady: true });
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (msg.startsWith("401")) {
        // Sin cookie válida: no hay sesión → a login.
        set({ authenticated: false, landlordId: 0, authReady: true });
      } else {
        // Backend caído / error transitorio: no expulsamos por un 5xx/red;
        // dejamos entrar (optimista) para que el dashboard muestre el banner.
        set({ authenticated: true, authReady: true });
      }
    }
  },

  login: async (email, password) => {
    const { landlord } = await api.login(email, password);
    set({ authenticated: true, landlordId: landlord.id, authReady: true });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Aunque el logout del servidor falle, limpiamos el estado local igual.
    }
    set({ authenticated: false, landlordId: 0 });
    if (typeof window !== "undefined") window.location.href = "/login";
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
    const statusMap = new Map<number, { paymentStatus: PaymentStatus; lastPaymentDate: string | null }>();
    allTenants.forEach((t) => {
      if (t.paymentStatus) {
        statusMap.set(t.id, {
          paymentStatus: t.paymentStatus,
          lastPaymentDate: t.lastPaymentDate ?? null,
        });
      }
    });
    const withStatus: TenantWithStatus[] = tenants.map((tenant) => {
      const backend = statusMap.get(tenant.id);
      return {
        ...tenant,
        paymentStatus: backend?.paymentStatus ?? "Pendiente",
        lastPaymentDate: backend?.lastPaymentDate ?? null,
        reminderSent: reminderSentThisMonth(tenant.lastReminderAt),
      };
    });
    set({ tenantsWithStatus: withStatus });
  },
}));
