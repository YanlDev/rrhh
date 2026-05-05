"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const config = {
  pct: { label: "% asistencia", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

export function AttendanceLine({ data }: { data: { date: string; pct: number; present: number; expected: number }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="fillPct" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-pct)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-pct)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(8)} interval={1} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} unit="%" />
        <ChartTooltip
          content={<ChartTooltipContent indicator="line" labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ""} />}
        />
        <Area dataKey="pct" type="monotone" stroke="var(--color-pct)" strokeWidth={2} fill="url(#fillPct)" />
      </AreaChart>
    </ChartContainer>
  );
}

function Empty() {
  return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">Sin datos</div>;
}
