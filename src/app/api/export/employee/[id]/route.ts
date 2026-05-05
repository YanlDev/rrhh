import { NextRequest, NextResponse } from "next/server";
import { ensureMigrated } from "@/lib/db";
import { resolvePeriod } from "@/lib/period";
import { exportEmployeeReport } from "@/lib/excel/exporter";

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureMigrated();
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const period = await resolvePeriod({ period: sp.get("period") ?? undefined });
  if (!period) return NextResponse.json({ error: "No hay periodo" }, { status: 400 });

  try {
    const { buffer, filename } = await exportEmployeeReport(id, period);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": MIME_XLSX,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
