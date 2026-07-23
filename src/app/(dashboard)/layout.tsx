"use client";

import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { DataBootstrap } from "@/components/layout/DataBootstrap";
import { ConnectionBanner } from "@/components/layout/ConnectionBanner";
import { AuthGate } from "@/components/layout/AuthGate";
import { useStore } from "@/store/useStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = useStore((s) => s.logout);

  return (
    <AuthGate>
    <div className="flex min-h-screen bg-[#F4F5F7]">
      <DataBootstrap />

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
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
    </AuthGate>
  );
}
