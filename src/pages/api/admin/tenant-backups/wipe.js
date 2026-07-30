/**
 * Limpieza de datos de un tenant (protegida por la sesión de setup).
 * POST { tenantId, confirmName }
 *
 * Antes de borrar nada se crea una copia de seguridad completa (tipo
 * "pre-wipe"). Si el respaldo falla, no se elimina ningún dato.
 * Se eliminan todas las subcolecciones del tenant excepto los usuarios
 * (members); el documento raíz del tenant se conserva.
 */

import admin, { assertAdminInitialized } from "../../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../../lib/server/setupSession";
import {
  BackupError,
  createBackup,
  logTenantActivity,
  wipeTenantData,
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
    const { tenantId, confirmName } = req.body || {};

    if (!tenantId) {
      return res.status(400).json({ message: "El tenant es requerido" });
    }

    const tenantSnap = await admin.firestore().collection("tenants").doc(tenantId).get();

    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const nombreEmpresa = tenantSnap.data().nombreEmpresa || "";

    if (!confirmName || confirmName.trim() !== nombreEmpresa.trim()) {
      return res.status(400).json({
        message: "El nombre de confirmación no coincide con el nombre de la empresa",
      });
    }

    let backup;
    try {
      backup = await createBackup(tenantId, { type: "pre-wipe" });
    } catch (backupError) {
      console.error("❌ Error creando respaldo pre-limpieza:", backupError);
      return res.status(500).json({
        message:
          "No se pudo crear la copia de seguridad previa. No se eliminó ningún dato.",
        error: backupError.message,
      });
    }

    const result = await wipeTenantData(tenantId);

    await logTenantActivity(tenantId, {
      type: "tenant_data_wiped",
      backupId: backup.backupId,
      deletedDocs: result.deletedDocs,
      deletedCollections: result.deletedCollections,
    });

    return res.status(200).json({
      message: "Datos del tenant eliminados correctamente. Los usuarios se conservaron.",
      backup,
      ...result,
    });
  } catch (error) {
    console.error("❌ Error en tenant-backups/wipe:", error);

    if (error instanceof BackupError) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
