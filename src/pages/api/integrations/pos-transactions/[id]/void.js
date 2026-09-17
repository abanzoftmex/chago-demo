/**
 * POST /api/integrations/pos-transactions/[id]/void
 *
 * Anula una entrada que se creó desde punto-de-venta, cuando la venta
 * original se cancela allá. Nunca se borra — se marca `voided:true`, deja
 * rastro de que existió y por qué se anuló. Mismo Bearer auth que el resto
 * de esta integración.
 *
 * Su pago corre la misma suerte: se marca anulado, no se borra. Las
 * transacciones anteriores a que la integración creara el pago pueden no
 * tenerlo todavía — entonces solo se anula la transacción, y el script de
 * regularización crea después el pago ya anulado.
 *
 * Una venta con pago dividido son varias transacciones (una por método); se
 * anulan todas juntas, llegue el id de la principal o el de cualquier parte.
 */

import admin, { assertAdminInitialized } from "../../../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken } from "../../../../../lib/server/posIntegrationService";
import { posPaymentId, posTransactionsToVoid } from "../../../../../lib/server/posTransactionWriter";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const { id } = req.query;
  const token = extractBearerToken(req);
  const { chagoTenantId, reason } = req.body || {};

  if (!chagoTenantId) return res.status(400).json({ error: "chagoTenantId es requerido" });

  const verification = await verifyPosIntegrationToken(chagoTenantId, token);
  if (!verification.ok) return res.status(401).json({ error: verification.error });

  try {
    const db = admin.firestore();
    const docRef = db.collection(`tenants/${chagoTenantId}/transacciones`).doc(id);
    const snap = await docRef.get();

    if (!snap.exists) return res.status(404).json({ error: "Transacción no encontrada" });

    const data = snap.data();
    if (data.origen !== "pos_sync") {
      // Defensa: este endpoint solo puede tocar lo que la propia integración
      // creó, nunca algo capturado a mano en chago-demo. Sirve igual para la
      // entrada de una venta que para la salida de una compra de almacén.
      return res.status(409).json({ error: "Esta transacción no fue creada por punto-de-venta" });
    }

    const voidFields = {
      voided: true,
      voidedAt: admin.firestore.FieldValue.serverTimestamp(),
      voidReason: reason || "Movimiento cancelado en punto de venta",
    };

    // La transacción y, si fue un pago dividido, el resto de su grupo
    const transacciones = await posTransactionsToVoid(db, chagoTenantId, snap);
    const batch = db.batch();
    let pendientes = 0;

    for (const tx of transacciones) {
      const paymentRef = db.collection(`tenants/${chagoTenantId}/payments`).doc(posPaymentId(tx.id));
      const paymentSnap = await paymentRef.get();
      const paymentPending = paymentSnap.exists && paymentSnap.data().voided !== true;

      // Una transacción ya anulada con su pago todavía vivo no es un reintento
      // inofensivo: es media anulación, y el pago seguiría sumando. Se completa.
      if (!tx.data().voided) {
        batch.update(tx.ref, { ...voidFields, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        pendientes++;
      }
      if (paymentPending) {
        batch.update(paymentRef, voidFields);
        pendientes++;
      }
    }

    if (pendientes === 0) {
      return res.status(200).json({ ok: true, alreadyVoided: true });
    }
    await batch.commit();

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("❌ Error anulando entrada de POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
