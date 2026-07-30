/**
 * Detalle de un tenant (protegido por la sesión de setup).
 * GET ?tenantId=...
 *
 * Devuelve la información del tenant, sus usuarios (members) y el conteo
 * de documentos por colección, todo con el Admin SDK.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";
import { PRESERVED_COLLECTIONS } from "../../../lib/server/tenantBackupService";

export const config = { maxDuration: 60 };

const toIso = (timestamp) => timestamp?.toDate?.()?.toISOString() || null;

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
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== "string") {
      return res.status(400).json({ message: "El tenant es requerido" });
    }

    const tenantRef = admin.firestore().collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const tenantData = tenantSnap.data();

    const collectionRefs = await tenantRef.listCollections();
    const collections = [];

    for (const collectionRef of collectionRefs) {
      const countSnap = await collectionRef.count().get();
      collections.push({
        name: collectionRef.id,
        count: countSnap.data().count,
        preserved: PRESERVED_COLLECTIONS.includes(collectionRef.id),
      });
    }

    collections.sort((a, b) => a.name.localeCompare(b.name));

    const membersSnap = await tenantRef.collection("members").get();
    const members = membersSnap.docs.map((memberDoc) => {
      const memberData = memberDoc.data();
      return {
        uid: memberDoc.id,
        email: memberData.email || null,
        displayName: memberData.displayName || null,
        role: memberData.role || null,
        status: memberData.status || null,
        createdAt: toIso(memberData.createdAt),
      };
    });

    members.sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (b.role === "admin" && a.role !== "admin") return 1;
      return (a.email || "").localeCompare(b.email || "");
    });

    const totalDocs = collections.reduce((sum, item) => sum + item.count, 0);

    return res.status(200).json({
      tenant: {
        id: tenantId,
        nombreEmpresa: tenantData.nombreEmpresa || "Sin nombre",
        ownerUid: tenantData.ownerUid || null,
        createdAt: toIso(tenantData.createdAt),
        updatedAt: toIso(tenantData.updatedAt),
      },
      members,
      collections,
      totalDocs,
    });
  } catch (error) {
    console.error("❌ Error en tenant-details:", error);
    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
