import { db, ensureMigrated } from "./index";
import { justificationTypes, holidays } from "./schema";

const JUSTIFICATIONS = [
  { code: "commission",      labelEs: "Comisión / Trabajo externo", countsAsWorked: true,  color: "#3b82f6", icon: "briefcase",     orderIndex: 1 },
  { code: "medical",         labelEs: "Permiso médico",             countsAsWorked: true,  color: "#10b981", icon: "stethoscope",   orderIndex: 2 },
  { code: "permit_paid",     labelEs: "Permiso con goce",           countsAsWorked: true,  color: "#34d399", icon: "check-circle",  orderIndex: 3 },
  { code: "permit_unpaid",   labelEs: "Permiso sin goce",           countsAsWorked: false, color: "#9ca3af", icon: "circle-slash",  orderIndex: 4 },
  { code: "vacation",        labelEs: "Vacaciones",                 countsAsWorked: true,  color: "#a855f7", icon: "palmtree",      orderIndex: 5 },
  { code: "sick_leave",      labelEs: "Licencia médica",            countsAsWorked: true,  color: "#f87171", icon: "heart-pulse",   orderIndex: 6 },
  { code: "absence",         labelEs: "Falta injustificada",        countsAsWorked: false, color: "#ef4444", icon: "x-circle",      orderIndex: 7 },
  { code: "holiday_company", labelEs: "Feriado empresa",            countsAsWorked: true,  color: "#eab308", icon: "party-popper",  orderIndex: 8 },
  { code: "training",        labelEs: "Capacitación",               countsAsWorked: true,  color: "#6366f1", icon: "graduation-cap",orderIndex: 9 },
  { code: "late_justified",  labelEs: "Tardanza justificada",       countsAsWorked: true,  color: "#f97316", icon: "clock",         orderIndex: 10 },
];

const HOLIDAYS_2026: [string, string][] = [
  ["2026-01-01", "Año Nuevo"],
  ["2026-04-02", "Jueves Santo"],
  ["2026-04-03", "Viernes Santo"],
  ["2026-05-01", "Día del Trabajo"],
  ["2026-06-07", "Batalla de Arica"],
  ["2026-06-29", "San Pedro y San Pablo"],
  ["2026-07-23", "Día de la Fuerza Aérea"],
  ["2026-07-28", "Independencia del Perú"],
  ["2026-07-29", "Independencia del Perú"],
  ["2026-08-06", "Batalla de Junín"],
  ["2026-08-30", "Santa Rosa de Lima"],
  ["2026-10-08", "Combate de Angamos"],
  ["2026-11-01", "Todos los Santos"],
  ["2026-12-08", "Inmaculada Concepción"],
  ["2026-12-09", "Batalla de Ayacucho"],
  ["2026-12-25", "Navidad"],
];

async function main() {
  await ensureMigrated();
  for (const j of JUSTIFICATIONS) {
    await db.insert(justificationTypes).values(j).onConflictDoNothing({ target: justificationTypes.code });
  }
  for (const [date, desc] of HOLIDAYS_2026) {
    await db.insert(holidays).values({ holidayDate: date, description: desc, isNational: true })
      .onConflictDoNothing({ target: holidays.holidayDate });
  }
  console.log("✓ Seed completo");
}

main().then(() => process.exit(0));
