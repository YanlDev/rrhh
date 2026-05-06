import { requireUserOrRedirect } from "@/lib/auth-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/change-password-form";
import { KeyRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await requireUserOrRedirect();

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center">
            <KeyRound className="size-5" />
          </div>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            {user.mustChangePassword
              ? "Por seguridad debes definir una contraseña personal antes de continuar."
              : "Actualiza tu contraseña."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm forced={user.mustChangePassword} />
        </CardContent>
      </Card>
    </div>
  );
}
