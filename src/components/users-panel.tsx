"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  updateUserRoleAction,
  setUserActiveAction,
  deleteUserAction,
  resetPasswordAction,
  type AdminUserRow,
} from "@/actions/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Shield, ShieldCheck, Eye, UserPlus, MoreVertical, KeyRound, Trash2 } from "lucide-react";

type Role = "admin" | "rrhh" | "viewer";

const ROLE_META: Record<Role, { label: string; icon: typeof Shield; cls: string }> = {
  admin: { label: "Admin", icon: Shield, cls: "bg-violet-100 text-violet-800 border-transparent" },
  rrhh: { label: "RRHH", icon: ShieldCheck, cls: "bg-blue-100 text-blue-800 border-transparent" },
  viewer: { label: "Solo lectura", icon: Eye, cls: "bg-slate-100 text-slate-700 border-transparent" },
};

function generatePassword(): string {
  // 12 chars alfanuméricos sin caracteres ambiguos.
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

export function UsersPanel({ rows, currentUserId }: {
  rows: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminUserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUserRow | null>(null);

  function handle<T>(fn: () => Promise<{ ok: true; data?: T } | { ok: false; error: string }>) {
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{rows.length} usuario(s) registrado(s)</CardTitle>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="size-4" /> Crear usuario
            </Button>
          </DialogTrigger>
          <CreateUserDialog onClose={() => setCreateOpen(false)} onDone={() => router.refresh()} />
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                <TableHead>Último ingreso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => {
                const isMe = u.id === currentUserId;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="size-8 rounded-full bg-muted grid place-items-center text-xs font-semibold">
                          {(u.name || u.username).charAt(0).toUpperCase()}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm">@{u.username}</span>
                          {u.mustChangePassword && (
                            <span className="text-[10px] text-amber-700">Debe cambiar contraseña</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.name}
                      {isMe && <Badge variant="outline" className="ml-2 text-xs">Tú</Badge>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) =>
                          handle(() => updateUserRoleAction({ id: u.id, role: v as Role }))
                        }
                        disabled={pending || isMe}
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
                        onCheckedChange={(v) =>
                          handle(() => setUserActiveAction({ id: u.id, active: v }))
                        }
                        disabled={pending || isMe}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString("es-PE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setResetTarget(u)}>
                            <KeyRound className="size-4" /> Reiniciar contraseña
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isMe}
                            onClick={() => setConfirmDelete(u)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" /> Eliminar usuario
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              Se eliminará a <strong>@{confirmDelete?.username}</strong> de forma definitiva.
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!confirmDelete) return;
                const target = confirmDelete;
                setConfirmDelete(null);
                handle(() => deleteUserAction({ id: target.id }));
              }}
            >
              <Trash2 className="size-4" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        {resetTarget && (
          <ResetPasswordDialog
            user={resetTarget}
            onClose={() => setResetTarget(null)}
            onDone={() => router.refresh()}
          />
        )}
      </Dialog>
    </Card>
  );
}

/* ======================= Diálogo: crear usuario ======================= */

function CreateUserDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ username: string; password: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createUserAction({ username, name, role, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone({ username, password });
      onDone();
    });
  }

  if (done) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuario creado</DialogTitle>
          <DialogDescription>
            Comparte estas credenciales con el usuario. <strong>No se mostrarán de nuevo.</strong>
            La primera vez que ingrese se le pedirá cambiar la contraseña.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm font-mono">
          <div><span className="text-muted-foreground">Usuario:</span> {done.username}</div>
          <div><span className="text-muted-foreground">Contraseña:</span> {done.password}</div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(`Usuario: ${done.username}\nContraseña: ${done.password}`)}
          >
            Copiar
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <UserPlus className="size-4" /> Crear usuario
        </DialogTitle>
        <DialogDescription>
          Define un nombre de usuario y contraseña. Se le pedirá cambiarla al primer ingreso.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="cu-username">Usuario</Label>
          <Input
            id="cu-username"
            required
            placeholder="ej. jrios"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
          <p className="text-xs text-muted-foreground">
            Solo minúsculas, números, punto, guion y guion bajo.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cu-name">Nombre completo</Label>
          <Input id="cu-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
        </div>
        <div className="space-y-1">
          <Label htmlFor="cu-password">Contraseña inicial</Label>
          <div className="flex gap-2">
            <Input
              id="cu-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
              Generar
            </Button>
          </div>
        </div>
        {error && (
          <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Creando..." : "Crear"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/* ======================= Diálogo: reset password ======================= */

function ResetPasswordDialog({
  user, onClose, onDone,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState(() => generatePassword());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await resetPasswordAction({ id: user.id, newPassword: password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      onDone();
    });
  }

  if (done) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contraseña reiniciada</DialogTitle>
          <DialogDescription>
            La contraseña de <strong>@{user.username}</strong> fue actualizada. Sus sesiones
            activas fueron cerradas. Compártele estos datos:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm font-mono">
          <div><span className="text-muted-foreground">Usuario:</span> {user.username}</div>
          <div><span className="text-muted-foreground">Contraseña:</span> {password}</div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(`Usuario: ${user.username}\nContraseña: ${password}`)}
          >
            Copiar
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> Reiniciar contraseña
        </DialogTitle>
        <DialogDescription>
          Define una contraseña nueva para <strong>@{user.username}</strong>. Sus sesiones
          activas se cerrarán y se le pedirá cambiarla al ingresar.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="rp-pw">Nueva contraseña</Label>
          <div className="flex gap-2">
            <Input
              id="rp-pw"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="font-mono"
            />
            <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
              Generar
            </Button>
          </div>
        </div>
        {error && (
          <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Reiniciar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
