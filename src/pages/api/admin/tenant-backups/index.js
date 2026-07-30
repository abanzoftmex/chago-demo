/**
 * API de respaldos por tenant (protegida por la sesión de setup).
 * GET    -> lista respaldos (query opcional: tenantId)
 * POST   -> crea un respaldo manual { tenantId, note? }
 * DELETE -> elimina un respaldo { backupId }
 */

import { assertAdminInitialized } from "../../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../../lib/server/setupSession";
import {
  BackupError,
  createBackup,
  deleteBackup,
  listBackups,
  logTenantActivity,
} from "../../../../lib/server/tenantBackupService";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;

  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  try {
    if (req.method === "GET") {
      const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
      const backups = await listBackups(tenantId);
      return res.status(200).json({ backups });
    }

    if (req.method === "POST") {
      const { tenantId, note } = req.body || {};
      const result = await createBackup(tenantId, {
        type: "manual",
        note: typeof note === "string" && note.trim() ? note.trim() : null,
      });

      await logTenantActivity(tenantId, {
        type: "tenant_backup_created",
        backupId: result.backupId,
        totalDocs: result.totalDocs,
      });

      return res.status(200).json({
        message: "Copia de seguridad creada correctamente",
        backup: result,
      });
    }

    if (req.method === "DELETE") {
      const backupId = req.body?.backupId || req.query?.backupId;
      const result = await deleteBackup(backupId);
      return res.status(200).json({
        message: "Respaldo eliminado correctamente",
        ...result,
      });
    }

    return res.status(405).json({ message: "Método no permitido" });
  } catch (error) {
    console.error("❌ Error en tenant-backups:", error);

    if (error instanceof BackupError) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
