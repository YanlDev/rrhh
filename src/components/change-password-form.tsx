"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeOwnPasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (next !== confirm) return setError("Las contraseñas no coinciden.");
    if (next === current) return setError("La nueva contraseña debe ser distinta a la actual.");

    start(async () => {
      const res = await changeOwnPasswordAction({ currentPassword: current, newPassword: next });
      if (!res.ok) return setError(res.error);
      setDone(true);
      setTimeout(() => {
        router.replace("/");
        router.refresh();
      }, 800);
    });
  }

  if (done) {
    return (
      <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
        <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
        <span>Contraseña actualizada. Redirigiendo...</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="cur">Contraseña actual</Label>
        <Input id="cur" type="password" required value={current}
          onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new">Nueva contraseña</Label>
        <Input id="new" type="password" required minLength={8} value={next}
          onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="conf">Confirmar nueva contraseña</Label>
        <Input id="conf" type="password" required minLength={8} value={confirm}
          onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Guardando..." : forced ? "Continuar" : "Actualizar"}
      </Button>
    </form>
  );
}
