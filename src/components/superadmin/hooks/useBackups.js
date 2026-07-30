"use client";

import { useCallback, useState } from "react";
import { useSuperAdmin } from "../SuperAdminContext";
import { formatBytes } from "../lib/format";

/**
 * Estado y operaciones de respaldos para un tenant.
 * Centraliza fetch/create/restore/delete/wipe y el manejo de 401.
 * `setResult` recibe { tone, title, lines } para el ResultAlert de la página.
 */
export function useBackups({ setResult }) {
  const { sessionExpired } = useSuperAdmin();

  const [backups, setBackups] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const apiError = useCallback(
    (response, data) => {
      if (response.status === 401) {
        sessionExpired();
        return "La sesión de configuración expiró.";
      }
      return data?.message || "Error inesperado en la operación de respaldo.";
    },
    [sessionExpired]
  );

  const loadBackups = useCallback(
    async (tenantId) => {
      if (!tenantId) {
        setBackups([]);
        return;
      }

      setBackupsLoading(true);
      try {
        const response = await fetch(
          `/api/admin/tenant-backups?tenantId=${encodeURIComponent(tenantId)}`
        );
        const data = await response.json();

        if (!response.ok) {
          setBackups([]);
          setResult({ tone: "error", title: apiError(response, data) });
          return;
        }

        setBackups(data.backups || []);
      } catch (error) {
        console.error("Error cargando respaldos:", error);
        setResult({ tone: "error", title: `Error cargando respaldos: ${error.message}` });
      } finally {
        setBackupsLoading(false);
      }
    },
    [apiError, setResult]
  );

  const createBackup = useCallback(
    async (tenant) => {
      if (!tenant) return;

      setWorking(true);
      setResult(null);

      try {
        const response = await fetch("/api/admin/tenant-backups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId: tenant.id }),
        });

        const data = await response.json();

        if (!response.ok) {
          setResult({ tone: "error", title: apiError(response, data) });
          return;
        }

        setResult({
          tone: "success",
          title: `Copia de seguridad creada para ${tenant.nombreEmpresa}.`,
          lines: [
            `Documentos respaldados: ${data.backup.totalDocs}`,
            `Tamaño: ${formatBytes(data.backup.sizeBytes)}`,
          ],
        });
        await loadBackups(tenant.id);
      } catch (error) {
        setResult({
          tone: "error",
          title: `Error de conexión al crear el respaldo: ${error.message}`,
        });
      } finally {
        setWorking(false);
      }
    },
    [apiError, loadBackups, setResult]
  );

  /**
   * Ejecuta la acción confirmada del BackupConfirmDialog.
   * `action`: { mode, tenant, backup? } — devuelve { success } o { error }.
   */
  const runConfirmedAction = useCallback(
    async (action, confirmName, { onDone } = {}) => {
      const tenant = action?.tenant;
      if (!action || !tenant) return { error: "Operación inválida." };

      setWorking(true);

      try {
        let response;

        if (action.mode === "wipe") {
          response = await fetch("/api/admin/tenant-backups/wipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: tenant.id, confirmName }),
          });
        } else if (action.mode === "restore") {
          response = await fetch("/api/admin/tenant-backups/restore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ backupId: action.backup.id, confirmName }),
          });
        } else {
          response = await fetch("/api/admin/tenant-backups", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ backupId: action.backup.id }),
          });
        }

        const data = await response.json();

        if (!response.ok) {
          return { error: apiError(response, data) };
        }

        if (action.mode === "wipe") {
          setResult({
            tone: "success",
            title: `Datos de ${tenant.nombreEmpresa} eliminados.`,
            lines: [
              `Documentos eliminados: ${data.deletedDocs}`,
              `Copia de seguridad previa: ${data.backup.backupId} (${data.backup.totalDocs} documentos)`,
              "Los usuarios se conservaron.",
            ],
          });
        } else if (action.mode === "restore") {
          setResult({
            tone: "success",
            title: `Respaldo restaurado en ${tenant.nombreEmpresa}.`,
            lines: [
              `Documentos restaurados: ${data.restoredDocs}`,
              `Copia del estado previo: ${data.safetyBackup.backupId}`,
              "Los usuarios actuales se conservaron.",
            ],
          });
        } else {
          setResult({ tone: "success", title: "Respaldo eliminado correctamente." });
        }

        await onDone?.(action);
        return { success: true };
      } catch (error) {
        return { error: `Error de conexión: ${error.message}` };
      } finally {
        setWorking(false);
      }
    },
    [apiError, setResult]
  );

  return {
    backups,
    backupsLoading,
    working,
    loadBackups,
    createBackup,
    runConfirmedAction,
  };
}
