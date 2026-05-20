"use client";

import { useEffect } from "react";
import { format, addDays, setDate } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Send, BellOff, Loader2 } from "lucide-react";
import { ApiErrorState } from "@/components/layout/ApiErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStore } from "@/store/useStore";

function getNextReminder(paymentDay: number, daysBefore: number): string {
  const today = new Date();
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const paymentDate = setDate(currentMonth, paymentDay);
  const reminderDate = addDays(paymentDate, -daysBefore);

  if (reminderDate <= today) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextPaymentDate = setDate(nextMonth, paymentDay);
    const nextReminderDate = addDays(nextPaymentDate, -daysBefore);
    return format(nextReminderDate, "dd/MM/yyyy");
  }
  return format(reminderDate, "dd/MM/yyyy");
}

export default function RecordatoriosPage() {
  const { tenantsWithStatus, properties, settings, updateSettings, toggleReminderSent, fetchProperties, fetchTenants, fetchPayments, tenantsState, propertiesState } = useStore();

  useEffect(() => {
    if (!properties.length) {
      fetchProperties().then(() => fetchTenants());
      fetchPayments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const now = new Date();
  const currentMonthLabel = format(now, "MMMM yyyy", { locale: es });
  const currentMonthLabelCap = currentMonthLabel.charAt(0).toUpperCase() + currentMonthLabel.slice(1);

  const tenantRows = tenantsWithStatus.map((t) => {
    const property = properties.find((p) => p.id === t.propertyId);
    const paymentDay = t.paymentDay ?? 1;
    const daysBefore = settings.defaultReminderDays;
    return {
      ...t,
      propertyName: property?.name ?? "—",
      paymentDay,
      daysBefore,
      nextReminder: getNextReminder(paymentDay, daysBefore),
    };
  });

  const sentCount = tenantsWithStatus.filter((t) => t.reminderSent).length;
  const pendingReminderCount = tenantsWithStatus.filter(
    (t) => !t.reminderSent && t.paymentStatus !== "Pagado"
  ).length;

  const isLoading = propertiesState.loading || tenantsState.loading;
  const loadError = propertiesState.error || tenantsState.error;

  if (loadError) {
    return <ApiErrorState onRetry={() => fetchProperties().then(() => fetchTenants())} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0B1426]">Recordatorios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestión de recordatorios de pago vía WhatsApp
        </p>
      </div>

      {/* Global Settings Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuración global de recordatorios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Recordatorios automáticos</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                El bot enviará recordatorios automáticamente vía WhatsApp
              </p>
            </div>
            <Switch
              checked={settings.autoRemindersEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ autoRemindersEnabled: checked })
              }
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Días de anticipación por defecto
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={15}
                  className="w-20"
                  value={settings.defaultReminderDays}
                  onChange={(e) =>
                    updateSettings({
                      defaultReminderDays: parseInt(e.target.value) || 3,
                    })
                  }
                />
                <span className="text-sm text-muted-foreground">
                  días antes del vencimiento
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-2 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#2952F3]">{sentCount}</p>
              <p className="text-xs text-muted-foreground">Enviados este mes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">
                {pendingReminderCount}
              </p>
              <p className="text-xs text-muted-foreground">Pendientes de envío</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-700">
                {tenantsWithStatus.length}
              </p>
              <p className="text-xs text-muted-foreground">Total inquilinos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tenants reminder table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Estado de recordatorios — {currentMonthLabelCap}
            {isLoading && <Loader2 className="inline w-4 h-4 ml-2 animate-spin text-slate-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Nombre</TableHead>
                <TableHead>Propiedad</TableHead>
                <TableHead>Día de pago</TableHead>
                <TableHead>Días anticipación</TableHead>
                <TableHead>Próximo recordatorio</TableHead>
                <TableHead>Último recordatorio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenantRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-sm text-muted-foreground">
                    {isLoading ? "Cargando inquilinos…" : "No hay inquilinos registrados"}
                  </TableCell>
                </TableRow>
              )}
              {tenantRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="pl-6 font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.propertyName}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-xs">
                      Día {row.paymentDay}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {row.daysBefore} días
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.nextReminder}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.reminderSent ? format(new Date(), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    {row.reminderSent ? (
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Enviado
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200">
                        <BellOff className="w-3 h-3 mr-1" />
                        No enviado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#2952F3] hover:text-[#1e3fd4] hover:bg-[#eef1fd] text-xs"
                      disabled={row.paymentStatus === "Pagado"}
                      onClick={() => toggleReminderSent(row.id)}
                    >
                      <Send className="w-3 h-3 mr-1.5" />
                      {row.reminderSent ? "Desmarcar" : "Enviar ahora"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
