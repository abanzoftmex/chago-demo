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
const paymentsRef = (db, tenantId) => db.collection(`tenants/${tenantId}/payments`);

/**
 * Id del pago que salda una transacción del POS: uno por transacción, y
 * siempre el mismo. Que sea determinista es lo que deja al anulador encontrarlo
 * sin consultar, y al script de regularización crearlo sin riesgo de duplicar.
 * `scripts/backfill-pos-payments.cjs` repite este formato — si cambia aquí,
 * cambia allá.
 */
export const posPaymentId = (transactionId) => `pos_${transactionId}`;

export const posPaymentNotes = (posKind) =>
  posKind === POS_KIND_PURCHASE
    ? "Pago registrado por el punto de venta"
    : "Cobro registrado por el punto de venta";

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
 * Pero esos campos solo DICEN que está pagada: el pago de verdad es un
 * documento en `payments`, que es de donde leen la pantalla de pagos y el
 * reporte de pagos reales. Por eso la transacción no se escribe sola — ver
 * `createPosTransactionWithPayment`.
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

/**
 * Crea la transacción del POS y el pago que la salda, en una sola escritura.
 *
 * En el punto de venta el dinero ya se cobró (o se pagó, en una compra) en el
 * momento del movimiento, así que el pago va por el monto total y con la MISMA
 * fecha de la venta o compra, no la de recepción: si el envío llega tarde, el
 * reporte por fecha de pago tiene que seguir cayendo en el día correcto.
 *
 * Atómica a propósito: una transacción sin su pago es exactamente el defecto
 * que esto corrige, y un pago sin transacción sería un huérfano en reportes.
 */
export async function createPosTransactionWithPayment(db, tenantId, transactionData) {
  const txRef = transaccionesRef(db, tenantId).doc();
  const batch = db.batch();
  batch.create(txRef, transactionData);
  batch.create(paymentsRef(db, tenantId).doc(posPaymentId(txRef.id)), {
    transactionId: txRef.id,
    amount: transactionData.amount,
    date: transactionData.date,
    notes: posPaymentNotes(transactionData.posKind),
    attachments: [],
    origen: "pos_sync",
    locked: true,
    voided: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return txRef;
}
