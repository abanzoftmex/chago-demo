"use client";

import { useEffect, useState } from "react";
import { PencilLine } from "lucide-react";
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

/**
 * Edición de datos del tenant (empresa + admin).
 * `onSave(payload)` debe devolver { success } o { error }.
 */
export function TenantEditDialog({ tenant, onClose, onSave, saving }) {
  const [formData, setFormData] = useState({ nombreEmpresa: "", adminName: "", adminEmail: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (tenant) {
      setFormData({
        nombreEmpresa: tenant.nombreEmpresa || "",
        adminName: tenant.adminName === "—" ? "" : tenant.adminName || "",
        adminEmail: tenant.adminEmail === "—" ? "" : tenant.adminEmail || "",
      });
      setError("");
    }
  }, [tenant]);

  if (!tenant) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.nombreEmpresa.trim() || !formData.adminEmail.trim()) {
      setError("El nombre de la empresa y el correo del administrador son obligatorios.");
      return;
    }

    const result = await onSave({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      nombreEmpresa: formData.nombreEmpresa.trim(),
      adminName: formData.adminName.trim(),
      adminEmail: formData.adminEmail.trim(),
    });

    if (result?.error) setError(result.error);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-accent text-foreground">
            <PencilLine className="size-5" strokeWidth={1.8} />
          </div>
          <DialogTitle>Editar tenant</DialogTitle>
          <DialogDescription>
            El correo del admin se actualiza con cuenta de servicio sin cambiar el UID del usuario.
            Si el nuevo correo ya existe en otro usuario, el sistema bloqueará la actualización.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="sa-edit-empresa">Empresa</Label>
            <Input
              id="sa-edit-empresa"
              name="nombreEmpresa"
              value={formData.nombreEmpresa}
              onChange={handleChange}
              placeholder="Nombre comercial"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sa-edit-nombre">Nombre del admin</Label>
              <Input
                id="sa-edit-nombre"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                placeholder="Nombre para mostrar"
              />
            </div>
            <div>
              <Label htmlFor="sa-edit-correo">Correo del admin</Label>
              <Input
                id="sa-edit-correo"
                name="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="admin@empresa.com"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Spinner />
                  Guardando cambios
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
