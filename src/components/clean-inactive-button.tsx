"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInactiveEmployeesAction } from "@/actions/employees";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export function CleanInactiveButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res = await deleteInactiveEmployeesAction();
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" /> Limpiar empleados sin actividad
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" /> Limpiar empleados sin actividad
          </DialogTitle>
          <DialogDescription>
            Se eliminarán <strong>{count}</strong> empleado(s) que no tienen ninguna marca registrada.
            Si vuelves a importar un Excel donde aparezcan, se recrearán automáticamente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Eliminar {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
