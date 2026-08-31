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
 * duplicarlos.
 *
 * Cómo se resuelve cada nivel, en orden:
 *
 *   1. Por el ID guardado en `posIntegration` (generalId/conceptId/
 *      subconceptIds). Es el camino normal de una reactivación y el que
 *      recupera los vínculos anteriores a que existiera la marca `origen`
 *      — por eso los subconceptos también se buscan aquí primero, aunque
 *      antes solo se buscaban por nombre.
 *   2. Si no, por nombre. Y aquí SOLO se adopta un documento que ya sea de
 *      la integración (`origen:'pos_sync'`): un "Ventas POS" que el cliente
 *      haya creado a mano es suyo, no nuestro, y adoptarlo lo recolgaría de
 *      otro General y lo dejaría bloqueado. En una activación nueva se
 *      prefiere crear la rama propia y dejar la del cliente intacta — con
 *      el sufijo `NAME_SUFFIX` para que el tenant no acabe con dos
 *      documentos del mismo nombre sin poder distinguirlos.
 *      Excepción: un tenant que YA tenía una activación registrada
 *      (`hasPriorActivation`) conserva la adopción laxa de siempre, porque
 *      su rama es anterior a la marca `origen` y filtrarla lo llevaría a
 *      duplicar su propio catálogo.
 *   3. Si tampoco, se crea.
 *
 * Auth: Authorization: Bearer <token> — el mismo que generó chago-demo y que
 * el superadmin pegó en Torre de Control.
 * Body: { chagoTenantId, businessName? } — businessName es el nombre del
 * negocio en punto-de-venta, usado solo para nombrar el General; si no
 * llega, se usa el propio chagoTenantId para que el nombre nunca quede vacío.
 *
 * Los 3 niveles nacen con `locked:true, origen:'pos_sync'` — es la marca que
 * generalService/conceptService/subconceptService usan para impedir que se
 * borren o se reestructuren (cambiar generalId/conceptId) desde la UI de
 * chago-demo; solo el nombre queda libre. Si una activación anterior a este
 * cambio dejó algún nivel sin la marca, se le agrega aquí mismo al reusarlo.
 * Nunca se reestructura un documento que no sea de la integración: la
 * jerarquía de un documento ajeno no se toca, se crea uno propio.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken, savePosIntegrationCatalog } from "../../../lib/server/posIntegrationService";

const CONCEPT_NAME = "Ventas POS";
const SUBCONCEPT_NAMES = ["Efectivo", "Tarjeta Débito", "Tarjeta Crédito", "Transferencia"];
/**
 * Sufijo para cuando el nombre que nos toca ya lo ocupa un documento del
 * cliente que NO vamos a adoptar: sin él, el tenant vería dos "Ventas POS"
 * idénticos y no sabría cuál es cuál. Solo se aplica al crear, y solo si de
 * verdad hubo choque — un tenant sin colisión conserva el nombre limpio.
 */
const NAME_SUFFIX = " (integración)";
const nameFor = (base, collisions) => (collisions.length > 0 ? `${base}${NAME_SUFFIX}` : base);

/** Un documento es de la integración si lleva la marca que puso este endpoint. */
const isOurs = (data) => data?.origen === "pos_sync";

/**
 * De los candidatos que coinciden por nombre, elige cuál adoptar.
 * Estricto (activación nueva): solo uno ya marcado como nuestro.
 * Laxo (el tenant ya tenía una activación previa, anterior a la marca): el
 * primero, como se venía haciendo — si no, duplicaría su propia rama.
 */
function pickAdoptable(docs, lenient) {
  const ours = docs.find((d) => isOurs(d.data()));
  if (ours) return ours;
  return lenient ? docs[0] || null : null;
}

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

  const integration = verification.integration || {};
  // Marca de "este tenant ya se había activado alguna vez". Los que se
  // activaron antes de que existiera `origen` no tienen la marca en su rama,
  // así que para ellos la adopción por nombre sigue siendo laxa.
  const hasPriorActivation = !!(integration.generalId || integration.conceptId || integration.subconceptIds);

  const generalName = `Punto de venta · ${businessName?.trim() || chagoTenantId}`;

  try {
    const db = admin.firestore();
    const generalsRef = db.collection(`tenants/${chagoTenantId}/generals`);
    const conceptsRef = db.collection(`tenants/${chagoTenantId}/concepts`);
    const subconceptsRef = db.collection(`tenants/${chagoTenantId}/subconcepts`);

    // Nivel 1: el General, propio de este punto de venta vinculado.
    let generalId = integration.generalId || null;
    if (generalId) {
      const existing = await generalsRef.doc(generalId).get();
      if (!existing.exists) generalId = null;
      // Autoreparación: si venía de antes de que existiera el bloqueo, se
      // marca ahora — sin esto un cliente podría borrar/reestructurar un
      // General ya en uso por la integración.
      else if (existing.data()?.locked !== true) {
        await generalsRef.doc(generalId).update({ locked: true, origen: "pos_sync" });
      }
    }
    if (!generalId) {
      // El filtro por `origen` se hace en memoria y no en la consulta: dos
      // igualdades (name + origen) pedirían un índice compuesto nuevo.
      const byName = await generalsRef.where("name", "==", generalName).limit(10).get();
      const adopted = pickAdoptable(byName.docs, hasPriorActivation);
      if (adopted) {
        generalId = adopted.id;
        if (adopted.data()?.locked !== true) {
          await generalsRef.doc(generalId).update({ locked: true, origen: "pos_sync" });
        }
      } else {
        const newGeneral = await generalsRef.add({
          name: nameFor(generalName, byName.docs),
          type: "entrada",
          isActive: true,
          locked: true,
          origen: "pos_sync",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        generalId = newGeneral.id;
      }
    }

    // Nivel 2: el concepto "Ventas POS", colgado del General de arriba.
    let conceptId = integration.conceptId || null;
    if (conceptId) {
      const existing = await conceptsRef.doc(conceptId).get();
      if (!existing.exists) conceptId = null;
      else if (existing.data()?.locked !== true) {
        await conceptsRef.doc(conceptId).update({ locked: true, origen: "pos_sync" });
      }
    }
    if (!conceptId) {
      const byName = await conceptsRef.where("name", "==", CONCEPT_NAME).limit(10).get();
      const adopted = pickAdoptable(byName.docs, hasPriorActivation);
      if (adopted) {
        conceptId = adopted.id;
        // Se activó antes de que este endpoint generara el General (o antes
        // del bloqueo): se completa la rama y se marca, en vez de dejar el
        // concepto huérfano o editable.
        const conceptData = adopted.data();
        const conceptFix = {};
        if (conceptData.generalId !== generalId) conceptFix.generalId = generalId;
        if (conceptData.locked !== true) { conceptFix.locked = true; conceptFix.origen = "pos_sync"; }
        if (Object.keys(conceptFix).length > 0) await conceptsRef.doc(conceptId).update(conceptFix);
      } else {
        const newConcept = await conceptsRef.add({
          name: nameFor(CONCEPT_NAME, byName.docs),
          type: "entrada",
          generalId,
          isActive: true,
          locked: true,
          origen: "pos_sync",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        conceptId = newConcept.id;
      }
    }

    // Nivel 3: un subconcepto por método de pago, colgado del concepto.
    // Por ID guardado primero — es lo que mantiene enteros los vínculos
    // anteriores a la marca `origen`, cuyos subconceptos existen pero no
    // están marcados. Solo se adopta si sigue colgando de ESTE concepto: si
    // el concepto cambió, mover el subconcepto se llevaría con él el
    // histórico que tenga colgado, así que se prefiere crear uno nuevo.
    const savedSubconceptIds = integration.subconceptIds || {};
    const subconceptIds = {};
    for (const name of SUBCONCEPT_NAMES) {
      let subconceptId = savedSubconceptIds[name] || null;
      if (subconceptId) {
        const existing = await subconceptsRef.doc(subconceptId).get();
        if (!existing.exists || existing.data()?.conceptId !== conceptId) subconceptId = null;
        else if (existing.data()?.locked !== true) {
          await subconceptsRef.doc(subconceptId).update({ locked: true, origen: "pos_sync" });
        }
      }
      if (!subconceptId) {
        const byName = await subconceptsRef
          .where("conceptId", "==", conceptId)
          .where("name", "==", name)
          .limit(10)
          .get();
        const adopted = pickAdoptable(byName.docs, hasPriorActivation);
        if (adopted) {
          subconceptId = adopted.id;
          if (adopted.data()?.locked !== true) {
            await subconceptsRef.doc(subconceptId).update({ locked: true, origen: "pos_sync" });
          }
        } else {
          const newSubconcept = await subconceptsRef.add({
            name: nameFor(name, byName.docs),
            conceptId,
            isActive: true,
            locked: true,
            origen: "pos_sync",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          subconceptId = newSubconcept.id;
        }
      }
      subconceptIds[name] = subconceptId;
    }

    await savePosIntegrationCatalog(chagoTenantId, { generalId, conceptId, subconceptIds });

    return res.status(200).json({ ok: true, generalId, conceptId, subconceptIds });
  } catch (error) {
    console.error("❌ Error activando integración POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
