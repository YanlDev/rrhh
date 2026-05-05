"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  lateMinutes: { label: "Min. tarde", color: "hsl(var(--chart-1))" },
  absences: { label: "Ausencias", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

export function DepartmentBars({ data }: { data: { dept: string; lateMinutes: number; absences: number }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="dept" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} angle={-25} textAnchor="end" interval={0} height={60} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="lateMinutes" fill="var(--color-lateMinutes)" radius={4} />
        <Bar dataKey="absences" fill="var(--color-absences)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

function Empty() {
  return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">Sin datos</div>;
}
