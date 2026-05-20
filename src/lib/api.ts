import type {
  Landlord,
  LandlordReport,
  Property,
  Tenant,
  PaymentAttempt,
} from "@/lib/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// ── Landlord ─────────────────────────────────────────────────────────────────

export const getLandlord = (id: number) =>
  request<Landlord>(`/landlords/${id}`);

export const getLandlordReport = (id: number, month?: string) =>
  request<LandlordReport>(
    `/landlords/${id}/report${month ? `?month=${month}` : ""}`
  );

export const updateLandlord = (
  id: number,
  data: Partial<{ name: string; email: string; phone: string; ownerBank: string; beneficiaryAccount: string; beneficiaryAccountType: string }>
) =>
  request<Landlord>(`/landlords/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

// ── Properties ────────────────────────────────────────────────────────────────

export const getProperties = (landlordId: number) =>
  request<Property[]>(`/landlords/${landlordId}/properties`);

export const createProperty = (
  landlordId: number,
  data: { name: string }
) =>
  request<Property>(`/landlords/${landlordId}/properties`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateProperty = (
  id: number,
  data: Partial<{ name: string }>
) =>
  request<Property>(`/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteProperty = (id: number) =>
  request<void>(`/properties/${id}`, { method: "DELETE" });

// ── Tenants ───────────────────────────────────────────────────────────────────

export const getTenants = (propertyId: number) =>
  request<Tenant[]>(`/properties/${propertyId}/tenants`);

export const getAllTenants = (landlordId: number) =>
  request<Tenant[]>(`/landlords/${landlordId}/tenants`);

export const createTenant = (
  propertyId: number,
  data: {
    name: string;
    phone: string;
    destinationAccount?: string;
    destinationAccountType?: string;
    paymentDay?: number;
    monthlyAmount?: number;
  }
) =>
  request<Tenant>(`/properties/${propertyId}/tenants`, {
    method: "POST",
    body: JSON.stringify(data),
  });

export const updateTenant = (
  id: number,
  data: Partial<{
    name: string;
    phone: string;
    destinationAccount: string;
    destinationAccountType: string;
    paymentDay: number;
    monthlyAmount: number;
  }>
) =>
  request<Tenant>(`/properties/tenants/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });

export const deleteTenant = (id: number) =>
  request<void>(`/properties/tenants/${id}`, { method: "DELETE" });

// ── Payments ──────────────────────────────────────────────────────────────────

export const getPayments = (limit = 50) =>
  request<PaymentAttempt[]>(`/payments?limit=${limit}`);

export const getPaymentById = (id: number) =>
  request<PaymentAttempt>(`/payments/${id}`);
