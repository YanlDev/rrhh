import { UploadZone } from "@/components/upload-zone";
import { db, ensureMigrated } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await ensureMigrated();
  const batches = await db.select().from(importBatches).orderBy(desc(importBatches.uploadedAt)).limit(10);

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
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Sin importaciones previas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead className="text-right">Empleados</TableHead>
                  <TableHead className="text-right">Días</TableHead>
                  <TableHead>Subido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.filename}</TableCell>
                    <TableCell>{b.periodStart} → {b.periodEnd}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.employeesCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{b.daysCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.uploadedAt ? new Date(b.uploadedAt).toLocaleString("es-PE") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
