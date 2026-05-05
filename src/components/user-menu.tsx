"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, Shield } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  rrhh: "RRHH",
  viewer: "Solo lectura",
};

export function UserMenu({ name, email, image, role }: {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  role: string;
}) {
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9 px-2">
          {image ? (
            <Image src={image} alt="" width={28} height={28} className="rounded-full size-7" />
          ) : (
            <span className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
              {initial}
            </span>
          )}
          <span className="text-sm font-medium hidden sm:inline">{name ?? email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="font-medium text-sm">{name ?? "Usuario"}</span>
          <span className="text-xs text-muted-foreground truncate">{email}</span>
          <span className="text-xs flex items-center gap-1 mt-1 text-blue-700">
            <Shield className="size-3" /> {ROLE_LABEL[role] ?? role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="size-4" /> Mi cuenta
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
          <LogOut className="size-4" /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
