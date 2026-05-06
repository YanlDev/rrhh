import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  if (user?.active) redirect(sp.from ?? "/");

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-3">
          <div className="size-12 mx-auto rounded-md bg-primary text-primary-foreground grid place-items-center">
            <Clock className="size-6" />
          </div>
          <CardTitle className="text-xl">Sistema de Asistencia</CardTitle>
          <CardDescription>Ingresa con tu usuario y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm from={sp.from ?? "/"} initialError={sp.error} />
        </CardContent>
      </Card>
    </div>
  );
}
