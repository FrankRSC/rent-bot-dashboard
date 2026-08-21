"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, ShieldAlert } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DataBootstrap } from "@/components/layout/DataBootstrap";
import { ConnectionBanner } from "@/components/layout/ConnectionBanner";
import { SubscriptionBanner } from "@/components/layout/SubscriptionBanner";
import { AuthGate } from "@/components/layout/AuthGate";
import { OnboardingWizard, TourOverlay } from "@/components/layout/OnboardingWizard";
import { useStore } from "@/store/useStore";

// Rutas que pertenecen al contexto de arrendador (no de admin).
const LANDLORD_PREFIXES = [
  "/dashboard",
  "/propiedades",
  "/pagos",
  "/reportes",
  "/recordatorios",
  "/facturas",
  "/configuracion",
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, endImpersonation, impersonatedBy, settings, isAdmin, authReady, tourActive, setTourActive } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  // Admin puro (no impersonando) que llega a una ruta de arrendador por URL
  // directa → redirige a su pantalla de inicio.
  useEffect(() => {
    if (!authReady || !isAdmin) return;
    if (LANDLORD_PREFIXES.some((p) => pathname.startsWith(p))) {
      router.replace("/admin");
    }
  }, [authReady, isAdmin, pathname, router]);

  return (
    <AuthGate>
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">
      <DataBootstrap />
      <OnboardingWizard />
      {tourActive && <TourOverlay onDone={() => setTourActive(false)} />}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-white flex items-center px-4 sm:px-6 shrink-0 gap-3">
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <Breadcrumb />
          <button
            onClick={logout}
            className="ml-auto flex items-center gap-1.5 h-8 px-3 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 text-[12px] font-medium transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </header>
        <ConnectionBanner />
        <SubscriptionBanner />
        {impersonatedBy && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-start sm:items-center gap-2.5 text-[12px] sm:text-[13px]">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-amber-800 flex-1 min-w-0">
              Sesión de impersonación — estás viendo como{" "}
              <strong>{settings.landlordName || "este arrendador"}</strong>.
              Admin activo: <span className="font-mono">{impersonatedBy}</span>
            </span>
            <button
              onClick={endImpersonation}
              className="ml-auto text-amber-700 hover:text-amber-900 underline text-[12px] font-medium whitespace-nowrap shrink-0"
            >
              Volver a admin
            </button>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto dashboard-scroll">{children}</main>
      </div>
    </div>
    </AuthGate>
  );
}
