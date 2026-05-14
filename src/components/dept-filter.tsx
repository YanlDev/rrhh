"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

const ALL = "__all__";

export function DeptFilter({ departments, current }: { departments: string[]; current: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const onChange = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete("dept");
    else next.set("dept", value);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Building2 className="size-4 text-muted-foreground" />
      <Select value={current ?? ALL} onValueChange={onChange}>
        <SelectTrigger className="w-[220px] h-8 text-sm">
          <SelectValue placeholder="Todos los departamentos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los departamentos</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d} value={d}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
