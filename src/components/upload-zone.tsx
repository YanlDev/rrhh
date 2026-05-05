"use client";

import { useState, useTransition } from "react";
import { importExcelAction, type ImportResult } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet, UploadCloud, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function UploadZone() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (!file) return;
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        const r = await importExcelAction(fd);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <label className="flex flex-col items-center justify-center gap-2 p-10 cursor-pointer rounded-lg border-2 border-dashed border-transparent hover:border-primary/40 hover:bg-muted/40 transition">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <FileSpreadsheet className="size-10 text-primary" />
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
              </>
            ) : (
              <>
                <UploadCloud className="size-10 text-muted-foreground" />
                <div className="text-sm font-medium">Click para elegir Excel ZKBio</div>
                <div className="text-xs text-muted-foreground">Hoja esperada: <span className="font-mono">Punch Time(YYYYMMDD-YYYYMMDD)</span></div>
              </>
            )}
          </label>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={!file || pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Procesando..." : "Importar"}
      </Button>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-3 flex gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-emerald-300 bg-emerald-50/60">
          <CardContent className="p-4 text-sm space-y-1">
            <div className="font-medium text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Importación completa
            </div>
            <div>Periodo: {result.periodStart} → {result.periodEnd}</div>
            <div>Empleados procesados: {result.employeesUpserted} ({result.inactiveCount} inactivos)</div>
            <div>Días-empleado registrados: {result.daysUpserted}</div>
            <div>Incidencias detectadas: {result.incidentsDetected}</div>
            <div>Correcciones preservadas: {result.preservedCorrections}</div>
            {result.warnings.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-amber-800">{result.warnings.length} advertencias</summary>
                <ul className="mt-1 ml-4 list-disc text-xs">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
