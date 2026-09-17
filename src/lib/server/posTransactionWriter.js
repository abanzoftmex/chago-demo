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
  const [txRef] = await createPosTransactionGroupWithPayments(db, tenantId, [transactionData]);
  return txRef;
}

/** El pago que salda una transacción del POS, por su monto y con su fecha. */
function posPaymentDoc(txRef, transactionData) {
  return {
    transactionId: txRef.id,
    amount: transactionData.amount,
    date: transactionData.date,
    notes: posPaymentNotes(transactionData.posKind),
    attachments: [],
    origen: "pos_sync",
    locked: true,
    voided: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Una venta del POS cobrada con VARIOS métodos (pago dividido).
 *
 * En chago-demo el método de pago no vive en el pago: decide el SUBCONCEPTO de
 * la transacción («Ventas POS · Efectivo», «Ventas POS · Débito»). Una
 * transacción tiene un solo subconcepto, así que una venta de 500 cobrada 300
 * en efectivo y 200 con tarjeta no cabe en una: se contaría entera como
 * efectivo en todo reporte por subconcepto. Se registra como una transacción
 * por método, cada una con su pago.
 *
 * Las transacciones de la misma venta quedan agrupadas por `posSplitGroup`, que
 * es el id de la PRIMERA —la principal—. Punto-de-venta guarda un solo id por
 * venta y es ese: con él la idempotencia devuelve la principal y la anulación
 * encuentra al grupo entero. Todo va en una sola escritura: una venta a medias
 * cuadraría mal en los dos lados.
 *
 * Con una sola transacción se comporta exactamente como antes y no escribe los
 * campos de grupo.
 *
 * @param {Array<object>} parts  el `transactionData` de cada parte, en orden
 * @returns {Promise<Array<DocumentReference>>} las referencias, la principal primero
 */
export async function createPosTransactionGroupWithPayments(db, tenantId, parts) {
  const refs = parts.map(() => transaccionesRef(db, tenantId).doc());
  const grupo = parts.length > 1 ? refs[0].id : null;
  const batch = db.batch();

  parts.forEach((data, i) => {
    const txData = grupo
      ? { ...data, posSplitGroup: grupo, posSplitPart: i + 1, posSplitParts: parts.length }
      : data;
    batch.create(refs[i], txData);
    batch.create(paymentsRef(db, tenantId).doc(posPaymentId(refs[i].id)), posPaymentDoc(refs[i], txData));
  });

  await batch.commit();
  return refs;
}

/**
 * Las transacciones que se anulan juntas con `transactionSnap`: todo su grupo
 * si fue un pago dividido, o solo ella. La principal siempre va incluida,
 * aunque la consulta tarde en verla.
 */
export async function posTransactionsToVoid(db, tenantId, transactionSnap) {
  const grupo = transactionSnap.data().posSplitGroup;
  if (!grupo) return [transactionSnap];
  const found = await transaccionesRef(db, tenantId)
    .where("posSplitGroup", "==", grupo)
    .get();
  const docs = found.docs.filter((d) => d.data().origen === "pos_sync");
  return docs.some((d) => d.id === transactionSnap.id) ? docs : [transactionSnap, ...docs];
}
