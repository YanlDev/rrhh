import { NextRequest, NextResponse } from "next/server";
import { ensureMigrated } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import {
  exportCleanExcel,
  exportDailyDetail,
  exportEmployeeSummary,
  exportDepartmentSummary,
  exportIncidentsCsv,
  exportExecutive,
} from "@/lib/excel/exporter";

const HANDLERS = {
  clean: exportCleanExcel,
  daily: exportDailyDetail,
  "employee-summary": exportEmployeeSummary,
  department: exportDepartmentSummary,
  incidents: exportIncidentsCsv,
  executive: exportExecutive,
} as const;

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_CSV = "text/csv; charset=utf-8";

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  await ensureMigrated();
  const { type } = await params;
  const handler = HANDLERS[type as keyof typeof HANDLERS];
  if (!handler) return NextResponse.json({ error: "Tipo desconocido" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const period = await resolvePeriod({ period: sp.get("period") ?? undefined });
  if (!period) return NextResponse.json({ error: "No hay periodo" }, { status: 400 });

  try {
    const { buffer, filename } = await handler(period);
    const mime = filename.endsWith(".csv") ? MIME_CSV : MIME_XLSX;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
