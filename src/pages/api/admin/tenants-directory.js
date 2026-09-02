/**
 * GET /api/admin/tenants-directory
 *
 * El directorio de tenants que ve el superadmin, con el admin de cada uno.
 *
 * Existe porque el navegador NO puede listar `/tenants`: el superadmin se
 * autentica con una cookie de contraseña, no con Firebase Auth, así que
 * `request.auth` es null y ninguna regla de Firestore puede autorizarlo. Antes
 * funcionaba solo porque las reglas publicadas están abiertas de par en par.
 *
 * Aquí se resuelve con Admin SDK —que no pasa por las reglas— detrás de la
 * misma cookie de sesión de configuración que protege el resto de rutas de
 * superadmin.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;
  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  try {
    const db = admin.firestore();
    const tenantsSnap = await db.collection("tenants").get();
    const tenants = [];

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantData = tenantDoc.data();

      let adminEmail = "—";
      let adminName = "—";
      let adminUid = tenantData.ownerUid || "";

      try {
        const membersSnap = await db.collection(`tenants/${tenantDoc.id}/members`).get();
        const adminMember = membersSnap.docs.find((member) => member.data().role === "admin");
        if (adminMember) {
          const memberData = adminMember.data();
          adminUid = adminMember.id;
          adminEmail = memberData.email || "—";
          adminName = memberData.displayName || memberData.email || "—";
        }
      } catch (err) {
        // Un tenant sin miembros legibles no puede dejar fuera al resto.
        console.error(`Error obteniendo miembros de ${tenantDoc.id}:`, err.message);
      }

      tenants.push({
        id: tenantDoc.id,
        ownerUid: adminUid,
        nombreEmpresa: tenantData.nombreEmpresa || "Sin nombre",
        adminEmail,
        adminName,
        // ISO porque JSON no lleva Date; el cliente lo reconstruye.
        createdAt: tenantData.createdAt?.toDate?.()?.toISOString() || null,
      });
    }

    tenants.sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return res.status(200).json({ tenants });
  } catch (error) {
    console.error("Error cargando el directorio de tenants:", error);
    return res.status(500).json({ message: "Error cargando tenants", error: error.message });
  }
}
