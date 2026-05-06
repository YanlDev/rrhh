import { UploadZone } from "@/components/upload-zone";
import { db, ensureMigrated } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportHistoryTable } from "@/components/import-history";
import { requireRrhh } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const me = await requireRrhh();
  await ensureMigrated();
  const batches = await db
    .select()
    .from(importBatches)
    .orderBy(desc(importBatches.uploadedAt))
    .limit(10);

  const rows = batches.map((b) => ({
    id: b.id,
    filename: b.filename,
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    employeesCount: b.employeesCount,
    daysCount: b.daysCount,
    uploadedAt: b.uploadedAt ? b.uploadedAt.toISOString() : null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar reporte ZKBio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube el Excel exportado del reloj. Las correcciones manuales previas se preservan.
        </p>
      </div>

      <UploadZone />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
          <CardDescription>Últimas 10 importaciones</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Sin importaciones previas.</p>
          ) : (
            <ImportHistoryTable rows={rows} canDelete={me.role === "admin"} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
