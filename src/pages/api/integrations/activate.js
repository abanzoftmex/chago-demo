/**
 * POST /api/integrations/activate
 *
 * La llama Torre de Control (punto-de-venta) justo después de guardar el
 * token pegado por el superadmin — nunca un usuario logueado en chago-demo.
 * Da de alta, si no existen ya, la rama completa de 3 niveles que pide el
 * catálogo de chago-demo: el General "Punto de venta · {negocio}", el
 * concepto "Ventas POS" (type:'entrada') colgado de ese general, y sus 4
 * subconceptos (uno por método de pago) colgados del concepto — e
 * idempotente: si ya existen de una activación anterior, los reusa en vez de
 * duplicarlos (y si el concepto ya existía SIN generalId, de una activación
 * de antes de que este nivel existiera, se lo asigna aquí mismo).
 *
 * Auth: Authorization: Bearer <token> — el mismo que generó chago-demo y que
 * el superadmin pegó en Torre de Control.
 * Body: { chagoTenantId, businessName? } — businessName es el nombre del
 * negocio en punto-de-venta, usado solo para nombrar el General; si no
 * llega, se usa el propio chagoTenantId para que el nombre nunca quede vacío.
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
  const { chagoTenantId, businessName } = req.body || {};
  if (!chagoTenantId) return res.status(400).json({ error: "chagoTenantId es requerido" });

  const verification = await verifyPosIntegrationToken(chagoTenantId, token);
  if (!verification.ok) return res.status(401).json({ error: verification.error });

  const generalName = `Punto de venta · ${businessName?.trim() || chagoTenantId}`;

  try {
    const db = admin.firestore();
    const generalsRef = db.collection(`tenants/${chagoTenantId}/generals`);
    const conceptsRef = db.collection(`tenants/${chagoTenantId}/concepts`);
    const subconceptsRef = db.collection(`tenants/${chagoTenantId}/subconcepts`);

    // Nivel 1: el General, propio de este punto de venta vinculado.
    let generalId = verification.integration?.generalId || null;
    if (generalId) {
      const existing = await generalsRef.doc(generalId).get();
      if (!existing.exists) generalId = null;
    }
    if (!generalId) {
      const existingQuery = await generalsRef.where("name", "==", generalName).limit(1).get();
      if (!existingQuery.empty) {
        generalId = existingQuery.docs[0].id;
      } else {
        const newGeneral = await generalsRef.add({
          name: generalName,
          type: "entrada",
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        generalId = newGeneral.id;
      }
    }

    // Nivel 2: el concepto "Ventas POS", colgado del General de arriba.
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
        // Se activó antes de que este endpoint generara el General: se
        // completa la rama en vez de dejar el concepto huérfano.
        const conceptData = existingQuery.docs[0].data();
        if (conceptData.generalId !== generalId) {
          await conceptsRef.doc(conceptId).update({ generalId });
        }
      } else {
        const newConcept = await conceptsRef.add({
          name: CONCEPT_NAME,
          type: "entrada",
          generalId,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        conceptId = newConcept.id;
      }
    }

    // Nivel 3: un subconcepto por método de pago, colgado del concepto.
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

    await savePosIntegrationCatalog(chagoTenantId, { generalId, conceptId, subconceptIds });

    return res.status(200).json({ ok: true, generalId, conceptId, subconceptIds });
  } catch (error) {
    console.error("❌ Error activando integración POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
