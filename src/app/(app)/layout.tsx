import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Token presente pero inválido (ej. proyecto migrado, sesión expirada): pedir limpieza de cookie.
  if (!user) redirect("/login?stale=1");
  if (!user.active) redirect("/login?error=inactive&stale=1");

  // Forzar cambio de contraseña antes de usar la app.
  // /account/* está fuera de este layout, así que no hay loop.
  if (user.mustChangePassword) redirect("/account/change-password");

  return (
    <SidebarProvider>
      <AppSidebar role={user.role} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-sm font-medium">Sistema de asistencia</h1>
          <div className="ml-auto">
            <UserMenu
              name={user.name}
              username={user.username}
              role={user.role}
            />
          </div>
        </header>
        <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
