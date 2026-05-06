"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, LogIn } from "lucide-react";

const ERROR_MAP: Record<string, string> = {
  inactive: "Tu cuenta está desactivada. Contacta a un administrador.",
};

export function LoginForm({ from, initialError }: { from: string; initialError?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_MAP[initialError] ?? `Error: ${initialError}`) : null
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await loginAction({ username, password });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace(from || "/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="username">Usuario</Label>
        <Input
          id="username"
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        <LogIn className="size-4" />
        {pending ? "Ingresando..." : "Iniciar sesión"}
      </Button>
      <p className="text-xs text-center text-muted-foreground pt-3 border-t">
        El acceso es solo por invitación. Si olvidaste tu contraseña pídele a un admin que la
        reinicie.
      </p>
    </form>
  );
}
