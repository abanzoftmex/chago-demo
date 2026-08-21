/**
 * POST /api/integrations/pos-transactions/[id]/void
 *
 * Anula una entrada que se creó desde punto-de-venta, cuando la venta
 * original se cancela allá. Nunca se borra — se marca `voided:true`, deja
 * rastro de que existió y por qué se anuló. Mismo Bearer auth que el resto
 * de esta integración.
 */

import admin, { assertAdminInitialized } from "../../../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken } from "../../../../../lib/server/posIntegrationService";

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
    const docRef = admin.firestore().collection(`tenants/${chagoTenantId}/transacciones`).doc(id);
    const snap = await docRef.get();

    if (!snap.exists) return res.status(404).json({ error: "Entrada no encontrada" });

    const data = snap.data();
    if (data.origen !== "pos_sync") {
      // Defensa: este endpoint solo puede tocar entradas que él mismo creó,
      // nunca una capturada a mano en chago-demo.
      return res.status(409).json({ error: "Esta entrada no fue creada por punto-de-venta" });
    }
    if (data.voided) {
      return res.status(200).json({ ok: true, alreadyVoided: true });
    }

    await docRef.update({
      voided: true,
      voidedAt: admin.firestore.FieldValue.serverTimestamp(),
      voidReason: reason || "Venta cancelada en punto de venta",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("❌ Error anulando entrada de POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
