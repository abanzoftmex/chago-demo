/**
 * Superadmin · Respaldos — copias de seguridad por tenant:
 * creación, restauración, descarga, eliminación y limpieza de datos.
 * Acepta ?tenant=<id> para preseleccionar un tenant.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  RotateCcw,
  Trash2,
} from "lucide-react";
import SuperAdminLayout from "../../../components/superadmin/SuperAdminLayout";
import { useSuperAdmin } from "../../../components/superadmin/SuperAdminContext";
import { useBackups } from "../../../components/superadmin/hooks/useBackups";
import { BackupConfirmDialog } from "../../../components/superadmin/BackupConfirmDialog";
import { PageHeader } from "../../../components/superadmin/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/superadmin/ui/card";
import { Button } from "../../../components/superadmin/ui/button";
import { Badge } from "../../../components/superadmin/ui/badge";
import { Skeleton } from "../../../components/superadmin/ui/skeleton";
import { EmptyState } from "../../../components/superadmin/ui/empty-state";
import { ResultAlert } from "../../../components/superadmin/ui/alert";
import { Spinner } from "../../../components/superadmin/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/superadmin/ui/select";
import {
  backupTypeMeta,
  formatBytes,
  formatDateTime,
} from "../../../components/superadmin/lib/format";

const howItWorks = [
  "El respaldo exporta todas las colecciones del tenant a un JSON guardado en Firebase Storage.",
  "Antes de limpiar o restaurar se crea siempre un respaldo automático del estado actual.",
  "Los usuarios del tenant nunca se eliminan ni se sobrescriben.",
  "Puedes descargar cualquier respaldo como archivo JSON.",
];

function BackupsContent() {
  const router = useRouter();
  const { tenants, tenantsLoading } = useSuperAdmin();

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [result, setResult] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  const { backups, backupsLoading, working, loadBackups, createBackup, runConfirmedAction } =
    useBackups({ setResult });

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) || null;

  // Preselección: ?tenant=<id> o el primer tenant disponible
  useEffect(() => {
    if (!router.isReady || tenants.length === 0) return;

    setSelectedTenantId((current) => {
      if (current && tenants.some((tenant) => tenant.id === current)) return current;
      const fromQuery = typeof router.query.tenant === "string" ? router.query.tenant : "";
      if (fromQuery && tenants.some((tenant) => tenant.id === fromQuery)) return fromQuery;
      return tenants[0].id;
    });
  }, [router.isReady, router.query.tenant, tenants]);

  useEffect(() => {
    if (selectedTenantId) {
      loadBackups(selectedTenantId);
    }
  }, [selectedTenantId, loadBackups]);

  const handleConfirm = (confirmName) =>
    runConfirmedAction(confirmAction, confirmName, {
      onDone: async (action) => {
        setConfirmAction(null);
        if (action.tenant.id === selectedTenantId) {
          await loadBackups(selectedTenantId);
        }
      },
    });

  return (
    <>
      <PageHeader
        eyebrow="Respaldos"
        title="Copias de seguridad, sin sobresaltos."
        description="Cada respaldo guarda un JSON completo del tenant. Al restaurar se reemplazan los datos, conservando los usuarios actuales."
        actions={
          <>
            <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
              <SelectTrigger className="w-[220px]" aria-label="Seleccionar tenant">
                <SelectValue
                  placeholder={tenantsLoading ? "Cargando tenants…" : "Selecciona un tenant"}
                />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.nombreEmpresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="brand"
              onClick={() => createBackup(selectedTenant)}
              disabled={working || !selectedTenant}
            >
              {working && !confirmAction ? (
                <>
                  <Spinner />
                  Creando respaldo
                </>
              ) : (
                <>
                  <DatabaseBackup className="size-4" />
                  Crear respaldo
                </>
              )}
            </Button>
          </>
        }
      />

      {result && <ResultAlert result={result} onClose={() => setResult(null)} className="mt-6" />}

      <div className="mt-7 grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        {/* Lista de respaldos */}
        <Card className="sa-rise overflow-hidden" style={{ animationDelay: "0.08s" }}>
          <CardHeader className="pb-4">
            <CardTitle>
              {selectedTenant ? `Respaldos de ${selectedTenant.nombreEmpresa}` : "Respaldos"}
            </CardTitle>
            <CardDescription>
              Historial de copias de seguridad del tenant seleccionado.
            </CardDescription>
          </CardHeader>

          {tenantsLoading || backupsLoading ? (
            <div className="space-y-3 border-t border-border/60 p-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : !selectedTenant ? (
            <EmptyState
              icon={DatabaseBackup}
              title="Sin tenants disponibles"
              description="Crea un tenant primero para poder generar copias de seguridad."
            />
          ) : backups.length === 0 ? (
            <EmptyState
              icon={DatabaseBackup}
              title="Sin respaldos para este tenant"
              description="Crea la primera copia de seguridad para poder restaurar o limpiar con tranquilidad."
              action={
                <Button variant="brand" onClick={() => createBackup(selectedTenant)} disabled={working}>
                  <DatabaseBackup className="size-4" />
                  Crear primer respaldo
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border/60 border-t border-border/60">
              {backups.map((backup) => {
                const typeMeta = backupTypeMeta[backup.type] || {
                  label: backup.type || "—",
                  variant: "secondary",
                };

                return (
                  <div
                    key={backup.id}
                    className="flex flex-col gap-3.5 px-6 py-4.5 transition-colors hover:bg-accent/40 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-sm font-semibold text-foreground">
                          {formatDateTime(backup.createdAt)}
                        </p>
                        <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {backup.totalDocs ?? "—"} documentos · {formatBytes(backup.sizeBytes)}
                      </p>
                      {backup.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground/80">{backup.note}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ mode: "restore", tenant: selectedTenant, backup })
                        }
                        disabled={working}
                      >
                        <RotateCcw className="size-3.5" />
                        Restaurar
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/admin/tenant-backups/download?backupId=${backup.id}`}>
                          <Download className="size-3.5" />
                          Descargar
                        </a>
                      </Button>
                      <Button
                        variant="destructive-outline"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ mode: "delete", tenant: selectedTenant, backup })
                        }
                        disabled={working}
                      >
                        <Trash2 className="size-3.5" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {/* Cómo funciona */}
          <Card className="sa-rise bg-card/70" style={{ animationDelay: "0.14s" }}>
            <CardHeader className="pb-4">
              <CardTitle>Cómo funcionan los respaldos</CardTitle>
              <CardDescription>Reglas del sistema de copias y restauración.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-3.5">
                {howItWorks.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" strokeWidth={1.8} />
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Zona de riesgo */}
          <Card className="sa-rise border-destructive/25" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="flex-row items-center gap-3.5 pb-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-4.5" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle className="text-lg">Zona de riesgo</CardTitle>
                <CardDescription className="mt-0.5">Acciones irreversibles.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-1">
              <p className="text-sm leading-6 text-muted-foreground">
                Elimina todos los datos de{" "}
                <span className="font-semibold text-foreground">
                  {selectedTenant?.nombreEmpresa || "el tenant seleccionado"}
                </span>{" "}
                dejando únicamente los usuarios. Antes del borrado se genera una copia de seguridad
                automática en Firebase.
              </p>
              <Button
                variant="destructive"
                className="mt-5 w-full"
                onClick={() => setConfirmAction({ mode: "wipe", tenant: selectedTenant })}
                disabled={working || !selectedTenant}
              >
                <Trash2 className="size-4" />
                Limpiar datos del tenant
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <BackupConfirmDialog
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        working={working}
      />
    </>
  );
}

export default function BackupsPage() {
  return (
    <SuperAdminLayout title="Respaldos">
      <BackupsContent />
    </SuperAdminLayout>
  );
}
