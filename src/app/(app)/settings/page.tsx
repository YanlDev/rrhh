import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Clock, ShieldCheck, CalendarX, ArrowRight, UserCog } from "lucide-react";
import { auth } from "@/auth";

const SECTIONS = [
  { href: "/settings/schedule", title: "Horarios", description: "Hora de entrada/salida L-V y sábados, tolerancia, umbral de duplicados.", icon: Clock, adminOnly: false },
  { href: "/settings/justifications", title: "Justificaciones", description: "Catálogo CRUD de motivos. Cada uno cuenta o no como día trabajado.", icon: ShieldCheck, adminOnly: false },
  { href: "/settings/holidays", title: "Feriados", description: "Días que el sistema no evalúa como laborables.", icon: CalendarX, adminOnly: false },
  { href: "/settings/users", title: "Usuarios", description: "Gestiona quién accede y con qué permisos (Admin / RRHH / Solo lectura).", icon: UserCog, adminOnly: true },
];

export default async function SettingsHub() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";
  const visible = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <SettingsIcon className="size-5" /> Configuración
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Parámetros globales del sistema.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
              <CardHeader>
                <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center">
                  <s.icon className="size-5" />
                </div>
                <CardTitle className="text-base mt-3 flex items-center justify-between">
                  {s.title}
                  <ArrowRight className="size-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                </CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
