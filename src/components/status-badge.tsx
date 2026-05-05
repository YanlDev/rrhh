import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status];
  if (!m) return <Badge variant="outline">{status}</Badge>;
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`gap-1 border-transparent ${m.badgeClass}`}>
      <Icon className="size-3" />
      {m.label}
    </Badge>
  );
}
