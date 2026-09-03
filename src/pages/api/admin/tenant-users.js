/**
 * GET /api/admin/tenant-users?tenantId=...
 *
 * Los usuarios de un tenant: sus miembros, cada uno con los datos de perfil
 * que viven en la colección raíz `/users`.
 *
 * Existe porque el navegador solo puede leer SU PROPIO documento de `/users`
 * —y así debe ser: nadie tiene por qué poder leer el perfil de otro a voluntad
 * desde el cliente—. La pantalla de usuarios necesitaba el de todos los
 * miembros, y lo hacía uno por uno desde el navegador; funcionaba solo porque
 * las reglas publicadas están abiertas.
 *
 * La puerta es doble, y las dos hacen falta:
 *   1. El token de Firebase del usuario, verificado aquí. Dice QUIÉN pregunta.
 *   2. Que ese quien sea miembro ACTIVO del tenant que pide. Sin esto, un
 *      usuario legítimo de un tenant podría leerse el directorio de otro
 *      simplemente cambiando el `tenantId` de la petición.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, error: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const { tenantId } = req.query;
  if (!tenantId || typeof tenantId !== "string") {
    return res.status(400).json({ success: false, error: "tenantId es requerido" });
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Token de autenticación requerido" });
  }

  let caller;
  try {
    caller = await admin.auth().verifyIdToken(header.slice("Bearer ".length).trim());
  } catch {
    return res.status(401).json({ success: false, error: "Token inválido" });
  }

  try {
    const db = admin.firestore();

    const callerMember = await db.collection(`tenants/${tenantId}/members`).doc(caller.uid).get();
    if (!callerMember.exists || callerMember.data()?.status !== "active") {
      return res.status(403).json({ success: false, error: "No perteneces a este tenant" });
    }

    const membersSnap = await db.collection(`tenants/${tenantId}/members`).get();
    const users = [];

    for (const memberDoc of membersSnap.docs) {
      const memberData = memberDoc.data();
      const userSnap = await db.collection("users").doc(memberDoc.id).get();

      // Un miembro sin documento de perfil no puede dejar fuera al resto: se
      // devuelve con lo que hay en el propio miembro.
      users.push({
        id: memberDoc.id,
        ...(userSnap.exists ? userSnap.data() : {}),
        email: (userSnap.exists ? userSnap.data().email : null) || memberData.email || null,
        displayName:
          (userSnap.exists ? userSnap.data().displayName : null) || memberData.displayName || null,
        tenantRole: memberData.role,
        tenantStatus: memberData.status,
      });
    }

    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error obteniendo los usuarios del tenant:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
