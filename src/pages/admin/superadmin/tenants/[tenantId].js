/**
 * Superadmin · Detalle de tenant — información general, usuarios,
 * colecciones de datos y respaldos con acciones de mantenimiento.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AlertTriangle,
  ArrowLeft,
  DatabaseBackup,
  Download,
  FolderOpen,
  KeyRound,
  Link2,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldOff,
  Trash2,
  Users,
} from "lucide-react";
import SuperAdminLayout from "../../../../components/superadmin/SuperAdminLayout";
import { useSuperAdmin } from "../../../../components/superadmin/SuperAdminContext";
import { useBackups } from "../../../../components/superadmin/hooks/useBackups";
import { BackupConfirmDialog } from "../../../../components/superadmin/BackupConfirmDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/superadmin/ui/card";
import { Button } from "../../../../components/superadmin/ui/button";
import { Badge } from "../../../../components/superadmin/ui/badge";
import { Skeleton } from "../../../../components/superadmin/ui/skeleton";
import { EmptyState } from "../../../../components/superadmin/ui/empty-state";
import { ResultAlert } from "../../../../components/superadmin/ui/alert";
import { CopyId } from "../../../../components/superadmin/ui/copy-button";
import { TenantAvatar } from "../../../../components/superadmin/ui/tenant-avatar";
import { Spinner } from "../../../../components/superadmin/ui/spinner";
import {
  backupTypeMeta,
  formatBytes,
  formatDateTime,
} from "../../../../components/superadmin/lib/format";

const roleMeta = {
  admin: { label: "Admin", variant: "default" },
  editor: { label: "Editor", variant: "info" },
  viewer: { label: "Viewer", variant: "secondary" },
};

function TenantDetailContent() {
  const router = useRouter();
  const { tenantId } = router.query;
  const { sessionExpired } = useSuperAdmin();

  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  // Vínculo con punto-de-venta — ver src/lib/server/posIntegrationService.js.
  const [posIntegration, setPosIntegration] = useState(null);
  const [posLoading, setPosLoading] = useState(true);
  const [posWorking, setPosWorking] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null); // solo se ve una vez, tras generarlo

  const { backups, backupsLoading, working, loadBackups, createBackup, runConfirmedAction } =
    useBackups({ setResult });

  const tenant = details?.tenant || null;

  const loadDetails = useCallback(async () => {
    setDetailsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tenant-details?tenantId=${encodeURIComponent(tenantId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setDetails(null);
        if (response.status === 401) {
          sessionExpired();
          return;
        }
        setResult({ tone: "error", title: data?.message || "Error cargando el detalle." });
        return;
      }

      setDetails(data);
    } catch (error) {
      console.error("Error cargando detalle del tenant:", error);
      setResult({ tone: "error", title: `Error cargando el detalle: ${error.message}` });
    } finally {
      setDetailsLoading(false);
    }
  }, [tenantId, sessionExpired]);

  const loadPosIntegration = useCallback(async () => {
    setPosLoading(true);
    try {
      const response = await fetch(`/api/admin/pos-integration?tenantId=${encodeURIComponent(tenantId)}`);
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          sessionExpired();
          return;
        }
        setResult({ tone: "error", title: data?.message || "Error cargando el vínculo de POS." });
        return;
      }
      setPosIntegration(data);
    } catch (error) {
      console.error("Error cargando vínculo de POS:", error);
    } finally {
      setPosLoading(false);
    }
  }, [tenantId, sessionExpired]);

  useEffect(() => {
    if (router.isReady && tenantId) {
      loadDetails();
      loadBackups(tenantId);
      loadPosIntegration();
    }
  }, [router.isReady, tenantId, loadDetails, loadBackups, loadPosIntegration]);

  const runPosAction = async (action) => {
    setPosWorking(true);
    setGeneratedToken(null);
    try {
      const response = await fetch("/api/admin/pos-integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult({ tone: "error", title: data?.message || "No se pudo completar la acción." });
        return;
      }
      if (action === "generate" && data.token) {
        setGeneratedToken(data.token);
      }
      await loadPosIntegration();
    } catch (error) {
      console.error("Error en acción de vínculo POS:", error);
      setResult({ tone: "error", title: `Error: ${error.message}` });
    } finally {
      setPosWorking(false);
    }
  };

  const handleConfirm = (confirmName) =>
    runConfirmedAction(confirmAction, confirmName, {
      onDone: async () => {
        setConfirmAction(null);
        await Promise.all([loadDetails(), loadBackups(tenantId)]);
      },
    });

  return (
    <>
      <div className="sa-rise">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/admin/superadmin/tenants">
            <ArrowLeft className="size-4" />
            Volver al directorio
          </Link>
        </Button>
      </div>

      {result && <ResultAlert result={result} onClose={() => setResult(null)} className="mt-5" />}

      {detailsLoading ? (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-5">
            <Skeleton className="size-16 rounded-3xl" />
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        </div>
      ) : !tenant ? (
        <Card className="sa-rise mt-6">
          <EmptyState
            icon={SearchX}
            title="Tenant no encontrado"
            description="El tenant solicitado no existe o fue eliminado."
            action={
              <Button asChild variant="outline">
                <Link href="/admin/superadmin/tenants">Ir al directorio</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* Encabezado del tenant */}
          <header className="sa-rise mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <TenantAvatar name={tenant.nombreEmpresa} size="lg" />
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
                  <span className="inline-block h-px w-6 bg-brand/60" />
                  Detalle del tenant
                </p>
                <h1 className="mt-2 font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.025em] text-foreground sm:text-[2.4rem]">
                  {tenant.nombreEmpresa}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <CopyId value={tenant.id} className="max-w-[260px]" />
                  <Badge variant="outline">Alta: {formatDateTime(tenant.createdAt)}</Badge>
                </div>
              </div>
            </div>

            <Button variant="brand" onClick={() => createBackup(tenant)} disabled={working}>
              {working && !confirmAction ? (
                <>
                  <Spinner />
                  Creando respaldo
                </>
              ) : (
                <>
                  <DatabaseBackup className="size-4" />
                  Crear copia de seguridad
                </>
              )}
            </Button>
          </header>

          {/* Métricas */}
          <div className="sa-stagger mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Usuarios", value: details.members.length },
              { label: "Documentos", value: details.totalDocs },
              { label: "Colecciones", value: details.collections.length },
              { label: "Respaldos", value: backupsLoading ? "…" : backups.length },
            ].map((metric) => (
              <Card key={metric.label} className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {metric.label}
                </p>
                <p className="mt-2.5 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                  {metric.value}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              {/* Miembros */}
              <Card className="sa-rise overflow-hidden" style={{ animationDelay: "0.16s" }}>
                <CardHeader className="pb-4">
                  <CardTitle>Miembros del tenant</CardTitle>
                  <CardDescription>Usuarios con acceso a esta empresa.</CardDescription>
                </CardHeader>

                {details.members.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Sin usuarios"
                    description="Este tenant no tiene usuarios registrados."
                    className="py-10"
                  />
                ) : (
                  <div className="divide-y divide-border/60 border-t border-border/60">
                    {details.members.map((member) => {
                      const role = roleMeta[member.role] || {
                        label: member.role || "—",
                        variant: "secondary",
                      };

                      return (
                        <div
                          key={member.uid}
                          className="flex flex-col gap-2.5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {member.email || member.uid}
                            </p>
                            <p className="mt-0.5 text-[13px] text-muted-foreground">
                              {member.displayName || "Sin nombre"} · Alta:{" "}
                              {formatDateTime(member.createdAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {member.status && (
                              <Badge variant={member.status === "active" ? "success" : "secondary"}>
                                {member.status === "active" ? "Activo" : member.status}
                              </Badge>
                            )}
                            <Badge variant={role.variant}>{role.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Colecciones */}
              <Card className="sa-rise" style={{ animationDelay: "0.22s" }}>
                <CardHeader className="pb-4">
                  <CardTitle>Colecciones de datos</CardTitle>
                  <CardDescription>
                    Documentos por colección; las marcadas se conservan al limpiar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {details.collections.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">Sin colecciones de datos.</p>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {details.collections.map((collectionInfo) => (
                        <div
                          key={collectionInfo.name}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-accent/40 px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <FolderOpen className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {collectionInfo.name}
                              </p>
                              {collectionInfo.preserved && (
                                <p className="text-[11px] font-medium text-success">
                                  Se conserva al limpiar
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
                            {collectionInfo.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* Respaldos */}
              <Card className="sa-rise overflow-hidden" style={{ animationDelay: "0.2s" }}>
                <CardHeader className="flex-row items-start justify-between pb-4">
                  <div>
                    <CardTitle>Copias de seguridad</CardTitle>
                    <CardDescription className="mt-1">
                      Restaura, descarga o elimina respaldos.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => loadBackups(tenantId)}
                    disabled={backupsLoading}
                    aria-label="Actualizar respaldos"
                  >
                    <RefreshCw className={backupsLoading ? "size-4 animate-spin" : "size-4"} />
                  </Button>
                </CardHeader>

                {backupsLoading ? (
                  <div className="space-y-3 border-t border-border/60 p-6">
                    {[0, 1].map((i) => (
                      <Skeleton key={i} className="h-16 rounded-2xl" />
                    ))}
                  </div>
                ) : backups.length === 0 ? (
                  <EmptyState
                    icon={DatabaseBackup}
                    title="Sin respaldos"
                    description="Crea la primera copia de seguridad para poder restaurar con tranquilidad."
                    className="py-10"
                  />
                ) : (
                  <div className="divide-y divide-border/60 border-t border-border/60">
                    {backups.map((backup) => {
                      const typeMeta = backupTypeMeta[backup.type] || {
                        label: backup.type || "—",
                        variant: "secondary",
                      };

                      return (
                        <div key={backup.id} className="px-6 py-4">
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
                            <p className="mt-1 text-xs text-muted-foreground/80">{backup.note}</p>
                          )}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmAction({ mode: "restore", tenant, backup })}
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
                              onClick={() => setConfirmAction({ mode: "delete", tenant, backup })}
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

              {/* Vínculo con punto de venta */}
              <Card className="sa-rise overflow-hidden" style={{ animationDelay: "0.23s" }}>
                <CardHeader className="flex-row items-start justify-between gap-3 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="size-4 text-muted-foreground" strokeWidth={1.8} />
                      Punto de venta
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Refleja las ventas cobradas como Entradas automáticas.
                    </CardDescription>
                  </div>
                  {!posLoading && (
                    <Badge variant={posIntegration?.enabled ? "success" : "secondary"}>
                      {posIntegration?.enabled ? "Vinculado" : "Sin vincular"}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {posLoading ? (
                    <Skeleton className="h-16 rounded-2xl" />
                  ) : (
                    <>
                      {generatedToken && (
                        <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand/5 p-4">
                          <p className="text-sm font-semibold text-foreground">
                            Token generado — cópialo ahora
                          </p>
                          <p className="text-xs text-muted-foreground">
                            No se vuelve a mostrar. Pégalo en Torre de Control, del lado de
                            punto-de-venta, para completar el vínculo.
                          </p>
                          <CopyId value={generatedToken} className="w-full" />
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground">
                        {posIntegration?.hasToken
                          ? `Token generado${posIntegration.linkedAt ? " · " + formatDateTime(posIntegration.linkedAt) : ""}.`
                          : "Todavía no se ha generado un token para este tenant."}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => runPosAction("generate")}
                          disabled={posWorking}
                        >
                          <KeyRound className="size-3.5" />
                          {posIntegration?.hasToken ? "Regenerar token" : "Generar token"}
                        </Button>
                        {posIntegration?.hasToken && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runPosAction(posIntegration.enabled ? "disable" : "enable")}
                            disabled={posWorking}
                          >
                            {posIntegration.enabled ? "Desactivar" : "Activar"}
                          </Button>
                        )}
                        {posIntegration?.hasToken && (
                          <Button
                            variant="destructive-outline"
                            size="sm"
                            onClick={() => runPosAction("revoke")}
                            disabled={posWorking}
                          >
                            <ShieldOff className="size-3.5" />
                            Revocar
                          </Button>
                        )}
                      </div>

                      {posIntegration?.hasToken && !posIntegration?.conceptId && (
                        <p className="text-xs text-amber-600">
                          Falta activarse desde Torre de Control para crear el concepto y los
                          subconceptos de Ventas POS.
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Zona de riesgo */}
              <Card className="sa-rise border-destructive/25" style={{ animationDelay: "0.26s" }}>
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
                    <span className="font-semibold text-foreground">{tenant.nombreEmpresa}</span>{" "}
                    dejando únicamente los usuarios. Antes del borrado se genera una copia de
                    seguridad automática en Firebase.
                  </p>
                  <Button
                    variant="destructive"
                    className="mt-5 w-full"
                    onClick={() => setConfirmAction({ mode: "wipe", tenant })}
                    disabled={working}
                  >
                    <Trash2 className="size-4" />
                    Limpiar datos del tenant
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      <BackupConfirmDialog
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        working={working}
      />
    </>
  );
}

export default function TenantDetailPage() {
  return (
    <SuperAdminLayout title="Detalle del tenant">
      <TenantDetailContent />
    </SuperAdminLayout>
  );
}
