"use client";

import {
  LayoutDashboard,
  Upload,
  ClipboardCheck,
  Users,
  Settings,
  FileDown,
  ChevronRight,
  ShieldCheck,
  CalendarX,
  Clock,
  UserCog,
  CalendarDays,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", label: "Importar", icon: Upload },
  { href: "/review", label: "Revisión", icon: ClipboardCheck },
  { href: "/employees", label: "Empleados", icon: Users },
  { href: "/rankings", label: "Rankings", icon: Trophy },
  { href: "/reports", label: "Reportes", icon: FileDown },
];

type SettingsItem = { href: string; label: string; icon: typeof Clock; adminOnly?: boolean };
const SETTINGS_ITEMS: SettingsItem[] = [
  { href: "/settings/schedule", label: "Horarios", icon: Clock },
  { href: "/settings/schedule-overrides", label: "Días especiales", icon: CalendarDays },
  { href: "/settings/justifications", label: "Justificaciones", icon: ShieldCheck },
  { href: "/settings/holidays", label: "Feriados", icon: CalendarX },
  { href: "/settings/users", label: "Usuarios", icon: UserCog, adminOnly: true },
];

export function AppSidebar({ role }: { role: "admin" | "rrhh" | "viewer" }) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");
  const showSettings = role === "admin" || role === "rrhh";
  const visibleSettings = SETTINGS_ITEMS.filter((s) => !s.adminOnly || role === "admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Sistema de Reportes</span>
            <span className="text-xs text-muted-foreground">RRHH</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {showSettings && (
              <Collapsible defaultOpen={settingsActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Configuración" isActive={settingsActive}>
                      <Settings />
                      <span>Configuración</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleSettings.map((sub) => {
                        const active = pathname === sub.href || pathname.startsWith(sub.href + "/");
                        return (
                          <SidebarMenuSubItem key={sub.href}>
                            <SidebarMenuSubButton asChild isActive={active}>
                              <Link href={sub.href}>
                                <sub.icon className="size-3.5" />
                                <span>{sub.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2 text-[10px] text-muted-foreground group-data-[collapsible=icon]:hidden">
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
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
