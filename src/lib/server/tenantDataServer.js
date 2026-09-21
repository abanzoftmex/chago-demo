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
/**
 * Transacciones de un tenant, por rango de fechas o por volumen.
 *
 * Con `startDate`/`endDate` el corte es contable: se traen TODAS las del
 * periodo y no se aplica limite. Sin rango —consultas historicas— se cae al
 * limite por volumen, ordenando por fecha de captura.
 *
 * El limite a secas no sirve para responder "cuanto llevo este mes": recorta
 * por orden de captura, sin relacion con el periodo, y una salida de marzo
 * registrada ayer cuenta como reciente.
 *
 * @returns {Promise<{transactions: Array, truncated: boolean}>}
 */
export async function listTransactions(tenantId, { limit, startDate, endDate } = {}) {
  const col = db().collection(`tenants/${tenantId}/transacciones`);

  const porRango = Boolean(startDate && endDate);
  let query = porRango
    ? col.where("date", ">=", startDate).where("date", "<=", endDate).orderBy("date", "desc")
    : col.orderBy("createdAt", "desc");

  if (!porRango && limit) query = query.limit(limit);

  const snap = await query.get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    transactions: docs.filter((t) => t.voided !== true),
    // Se calcula ANTES de descartar las anuladas. Al reves, una sola anulada
    // dejaba el recuento por debajo del limite y el aviso de "vista parcial"
    // desaparecia sobre un dato que si estaba recortado.
    truncated: !porRango && Boolean(limit) && docs.length >= limit,
  };
}
