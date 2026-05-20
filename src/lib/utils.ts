import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount) + " MXN";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatPhone(phone: string): string {
  // format: 52XXXXXXXXXX -> +52 (XXX) XXX-XXXX
  if (phone.length === 13 && phone.startsWith("521")) {
    const num = phone.slice(3);
    return `+52 1 (${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
  }
  if (phone.length === 13 && phone.startsWith("52")) {
    const num = phone.slice(2);
    return `+52 (${num.slice(0, 3)}) ${num.slice(3, 6)}-${num.slice(6)}`;
  }
  return phone;
}

export function formatAccount(account: string, type: string): string {
  if (type === "CLABE" && account.length === 18) {
    return account.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
  }
  if (type === "CARD" && account.length === 16) {
    return account.replace(/(\d{4})/g, "$1 ").trim();
  }
  return account;
}
