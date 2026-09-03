/**
 * La puerta de las rutas que sirven datos de UN tenant a su propia gente.
 *
 * Son dos comprobaciones y las dos hacen falta:
 *   1. El token de Firebase del usuario, verificado aquí. Dice QUIÉN pregunta.
 *   2. Que ese quien sea miembro ACTIVO del tenant que pide. Sin esto, un
 *      usuario legítimo de un tenant podría leerse los datos de otro
 *      simplemente cambiando el `tenantId` de la petición.
 *
 * Lo segundo importa especialmente en rutas que usan Admin SDK: como no pasan
 * por `firestore.rules`, la única barrera es la que ponga la propia ruta.
 *
 * Devuelve `{ ok: true, uid }` o `{ ok: false, status, error }` para que el
 * llamador responda; no escribe en `res` por su cuenta.
 */

import admin from "../firebase/firebaseAdmin";

export async function requireTenantMember(req, tenantId) {
  if (!tenantId || typeof tenantId !== "string") {
    return { ok: false, status: 400, error: "tenantId es requerido" };
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Token de autenticación requerido" };
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(header.slice("Bearer ".length).trim());
  } catch {
    return { ok: false, status: 401, error: "Token inválido" };
  }

  const member = await admin
    .firestore()
    .collection(`tenants/${tenantId}/members`)
    .doc(decoded.uid)
    .get();

  if (!member.exists || member.data()?.status !== "active") {
    return { ok: false, status: 403, error: "No perteneces a este tenant" };
  }

  return { ok: true, uid: decoded.uid, role: member.data()?.role };
}
