import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ApiErrorState({
  title = "Algo salió mal",
  description = "No se pudieron cargar los datos. Intenta de nuevo.",
  onRetry,
}: ApiErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-slate-400" />
      </div>
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold text-[#0B1426]">{title}</p>
        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
