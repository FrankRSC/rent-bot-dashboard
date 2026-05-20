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
  Zap,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Propiedades", href: "/propiedades", icon: Building2 },
  { label: "Pagos", href: "/pagos", icon: CreditCard },
  { label: "Reportes", href: "/reportes", icon: BarChart2 },
  { label: "Recordatorios", href: "/recordatorios", icon: Bell },
  { label: "Configuración", href: "/configuracion", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col w-60 min-h-screen bg-[#0B1426] text-slate-100 shrink-0",
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
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#2952F3]">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold text-[#7b9af7] uppercase tracking-wider">
            Save Time
          </span>
          <span className="text-[10px] text-slate-400">by Shiftly</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
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

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-[#2952F3] text-white text-xs font-bold">
              FJ
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-sm font-medium text-slate-200 truncate">
              Francisco Jiménez
            </span>
            <span className="text-xs text-slate-500 truncate">Arrendador</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
