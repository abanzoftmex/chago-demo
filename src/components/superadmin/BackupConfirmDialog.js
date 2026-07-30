"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { formatBytes, formatDateTime, backupTypeMeta } from "./lib/format";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Spinner } from "./ui/spinner";

const copy = {
  wipe: {
    icon: AlertTriangle,
    tone: "destructive",
    title: "Limpiar datos del tenant",
    description:
      "Se eliminarán todas las colecciones de datos del tenant (entradas, salidas, transacciones, catálogos, configuración, etc.). Los usuarios se conservan y antes del borrado se crea una copia de seguridad automática.",
    confirmLabel: "Limpiar datos",
    workingLabel: "Respaldando y limpiando",
  },
  restore: {
    icon: RotateCcw,
    tone: "default",
    title: "Restaurar respaldo",
    description:
      "Los datos actuales del tenant se reemplazarán por los del respaldo seleccionado. Los usuarios actuales se conservan y antes de restaurar se crea una copia de seguridad del estado actual.",
    confirmLabel: "Restaurar respaldo",
    workingLabel: "Restaurando datos",
  },
  delete: {
    icon: Trash2,
    tone: "destructive",
    title: "Eliminar respaldo",
    description:
      "El archivo del respaldo se eliminará de forma permanente de Firebase. Esta acción no afecta los datos actuales del tenant.",
    confirmLabel: "Eliminar respaldo",
    workingLabel: "Eliminando respaldo",
  },
};

/**
 * Confirmación de operaciones sensibles sobre respaldos.
 * `action`: { mode: "wipe" | "restore" | "delete", tenant, backup? } | null
 * `onConfirm(confirmName)` debe devolver { success } o { error }.
 */
export function BackupConfirmDialog({ action, onClose, onConfirm, working }) {
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState("");

  const mode = action?.mode;
  const tenant = action?.tenant;
  const backup = action?.backup;

  useEffect(() => {
    if (action) {
      setConfirmName("");
      setError("");
    }
  }, [action]);

  if (!action) return null;

  const meta = copy[mode];
  const requiresName = mode === "wipe" || mode === "restore";
  const expectedName = (tenant?.nombreEmpresa || "").trim();
  const nameMismatch = requiresName && confirmName.trim() !== expectedName;
  const typeMeta = backup ? backupTypeMeta[backup.type] || { label: backup.type || "—", variant: "secondary" } : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (nameMismatch) {
      setError("El nombre no coincide con el de la empresa.");
      return;
    }

    const result = await onConfirm(confirmName.trim());
    if (result?.error) setError(result.error);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !working && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div
            className={
              meta.tone === "destructive"
                ? "mb-1 flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
                : "mb-1 flex size-11 items-center justify-center rounded-2xl bg-accent text-foreground"
            }
          >
            <meta.icon className="size-5" strokeWidth={1.8} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {tenant?.nombreEmpresa || "Tenant"}
          </p>
          <DialogTitle>{meta.title}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        {backup && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-accent/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-sm font-semibold text-foreground">
                {formatDateTime(backup.createdAt)}
              </p>
              <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {backup.totalDocs ?? "—"} documentos · {formatBytes(backup.sizeBytes)}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {requiresName && (
            <div className="mt-5">
              <Label htmlFor="sa-confirm-name">
                Escribe <span className="font-semibold text-foreground">{expectedName}</span> para
                confirmar
              </Label>
              <Input
                id="sa-confirm-name"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                placeholder={expectedName}
                autoFocus
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={working}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={meta.tone === "destructive" ? "destructive" : "default"}
              disabled={working || nameMismatch}
            >
              {working ? (
                <>
                  <Spinner />
                  {meta.workingLabel}
                </>
              ) : (
                meta.confirmLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
