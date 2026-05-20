import { create } from "zustand";
import type {
  Property,
  Tenant,
  TenantWithStatus,
  PaymentAttempt,
  GlobalSettings,
  PaymentStatus,
} from "@/lib/types";
import * as api from "@/lib/api";

const LANDLORD_ID = parseInt(
  process.env.NEXT_PUBLIC_LANDLORD_ID ?? "1",
  10
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveStatus(
  tenant: Tenant,
  attempts: PaymentAttempt[]
): { paymentStatus: PaymentStatus; lastPaymentDate: string | null } {
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const tenantAttempts = attempts.filter((a) => a.tenantPhone === tenant.phone);

  const verifiedThisMonth = tenantAttempts.find(
    (a) =>
      (a.status === "VERIFIED" || a.status === "INTRABANK_OK") &&
      a.createdAt.slice(0, 7) === currentYM
  );
  if (verifiedThisMonth) {
    return { paymentStatus: "Pagado", lastPaymentDate: verifiedThisMonth.createdAt.slice(0, 10) };
  }

  const rejectedThisMonth = tenantAttempts.find(
    (a) =>
      (a.status === "REJECTED" || a.status === "INTRABANK_REJECTED" || a.status === "ERROR" || a.status === "ABANDONED") &&
      a.createdAt.slice(0, 7) === currentYM
  );
  if (rejectedThisMonth) {
    return { paymentStatus: "Revisión", lastPaymentDate: null };
  }

  const verifiedPrev = tenantAttempts.find(
    (a) => a.status === "VERIFIED" || a.status === "INTRABANK_OK"
  );
  if (verifiedPrev) {
    return { paymentStatus: "Vencido", lastPaymentDate: verifiedPrev.createdAt.slice(0, 10) };
  }

  return { paymentStatus: "Pendiente", lastPaymentDate: null };
}

function getReminderKey(tenantId: number): string {
  const now = new Date();
  return `reminderSent_${tenantId}_${now.getFullYear()}_${now.getMonth() + 1}`;
}

// ── State shape ───────────────────────────────────────────────────────────────

interface LoadState {
  loading: boolean;
  error: string | null;
}

interface AppState {
  landlordId: number;
  properties: Property[];
  tenants: Tenant[];
  allTenants: Tenant[];
  payments: PaymentAttempt[];
  tenantsWithStatus: TenantWithStatus[];

  propertiesState: LoadState;
  tenantsState: LoadState;
  paymentsState: LoadState;

  settings: GlobalSettings;

  fetchProperties: () => Promise<void>;
  fetchTenants: () => Promise<void>;
  fetchAllTenants: () => Promise<void>;
  fetchTenantsForProperty: (propertyId: number) => Promise<void>;
  fetchPayments: () => Promise<void>;

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

  toggleReminderSent: (tenantId: number) => void;
  updateSettings: (updates: Partial<GlobalSettings>) => void;

  _recomputeTenantsWithStatus: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  landlordId: LANDLORD_ID,
  properties: [],
  tenants: [],
  allTenants: [],
  payments: [],
  tenantsWithStatus: [],

  propertiesState: { loading: false, error: null },
  tenantsState: { loading: false, error: null },
  paymentsState: { loading: false, error: null },

  settings: {
    landlordName: "",
    email: "",
    phone: "",
    ownerBank: "",
    beneficiaryAccount: "",
    beneficiaryAccountType: "CLABE",
    botConnected: true,
    autoRemindersEnabled: true,
    defaultReminderDays: 3,
    notifyOnPayment: true,
    notifyOnOverdue: true,
  },

  fetchProperties: async () => {
    set({ propertiesState: { loading: true, error: null } });
    try {
      const props = await api.getProperties(LANDLORD_ID);
      set({ properties: props, propertiesState: { loading: false, error: null } });
    } catch (e) {
      set({ propertiesState: { loading: false, error: (e as Error).message } });
    }
  },

  fetchAllTenants: async () => {
    try {
      const tenants = await api.getAllTenants(LANDLORD_ID);
      set({ allTenants: tenants });
    } catch {
      // silenciado — no bloquear la UI si falla
    }
  },

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

  fetchTenants: async () => {
    const { properties } = get();
    if (!properties.length) return;
    set({ tenantsState: { loading: true, error: null } });
    try {
      const batches = await Promise.all(
        properties.map((p) => api.getTenants(p.id))
      );
      set({
        tenants: batches.flat(),
        tenantsState: { loading: false, error: null },
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

  createProperty: async (data) => {
    const prop = await api.createProperty(LANDLORD_ID, data);
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

  toggleReminderSent: (tenantId) => {
    if (typeof window === "undefined") return;
    const key = getReminderKey(tenantId);
    const current = localStorage.getItem(key) === "true";
    localStorage.setItem(key, String(!current));
    get()._recomputeTenantsWithStatus();
  },

  updateSettings: (updates) =>
    set((state) => ({ settings: { ...state.settings, ...updates } })),

  _recomputeTenantsWithStatus: () => {
    const { tenants, payments } = get();
    const withStatus: TenantWithStatus[] = tenants.map((tenant) => {
      const { paymentStatus, lastPaymentDate } = deriveStatus(tenant, payments);
      const reminderSent =
        typeof window !== "undefined"
          ? localStorage.getItem(getReminderKey(tenant.id)) === "true"
          : false;
      return { ...tenant, paymentStatus, lastPaymentDate, reminderSent };
    });
    set({ tenantsWithStatus: withStatus });
  },
}));
