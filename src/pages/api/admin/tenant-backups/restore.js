/**
 * Restauración de un respaldo de tenant (protegida por la sesión de setup).
 * POST { backupId, confirmName }
 *
 * Antes de restaurar se crea una copia de seguridad del estado actual
 * (tipo "pre-restore") para poder volver atrás. La restauración reemplaza
 * los datos actuales por los del respaldo, conservando los usuarios
 * actuales y el documento raíz del tenant.
 */

import admin, { assertAdminInitialized } from "../../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../../lib/server/setupSession";
import {
  BackupError,
  createBackup,
  logTenantActivity,
  restoreBackup,
} from "../../../../lib/server/tenantBackupService";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;

  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  try {
    const { backupId, confirmName } = req.body || {};

    if (!backupId) {
      return res.status(400).json({ message: "El respaldo es requerido" });
    }

    const metaSnap = await admin.firestore().collection("tenantBackups").doc(backupId).get();

    if (!metaSnap.exists) {
      return res.status(404).json({ message: "Respaldo no encontrado" });
    }

    const tenantId = metaSnap.data().tenantId;
    const tenantSnap = await admin.firestore().collection("tenants").doc(tenantId).get();

    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "El tenant del respaldo ya no existe" });
    }

    const nombreEmpresa = tenantSnap.data().nombreEmpresa || "";

    if (!confirmName || confirmName.trim() !== nombreEmpresa.trim()) {
      return res.status(400).json({
        message: "El nombre de confirmación no coincide con el nombre de la empresa",
      });
    }

    let safetyBackup;
    try {
      safetyBackup = await createBackup(tenantId, {
        type: "pre-restore",
        note: `Estado previo a restaurar el respaldo ${backupId}`,
      });
    } catch (backupError) {
      console.error("❌ Error creando respaldo pre-restauración:", backupError);
      return res.status(500).json({
        message:
          "No se pudo crear la copia de seguridad del estado actual. No se restauró ningún dato.",
        error: backupError.message,
      });
    }

    const result = await restoreBackup(backupId);

    await logTenantActivity(tenantId, {
      type: "tenant_data_restored",
      backupId,
      safetyBackupId: safetyBackup.backupId,
      restoredDocs: result.restoredDocs,
      restoredCollections: result.restoredCollections,
    });

    return res.status(200).json({
      message: "Respaldo restaurado correctamente. Los usuarios actuales se conservaron.",
      safetyBackup,
      ...result,
    });
  } catch (error) {
    console.error("❌ Error en tenant-backups/restore:", error);

    if (error instanceof BackupError) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
