import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="relative min-h-screen grid place-items-center bg-muted/30 px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-xl">Sistema de Reportes RRHH</CardTitle>
          <CardDescription>Ingresa con tu usuario y contraseña</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm from={sp.from ?? "/"} initialError={sp.error} />
        </CardContent>
      </Card>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        Creado por{" "}
        <a
          href="https://www.linkedin.com/in/yaniv-carreon/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-blue-600 hover:underline"
        >
          YanlDev
        </a>
      </div>
    </div>
  );
}
