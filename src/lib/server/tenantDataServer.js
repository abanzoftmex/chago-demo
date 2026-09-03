/**
 * Lecturas de los datos de un tenant desde el SERVIDOR, con Admin SDK.
 *
 * Las rutas que resumen o analizan datos —el asistente de IA, por ejemplo—
 * llamaban a los servicios del navegador, que llegan a Firestore sin identidad
 * de Firebase: en cuanto se desplieguen las reglas, esas lecturas quedarían
 * denegadas y el asistente respondería sobre un conjunto vacío.
 *
 * Quien use esto tiene que poner su propia puerta (ver `requireTenantMember`):
 * el Admin SDK no pasa por las reglas, así que aquí no hay red de seguridad.
 */

import admin from "../firebase/firebaseAdmin";

const db = () => admin.firestore();

/** Los documentos de una colección del tenant, solo los activos. */
async function listActive(tenantId, coleccion) {
  const snap = await db().collection(`tenants/${tenantId}/${coleccion}`).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    // `isActive` ausente cuenta como activo: los documentos anteriores a que
    // ese campo existiera no deben desaparecer de los listados.
    .filter((d) => d.isActive !== false);
}

export const listConcepts = (tenantId) => listActive(tenantId, "concepts");
export const listSubconcepts = (tenantId) => listActive(tenantId, "subconcepts");
export const listGenerals = (tenantId) => listActive(tenantId, "generals");
export const listProviders = (tenantId) => listActive(tenantId, "proveedores");

/**
 * Transacciones del tenant, de la más reciente hacia atrás.
 *
 * Excluye las ANULADAS, igual que `transactionService`: dejaron de ser un
 * ingreso o un gasto en el momento en que se anularon, y un resumen que las
 * contara daría cifras que no cuadran con las que ve el usuario en pantalla.
 */
export async function listTransactions(tenantId, { limit } = {}) {
  let query = db().collection(`tenants/${tenantId}/transacciones`).orderBy("createdAt", "desc");
  if (limit) query = query.limit(limit);

  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.voided !== true);
}
