import { db, ensureMigrated } from "@/lib/db";
import { justificationTypes } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { JustificationTypesEditor } from "@/components/justification-types-editor";
import { recalcAllAction } from "@/actions/recalc";
import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function recalc() {
  "use server";
  await recalcAllAction();
  revalidatePath("/settings/justifications");
}

export default async function JustificationsPage() {
  await ensureMigrated();
  const jus = await db.select().from(justificationTypes).orderBy(asc(justificationTypes.orderIndex));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
          <Link href="/settings"><ArrowLeft className="size-3.5" /> Configuración</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <ShieldCheck className="size-5" /> Justificaciones
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Catálogo de motivos. Edición inline.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Tipos disponibles</CardTitle>
            <CardDescription>Cambiar &quot;cuenta como trabajado&quot; afecta cálculos. Recalcula tras editar.</CardDescription>
          </div>
          <form action={recalc}>
            <Button type="submit" variant="outline" size="sm">
              <RefreshCw className="size-3.5" /> Recalcular
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <JustificationTypesEditor
            rows={jus.map((r) => ({
              id: r.id, code: r.code, labelEs: r.labelEs,
              countsAsWorked: r.countsAsWorked, color: r.color,
              orderIndex: r.orderIndex, active: r.active,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
