import { CheckCircle2, Clock, AlertTriangle, XCircle, ShieldCheck, MinusCircle } from "lucide-react";

export const STATUS_META: Record<string, {
  label: string;
  badgeClass: string;
  cellClass: string;
  legendClass: string;
  icon: React.ElementType;
}> = {
  ok: {
    label: "OK",
    badgeClass: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    cellClass: "bg-emerald-200/80 text-emerald-900 hover:bg-emerald-300",
    legendClass: "bg-emerald-200",
    icon: CheckCircle2,
  },
  late: {
    label: "Tarde",
    badgeClass: "bg-orange-100 text-orange-800 hover:bg-orange-100",
    cellClass: "bg-orange-200/80 text-orange-900 hover:bg-orange-300",
    legendClass: "bg-orange-200",
    icon: Clock,
  },
  incomplete: {
    label: "Incompleto",
    badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    cellClass: "bg-amber-200/80 text-amber-900 hover:bg-amber-300",
    legendClass: "bg-amber-200",
    icon: AlertTriangle,
  },
  absent: {
    label: "Ausente",
    badgeClass: "bg-red-100 text-red-800 hover:bg-red-100",
    cellClass: "bg-red-200/80 text-red-900 hover:bg-red-300",
    legendClass: "bg-red-200",
    icon: XCircle,
  },
  justified: {
    label: "Justificado",
    badgeClass: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    cellClass: "bg-blue-200/80 text-blue-900 hover:bg-blue-300",
    legendClass: "bg-blue-200",
    icon: ShieldCheck,
  },
  no_workday: {
    label: "No laborable",
    badgeClass: "bg-slate-100 text-slate-600 hover:bg-slate-100",
    cellClass: "bg-slate-100 text-slate-400",
    legendClass: "bg-slate-200",
    icon: MinusCircle,
  },
};

export const DOW_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DOW_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
