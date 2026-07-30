/**
 * Descarga del archivo JSON de un respaldo (protegida por la sesión de setup).
 * GET ?backupId=...
 * Funciona tanto para respaldos guardados en Storage como en Firestore.
 */

import { assertAdminInitialized } from "../../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../../lib/server/setupSession";
import {
  BackupError,
  getBackupFileBuffer,
} from "../../../../lib/server/tenantBackupService";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;

  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  try {
    const { backupId } = req.query;

    if (!backupId || typeof backupId !== "string") {
      return res.status(400).json({ message: "El respaldo es requerido" });
    }

    const { meta, jsonBuffer } = await getBackupFileBuffer(backupId);

    const dateSuffix = meta.createdAt?.toDate?.()?.toISOString?.().slice(0, 10) || "backup";
    const fileName = `respaldo-${meta.tenantId}-${dateSuffix}-${backupId}.json`;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.status(200).send(jsonBuffer);
  } catch (error) {
    console.error("❌ Error en tenant-backups/download:", error);

    if (error instanceof BackupError) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
