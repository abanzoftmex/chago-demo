/**
 * POST /api/integrations/activate
 *
 * La llama Torre de Control (punto-de-venta) justo después de guardar el
 * token pegado por el superadmin — nunca un usuario logueado en chago-demo.
 * Da de alta, si no existen ya, el concepto "Ventas POS" (type:'entrada') y
 * sus 4 subconceptos (uno por método de pago) para el tenant, e idempotente:
 * si ya existen de una activación anterior, los reusa en vez de duplicarlos.
 *
 * Auth: Authorization: Bearer <token> — el mismo que generó chago-demo y que
 * el superadmin pegó en Torre de Control. Body: { chagoTenantId }.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken, savePosIntegrationCatalog } from "../../../lib/server/posIntegrationService";

const CONCEPT_NAME = "Ventas POS";
const SUBCONCEPT_NAMES = ["Efectivo", "Tarjeta Débito", "Tarjeta Crédito", "Transferencia"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const token = extractBearerToken(req);
  const { chagoTenantId } = req.body || {};
  if (!chagoTenantId) return res.status(400).json({ error: "chagoTenantId es requerido" });

  const verification = await verifyPosIntegrationToken(chagoTenantId, token);
  if (!verification.ok) return res.status(401).json({ error: verification.error });

  try {
    const db = admin.firestore();
    const conceptsRef = db.collection(`tenants/${chagoTenantId}/concepts`);
    const subconceptsRef = db.collection(`tenants/${chagoTenantId}/subconcepts`);

    // Idempotente: si "Ventas POS" ya existe (de una activación previa, p.ej.
    // tras un revoke + volver a activar), se reusa en vez de duplicar.
    let conceptId = verification.integration?.conceptId || null;
    if (conceptId) {
      const existing = await conceptsRef.doc(conceptId).get();
      if (!existing.exists) conceptId = null;
    }
    if (!conceptId) {
      const existingQuery = await conceptsRef.where("name", "==", CONCEPT_NAME).limit(1).get();
      if (!existingQuery.empty) {
        conceptId = existingQuery.docs[0].id;
      } else {
        const newConcept = await conceptsRef.add({
          name: CONCEPT_NAME,
          type: "entrada",
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        conceptId = newConcept.id;
      }
    }

    // Mismo criterio para cada subconcepto: reusa el existente por nombre
    // bajo este concepto, o lo crea.
    const subconceptIds = {};
    for (const name of SUBCONCEPT_NAMES) {
      const existingQuery = await subconceptsRef
        .where("conceptId", "==", conceptId)
        .where("name", "==", name)
        .limit(1)
        .get();
      if (!existingQuery.empty) {
        subconceptIds[name] = existingQuery.docs[0].id;
      } else {
        const newSubconcept = await subconceptsRef.add({
          name,
          conceptId,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        subconceptIds[name] = newSubconcept.id;
      }
    }

    await savePosIntegrationCatalog(chagoTenantId, { conceptId, subconceptIds });

    return res.status(200).json({ ok: true, conceptId, subconceptIds });
  } catch (error) {
    console.error("❌ Error activando integración POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
