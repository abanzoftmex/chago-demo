/**
 * Lo que comparten las dos transacciones que escribe la integración con el
 * punto de venta: la venta (entrada) y la compra de almacén (salida).
 *
 * Existe para que los invariantes contables vivan en un solo sitio. Los dos
 * endpoints difieren en casi todo lo demás —una valida método de pago y sube
 * un PDF, la otra valida cantidades y resuelve un subconcepto por producto—,
 * así que se comparte por helper y no metiendo un `if` en un endpoint.
 */

import admin from "../firebase/firebaseAdmin";

export const POS_KIND_SALE = "venta";
export const POS_KIND_PURCHASE = "compra";

const transaccionesRef = (db, tenantId) => db.collection(`tenants/${tenantId}/transacciones`);

/**
 * Busca una transacción ya recibida por su `externalId`.
 *
 * La idempotencia del POS se apoya en esto, y la colección es la MISMA para
 * ventas y compras — por eso el llamador debe comprobar además el `posKind`
 * del documento hallado: si no coincide, es una colisión de identificadores
 * entre los dos flujos y hay que gritar, no devolver el id equivocado.
 */
export async function findPosTransactionByExternalId(db, tenantId, externalId) {
  const found = await transaccionesRef(db, tenantId)
    .where("externalId", "==", String(externalId))
    .limit(1)
    .get();
  return found.empty ? null : found.docs[0];
}

/**
 * Los campos comunes de toda transacción nacida en el punto de venta.
 *
 * `status:"pagado"` con `balance:0` no es decorativo: `reportService` trata
 * toda SALIDA en estado 'pendiente' como saldo de arrastre y la reproduce mes
 * a mes. Una compra que ya se pagó al surtir tiene que nacer saldada o
 * contaminaría todos los reportes siguientes.
 *
 * `locked:true` + `origen:'pos_sync'` es lo que impide editarla o borrarla
 * desde la UI y desde las reglas de Firestore. El que manda es el que envía.
 */
export function posTransactionBase({ amount, externalId, date, posKind }) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const value = Number(amount);
  return {
    amount: value,
    date: date ? new Date(date) : new Date(),
    providerId: "",
    status: "pagado",
    payments: [],
    totalPaid: value,
    balance: 0,
    externalId: String(externalId),
    posKind,
    origen: "pos_sync",
    locked: true,
    voided: false,
    createdAt: now,
    updatedAt: now,
  };
}
