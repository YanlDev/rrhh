"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { updateUserRoleAction, setUserActiveAction } from "@/actions/users";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Eye } from "lucide-react";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: "admin" | "rrhh" | "viewer";
  active: boolean;
  createdAt: number | null;
};

const ROLE_META: Record<string, { label: string; icon: typeof Shield; cls: string }> = {
  admin: { label: "Admin", icon: Shield, cls: "bg-violet-100 text-violet-800 border-transparent" },
  rrhh: { label: "RRHH", icon: ShieldCheck, cls: "bg-blue-100 text-blue-800 border-transparent" },
  viewer: { label: "Solo lectura", icon: Eye, cls: "bg-slate-100 text-slate-700 border-transparent" },
};

export function UsersTable({ rows, currentUserId }: { rows: Row[]; currentUserId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const setRole = (id: string, role: Row["role"]) =>
    start(async () => {
      try { await updateUserRoleAction({ id, role }); router.refresh(); }
      catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    });

  const setActive = (id: string, active: boolean) =>
    start(async () => {
      try { await setUserActiveAction({ id, active }); router.refresh(); }
      catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead className="text-center">Activo</TableHead>
            <TableHead>Registrado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => {
            const isMe = u.id === currentUserId;
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {u.image ? (
                      <Image src={u.image} alt="" width={32} height={32} className="rounded-full size-8" />
                    ) : (
                      <span className="size-8 rounded-full bg-muted grid place-items-center text-xs font-semibold">
                        {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <div className="font-medium text-sm">
                        {u.name ?? "—"}
                        {isMe && <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={(v) => setRole(u.id, v as Row["role"])}
                    disabled={pending}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["admin", "rrhh", "viewer"] as const).map((r) => {
                        const meta = ROLE_META[r];
                        return (
                          <SelectItem key={r} value={r}>
                            <span className="flex items-center gap-2">
                              <meta.icon className="size-3.5" /> {meta.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={u.active}
                    onCheckedChange={(v) => setActive(u.id, v)}
                    disabled={pending || isMe}
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {u.createdAt ? new Date(u.createdAt * 1000).toLocaleDateString("es-PE") : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
