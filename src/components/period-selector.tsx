"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Period, RangeMode } from "@/lib/period";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarRange } from "lucide-react";

const MODE_LABEL: Record<RangeMode, string> = {
  month: "Mes",
  fortnight: "Quincena",
  week: "Semana",
};

export function PeriodSelector({ periods, current }: { periods: Period[]; current: Period | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (periods.length === 0) return null;

  const mode: RangeMode = current?.mode ?? "month";
  const filtered = periods.filter((p) => p.mode === mode);
  const value = current?.key ?? filtered[0]?.key ?? "";

  const navigate = (key: string) => {
    const next = new URLSearchParams(params);
    next.set("period", key);
    router.push(`${pathname}?${next.toString()}`);
  };

  const switchMode = (m: string) => {
    const first = periods.find((p) => p.mode === m);
    if (first) navigate(first.key);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Tabs value={mode} onValueChange={switchMode}>
        <TabsList className="h-8">
          <TabsTrigger value="month" className="text-xs px-2 h-6">{MODE_LABEL.month}</TabsTrigger>
          <TabsTrigger value="fortnight" className="text-xs px-2 h-6">{MODE_LABEL.fortnight}</TabsTrigger>
          <TabsTrigger value="week" className="text-xs px-2 h-6">{MODE_LABEL.week}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" />
        <Select value={value} onValueChange={navigate}>
          <SelectTrigger className="w-[260px] h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filtered.map((p) => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
