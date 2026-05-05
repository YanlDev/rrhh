"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function JustificationPie({ data }: { data: { label: string; value: number; color: string }[] }) {
  if (data.length === 0) return <Empty />;

  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.label, { label: d.label, color: d.color }])
  );

  return (
    <ChartContainer config={config} className="h-[260px] w-full">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
        <Pie data={data} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90} strokeWidth={2}>
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="label" />} />
      </PieChart>
    </ChartContainer>
  );
}

function Empty() {
  return <div className="h-[260px] grid place-items-center text-sm text-muted-foreground">Sin justificaciones</div>;
}
