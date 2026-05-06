import { requireRoleOrRedirect } from "@/lib/auth-helpers";
import { listUsersAction } from "@/actions/users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCog, ArrowLeft, Shield, ShieldCheck, Eye } from "lucide-react";
import Link from "next/link";
import { UsersPanel } from "@/components/users-panel";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireRoleOrRedirect("admin");
  const rows = await listUsersAction();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
          <Link href="/settings"><ArrowLeft className="size-3.5" /> Configuración</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <UserCog className="size-5" /> Usuarios y permisos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invita usuarios, asigna roles y administra accesos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Niveles de permiso</CardTitle>
          <CardDescription>Cada usuario tiene un rol que determina qué puede hacer.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
          <RoleHelp icon={Shield} title="Admin" tone="violet" items={[
            "Configurar horarios y feriados",
            "Editar tipos de justificación",
            "Gestionar usuarios y roles",
            "Recalcular toda la BD",
            "Todo lo de RRHH",
          ]} />
          <RoleHelp icon={ShieldCheck} title="RRHH" tone="blue" items={[
            "Importar Excel del reloj",
            "Corregir marcas",
            "Asignar justificaciones",
            "Ver todos los reportes",
          ]} />
          <RoleHelp icon={Eye} title="Solo lectura" tone="slate" items={[
            "Ver dashboard",
            "Consultar empleados y detalles",
            "Descargar reportes",
            "No puede modificar nada",
          ]} />
        </CardContent>
      </Card>

      <UsersPanel currentUserId={me.id} rows={rows} />
    </div>
  );
}

function RoleHelp({ icon: Icon, title, tone, items }: {
  icon: React.ElementType; title: string; tone: "violet" | "blue" | "slate"; items: string[];
}) {
  const cls = {
    violet: "border-violet-200 bg-violet-50/40",
    blue: "border-blue-200 bg-blue-50/40",
    slate: "border-slate-200 bg-slate-50",
  }[tone];
  const text = { violet: "text-violet-700", blue: "text-blue-700", slate: "text-slate-700" }[tone];
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className={`flex items-center gap-2 font-semibold ${text} mb-2`}>
        <Icon className="size-4" /> {title}
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {items.map((i) => <li key={i}>• {i}</li>)}
      </ul>
    </div>
  );
}
