"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart2,
  Bell,
  Settings,
  X,
  Receipt,
  FlaskConical,
  Database,
  Users,
  UserCog,
  Map,
  Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useStore } from "@/store/useStore";

const BASE_NAV = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Propiedades", href: "/propiedades", icon: Building2 },
  { label: "Pagos", href: "/pagos", icon: CreditCard },
  { label: "Facturas", href: "/facturas", icon: Receipt, feature: "facturasEnabled" as const },
  { label: "Reportes", href: "/reportes", icon: BarChart2 },
  { label: "Recordatorios", href: "/recordatorios", icon: Bell },
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

const ADMIN_NAV = [
  { label: "Resumen", href: "/admin", icon: LayoutDashboard },
  { label: "Métricas OCR", href: "/admin/metricas", icon: FlaskConical },
  { label: "Dataset", href: "/admin/dataset", icon: Database },
  { label: "Arrendadores", href: "/admin/arrendadores", icon: UserCog },
  { label: "Inquilinos", href: "/admin/inquilinos", icon: Users },
  { label: "Planes", href: "/admin/planes", icon: Banknote },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { settings, isAdmin, setTourActive } = useStore();

  // Admin puro: solo nav de administración. Al impersonar, isAdmin=false
  // (el token cambia al del arrendador), así que vuelve a ver BASE_NAV.
  const navItems = isAdmin
    ? ADMIN_NAV
    : BASE_NAV.filter((item) => !item.feature || settings[item.feature]);

  return (
    <aside
      className={cn(
        "flex flex-col w-60 bg-[#0B1426] text-slate-100 shrink-0",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-300",
        "md:static md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Botón cerrar — solo en móvil */}
      <button
        className="md:hidden absolute top-4 right-3 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        onClick={onClose}
        aria-label="Cerrar menú"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <div className="bg-white rounded-lg px-2.5 py-1.5 inline-flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/save-time-logo.png" alt="Rentals" className="h-5 object-contain" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-[#7b9af7] uppercase tracking-wider">
            Rentals
          </span>
          <span className="text-[10px] text-slate-400">Dashboard</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto sidebar-scroll">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              data-tour={`nav-${item.href.replace("/", "")}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#2952F3] text-white"
                  : "text-slate-400 hover:bg-white/10 hover:text-slate-100"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Recorrido del sistema */}
      {!isAdmin && (
        <div className="px-3 pb-2 border-t border-white/10 pt-2">
          <button
            onClick={() => { onClose(); setTourActive(true); }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-slate-100 transition-colors"
          >
            <Map className="w-4 h-4 shrink-0" />
            Recorrido del sistema
          </button>
        </div>
      )}

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-[#2952F3] text-white text-xs font-bold">
              {initials(settings.landlordName || "?")}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-sm font-medium text-slate-200 truncate">
              {settings.landlordName || "—"}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {isAdmin ? "Super Admin" : "Arrendador"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
