"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted ? (resolvedTheme ?? theme) === "dark" : false;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={"size-8 " + (className ?? "")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <Moon className="size-4 opacity-0" />}
    </Button>
  );
}
