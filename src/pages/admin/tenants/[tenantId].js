/**
 * Página de detalle de un tenant.
 * Muestra información general, usuarios, colecciones de datos y respaldos,
 * con acciones de copia de seguridad, restauración y limpieza.
 * Protegida por la sesión de setup: redirige al panel si no hay sesión.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  BackupConfirmModal,
  backupTypeLabels,
  buttonBaseClassName,
  cardClassName,
  formatBytes,
  formatDateTime,
  getTenantInitials,
  Spinner,
} from "../../../components/admin/setupShared";

const roleLabels = {
  admin: { label: "Admin", className: "bg-slate-950 text-white" },
  editor: { label: "Editor", className: "bg-sky-100 text-sky-700" },
  viewer: { label: "Viewer", className: "bg-slate-100 text-slate-600" },
};

export default function TenantDetailPage() {
  const router = useRouter();
  const { tenantId } = router.query;

  const [authorized, setAuthorized] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const messageTone = message ? (message.startsWith("OK:") ? "success" : "error") : null;
  const tenant = details?.tenant || null;

  const redirectToSetup = () => {
    router.replace("/admin/multi-tenant-setup");
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/setup-session");
        const data = await response.json();

        if (data.authorized) {
          setAuthorized(true);
        } else {
          redirectToSetup();
        }
      } catch (error) {
        console.error("Error validando sesión de setup:", error);
        redirectToSetup();
      }
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authorized && router.isReady && tenantId) {
      loadDetails();
      loadBackups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, router.isReady, tenantId]);

  const handleApiError = (response, data) => {
    if (response.status === 401) {
      redirectToSetup();
      return "La sesión de configuración expiró.";
    }
    return data?.message || "Error inesperado.";
  };

  const loadDetails = async () => {
    setDetailsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tenant-details?tenantId=${encodeURIComponent(tenantId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setDetails(null);
        setMessage(`ERROR: ${handleApiError(response, data)}`);
        return;
      }

      setDetails(data);
    } catch (error) {
      console.error("Error cargando detalle del tenant:", error);
      setMessage(`ERROR: Error cargando el detalle del tenant: ${error.message}`);
    } finally {
      setDetailsLoading(false);
    }
  };

  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/tenant-backups?tenantId=${encodeURIComponent(tenantId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setBackups([]);
        setMessage(`ERROR: ${handleApiError(response, data)}`);
        return;
      }

      setBackups(data.backups || []);
    } catch (error) {
      console.error("Error cargando respaldos:", error);
      setMessage(`ERROR: Error cargando respaldos: ${error.message}`);
    } finally {
      setBackupsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!tenant) return;

    setWorking(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/tenant-backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(`ERROR: ${handleApiError(response, data)}`);
        return;
      }

      setMessage(
        `OK: Copia de seguridad creada.\nDocumentos respaldados: ${data.backup.totalDocs}\nTamaño: ${formatBytes(data.backup.sizeBytes)}`
      );
      await loadBackups();
    } catch (error) {
      setMessage(`ERROR: Error de conexión al crear el respaldo: ${error.message}`);
    } finally {
      setWorking(false);
    }
  };

  const handleConfirmAction = async (confirmName) => {
    if (!confirmAction || !tenant) return { error: "Operación inválida." };

    setWorking(true);

    try {
      let response;

      if (confirmAction.mode === "wipe") {
        response = await fetch("/api/admin/tenant-backups/wipe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: tenant.id, confirmName }),
        });
      } else if (confirmAction.mode === "restore") {
        response = await fetch("/api/admin/tenant-backups/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupId: confirmAction.backup.id, confirmName }),
        });
      } else {
        response = await fetch("/api/admin/tenant-backups", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ backupId: confirmAction.backup.id }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        return { error: handleApiError(response, data) };
      }

      if (confirmAction.mode === "wipe") {
        setMessage(
          `OK: Datos del tenant eliminados.\nDocumentos eliminados: ${data.deletedDocs}\nCopia de seguridad previa: ${data.backup.backupId} (${data.backup.totalDocs} documentos)\nLos usuarios se conservaron.`
        );
      } else if (confirmAction.mode === "restore") {
        setMessage(
          `OK: Respaldo restaurado.\nDocumentos restaurados: ${data.restoredDocs}\nCopia del estado previo: ${data.safetyBackup.backupId}\nLos usuarios actuales se conservaron.`
        );
      } else {
        setMessage("OK: Respaldo eliminado correctamente.");
      }

      setConfirmAction(null);
      await Promise.all([loadDetails(), loadBackups()]);
      return { success: true };
    } catch (error) {
      return { error: `Error de conexión: ${error.message}` };
    } finally {
      setWorking(false);
    }
  };

  if (!authorized) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#f5f1ea] px-4 py-10 text-slate-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.14),_transparent_26%)]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
          <div className={`${cardClassName} flex items-center gap-4 px-6 py-5 text-slate-600`}>
            <Spinner size="h-5 w-5" />
            Validando sesion de configuracion...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>
          {tenant ? `${tenant.nombreEmpresa} | Detalle del tenant` : "Detalle del tenant"}
        </title>
      </Head>

      <div className="relative min-h-screen overflow-hidden bg-[#f6f3ee] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.10),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.10),_transparent_22%)]" />
        <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0))]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="mb-6">
            <Link
              href="/admin/multi-tenant-setup"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur-xl transition hover:bg-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M19 12H5m6-7l-7 7 7 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Volver al panel
            </Link>
          </div>

          {message && (
            <div
              className={`mb-6 rounded-[28px] border px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl ${
                messageTone === "success"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
                  : "border-rose-200 bg-rose-50/90 text-rose-900"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="pr-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">
                    {messageTone === "success" ? "Operacion exitosa" : "Atencion"}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6">
                    {message.replace(/^OK:\s?/, "").replace(/^ERROR:\s?/, "")}
                  </pre>
                </div>
                <button
                  onClick={() => setMessage("")}
                  className="self-start rounded-xl border border-current/15 px-3 py-2 text-sm font-medium hover:bg-white/40"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {detailsLoading && (
            <div className={`${cardClassName} flex items-center gap-4 px-6 py-8 text-slate-600`}>
              <Spinner size="h-6 w-6" />
              Cargando detalle del tenant...
            </div>
          )}

          {!detailsLoading && !tenant && (
            <div className={`${cardClassName} px-6 py-16 text-center`}>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Tenant no encontrado
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                El tenant solicitado no existe o fue eliminado.
              </p>
            </div>
          )}

          {!detailsLoading && tenant && (
            <>
              <header className={`${cardClassName} mb-6 p-6 sm:p-8`}>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-lg font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
                      {getTenantInitials(tenant.nombreEmpresa)}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Detalle del tenant
                      </p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                        {tenant.nombreEmpresa}
                      </h1>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <code className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                          {tenant.id}
                        </code>
                        <span>Alta: {formatDateTime(tenant.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleCreateBackup}
                    disabled={working}
                    className={`${buttonBaseClassName} bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800`}
                  >
                    {working && !confirmAction ? (
                      <>
                        <Spinner light />
                        Creando respaldo
                      </>
                    ) : (
                      "Crear copia de seguridad"
                    )}
                  </button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Usuarios", value: details.members.length },
                    { label: "Documentos", value: details.totalDocs },
                    { label: "Colecciones", value: details.collections.length },
                    { label: "Respaldos", value: backupsLoading ? "…" : backups.length },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        {metric.label}
                      </p>
                      <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </header>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <section className={`${cardClassName} overflow-hidden`}>
                    <div className="border-b border-slate-200/80 px-6 py-5 sm:px-8">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Usuarios
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                        Miembros del tenant
                      </h3>
                    </div>

                    {details.members.length === 0 ? (
                      <p className="px-6 py-10 text-center text-sm text-slate-500 sm:px-8">
                        Este tenant no tiene usuarios registrados.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200/80">
                        {details.members.map((member) => {
                          const roleInfo = roleLabels[member.role] || {
                            label: member.role || "—",
                            className: "bg-slate-100 text-slate-600",
                          };

                          return (
                            <div
                              key={member.uid}
                              className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-slate-950">
                                  {member.email || member.uid}
                                </p>
                                <p className="mt-1 text-sm text-slate-500">
                                  {member.displayName || "Sin nombre"} · Alta:{" "}
                                  {formatDateTime(member.createdAt)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {member.status && (
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${
                                      member.status === "active"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {member.status}
                                  </span>
                                )}
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${roleInfo.className}`}
                                >
                                  {roleInfo.label}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className={`${cardClassName} overflow-hidden`}>
                    <div className="border-b border-slate-200/80 px-6 py-5 sm:px-8">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Datos</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                        Colecciones del tenant
                      </h3>
                    </div>

                    <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 sm:px-8">
                      {details.collections.map((collectionInfo) => (
                        <div
                          key={collectionInfo.name}
                          className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{collectionInfo.name}</p>
                            {collectionInfo.preserved && (
                              <p className="mt-0.5 text-xs text-emerald-600">
                                Se conserva al limpiar
                              </p>
                            )}
                          </div>
                          <span className="text-lg font-semibold tracking-[-0.04em] text-slate-950">
                            {collectionInfo.count}
                          </span>
                        </div>
                      ))}
                      {details.collections.length === 0 && (
                        <p className="text-sm text-slate-500">Sin colecciones de datos.</p>
                      )}
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <section className={`${cardClassName} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 sm:px-8">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          Respaldos
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                          Copias de seguridad
                        </h3>
                      </div>
                      <button
                        onClick={loadBackups}
                        disabled={backupsLoading}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {backupsLoading ? <Spinner /> : "Actualizar"}
                      </button>
                    </div>

                    {backupsLoading && (
                      <div className="flex items-center justify-center px-6 py-12">
                        <Spinner size="h-6 w-6" />
                      </div>
                    )}

                    {!backupsLoading && backups.length === 0 && (
                      <p className="px-6 py-10 text-center text-sm text-slate-500 sm:px-8">
                        Sin respaldos para este tenant.
                      </p>
                    )}

                    {!backupsLoading && backups.length > 0 && (
                      <div className="divide-y divide-slate-200/80">
                        {backups.map((backup) => {
                          const typeInfo = backupTypeLabels[backup.type] || {
                            label: backup.type || "—",
                            className: "bg-slate-100 text-slate-600",
                          };

                          return (
                            <div key={backup.id} className="px-6 py-4 sm:px-8">
                              <div className="flex flex-wrap items-center gap-3">
                                <p className="font-medium text-slate-950">
                                  {formatDateTime(backup.createdAt)}
                                </p>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${typeInfo.className}`}
                                >
                                  {typeInfo.label}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-500">
                                {backup.totalDocs ?? "—"} documentos ·{" "}
                                {formatBytes(backup.sizeBytes)}
                              </p>
                              {backup.note && (
                                <p className="mt-1 text-xs text-slate-400">{backup.note}</p>
                              )}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => setConfirmAction({ mode: "restore", backup })}
                                  disabled={working}
                                  className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                >
                                  Restaurar
                                </button>
                                <a
                                  href={`/api/admin/tenant-backups/download?backupId=${backup.id}`}
                                  className="rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                >
                                  Descargar
                                </a>
                                <button
                                  onClick={() => setConfirmAction({ mode: "delete", backup })}
                                  disabled={working}
                                  className="rounded-2xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className={`${cardClassName} border-rose-200/70 p-6`}>
                    <p className="text-xs uppercase tracking-[0.22em] text-rose-400">
                      Zona de riesgo
                    </p>
                    <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                      Limpiar datos del tenant
                    </h4>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Elimina todos los datos de{" "}
                      <span className="font-medium text-slate-900">{tenant.nombreEmpresa}</span>{" "}
                      dejando únicamente los usuarios. Antes del borrado se genera una copia de
                      seguridad automática en Firebase.
                    </p>
                    <button
                      onClick={() => setConfirmAction({ mode: "wipe" })}
                      disabled={working}
                      className={`${buttonBaseClassName} mt-6 w-full bg-rose-600 text-white shadow-[0_16px_30px_rgba(190,18,60,0.25)] hover:bg-rose-500`}
                    >
                      Limpiar datos del tenant
                    </button>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmAction && tenant && (
        <BackupConfirmModal
          mode={confirmAction.mode}
          tenant={tenant}
          backup={confirmAction.backup || null}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmAction}
          working={working}
        />
      )}
    </>
  );
}
