import { db, ensureMigrated } from "@/lib/db";
import { holidays } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { HolidaysEditor } from "@/components/holidays-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarX, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  await ensureMigrated();
  const rows = await db.select().from(holidays).orderBy(asc(holidays.holidayDate));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
          <Link href="/settings"><ArrowLeft className="size-3.5" /> Configuración</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <CalendarX className="size-5" /> Feriados
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Días que el sistema marca como no laborables. Al crear o eliminar se recalcula todo el periodo importado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} feriados</CardTitle>
          <CardDescription>Edición inline de descripción y bandera nacional.</CardDescription>
        </CardHeader>
        <CardContent>
          <HolidaysEditor rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
