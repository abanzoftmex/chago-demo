/**
 * Catálogo de la integración con punto-de-venta — las piezas compartidas por
 * `api/integrations/activate.js` (rama de ventas) y `api/integrations/
 * pos-purchases.js` (rama de compras).
 *
 * Vive aquí y no dentro de `activate.js` porque los mismos primitivos de
 * "buscar por id, si no por nombre, si no crear" hacen falta en los dos
 * endpoints, y tenerlos duplicados garantizaría que se desincronicen.
 *
 * Cada tipo tiene su PROPIO General, para que ningún árbol quede mezclado:
 *
 *   Punto de venta · {negocio} · Ventas    (general, 'entrada', locked)
 *     └─ Ventas POS                        (concepto, 'entrada', locked)
 *          └─ Efectivo · Tarjeta Débito · Tarjeta Crédito · Transferencia
 *
 *   Punto de venta · {negocio} · Compras   (general, 'salida', locked)
 *     └─ Compras POS                       (concepto, 'salida', locked)
 *          └─ un subconcepto por producto surtido en el POS
 */

import admin from "../firebase/firebaseAdmin";
import { savePosPurchaseCatalog } from "./posIntegrationService";

export const CONCEPT_NAME = "Ventas POS";
export const PURCHASE_CONCEPT_NAME = "Compras POS";
/** Id fijo del concepto de compras — ver `ensurePurchaseBranch`. */
export const PURCHASE_CONCEPT_ID = "pos_compras";
/** Id fijo del General de compras, por el mismo motivo que el del concepto. */
export const PURCHASE_GENERAL_ID = "pos_general_compras";
export const SUBCONCEPT_NAMES = ["Efectivo", "Tarjeta Débito", "Tarjeta Crédito", "Transferencia"];

export const SALES_GENERAL_SUFFIX = " · Ventas";
export const PURCHASE_GENERAL_SUFFIX = " · Compras";

/**
 * El nombre de un General de la integración. El sufijo es lo que distingue los
 * dos árboles de un mismo negocio en la lista de Generales.
 */
export const generalNameFor = (negocio, suffix) => `Punto de venta · ${negocio}${suffix}`;

/**
 * Sufijo para cuando el nombre que nos toca ya lo ocupa un documento del
 * cliente que NO vamos a adoptar: sin él, el tenant vería dos "Ventas POS"
 * idénticos y no sabría cuál es cuál. Solo se aplica al crear, y solo si de
 * verdad hubo choque — un tenant sin colisión conserva el nombre limpio.
 */
export const NAME_SUFFIX = " (integración)";

/** Un documento es de la integración si lleva la marca que pusimos nosotros. */
export const isOurs = (data) => data?.origen === "pos_sync";

export const nameFor = (base, collisions) => (collisions.length > 0 ? `${base}${NAME_SUFFIX}` : base);

/**
 * De los candidatos que coinciden por nombre, elige cuál adoptar.
 * Estricto (activación nueva): solo uno ya marcado como nuestro.
 * Laxo (ya había una activación previa, anterior a la marca `origen`): el
 * primero, como se venía haciendo — si no, duplicaría su propia rama.
 */
export function pickAdoptable(docs, lenient) {
  const ours = docs.find((d) => isOurs(d.data()));
  if (ours) return ours;
  return lenient ? docs[0] || null : null;
}

/** Las tres colecciones de catálogo de un tenant, en un solo sitio. */
export function catalogRefs(db, tenantId) {
  return {
    generalsRef: db.collection(`tenants/${tenantId}/generals`),
    conceptsRef: db.collection(`tenants/${tenantId}/concepts`),
    subconceptsRef: db.collection(`tenants/${tenantId}/subconcepts`),
  };
}

/**
 * Deja lista la rama de COMPRAS y devuelve `{ purchaseGeneralId, purchaseConceptId }`.
 *
 * Las compras cuelgan de su PROPIO General, separado del de ventas. Antes
 * compartían uno solo puesto en tipo 'ambos', y eso traía problemas que no
 * compensaban: el concepto de ventas heredaba 'ambos' de rebote al editarlo
 * —`ConceptModal` le copia el tipo del General— y se ofrecía al capturar
 * salidas; el historial marcaba «Árbol Mixto» retroactivamente en todas las
 * ventas; y el comparativo de árboles mixtos metía el del punto de venta.
 * Con un General por tipo cada árbol es puro y nada de eso ocurre.
 *
 * Idempotente y barata de repetir: si ya existen, no escribe nada. Se llama
 * perezosamente desde el endpoint de compras, así que un tenant que nunca
 * capture un costo al surtir jamás verá aparecer esta rama.
 */
export async function ensurePurchaseBranch(db, tenantId, businessName, integration = {}) {
  const { generalsRef, conceptsRef } = catalogRefs(db, tenantId);

  // Nivel 1: el General de compras, con id determinista por el mismo motivo
  // que el concepto — dos compras simultáneas no pueden crear dos.
  const generalRef = generalsRef.doc(PURCHASE_GENERAL_ID);
  const generalSnap = await generalRef.get();
  // El nombre del negocio lo manda el POS; si no llegara, se cae al del propio
  // tenant para que el General nunca nazca con el hueco vacío en el nombre.
  const negocio =
    String(businessName || "").trim() ||
    (await db.collection("tenants").doc(tenantId).get()).data()?.name ||
    tenantId;
  const purchaseGeneralName = generalNameFor(negocio, PURCHASE_GENERAL_SUFFIX);

  if (generalSnap.exists && isOurs(generalSnap.data())) {
    const data = generalSnap.data();
    const fix = {};
    if (data.type !== "salida") fix.type = "salida";
    if (data.locked !== true) { fix.locked = true; fix.origen = "pos_sync"; }
    if (Object.keys(fix).length > 0) await generalRef.update(fix);
  } else {
    const byName = await generalsRef.where("name", "==", purchaseGeneralName).limit(10).get();
    const ajenos = byName.docs.filter((d) => !isOurs(d.data()));
    try {
      await generalRef.create({
        name: nameFor(purchaseGeneralName, ajenos),
        type: "salida",
        isActive: true,
        locked: true,
        origen: "pos_sync",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if (error.code !== 6) throw error; // ALREADY_EXISTS: otra compra ganó la carrera
    }
  }
  const purchaseGeneralId = PURCHASE_GENERAL_ID;

  let purchaseConceptId = integration.purchaseConceptId || null;
  if (purchaseConceptId) {
    const existing = await conceptsRef.doc(purchaseConceptId).get();
    if (!existing.exists) purchaseConceptId = null;
    else {
      const data = existing.data();
      const fix = {};
      if (data.locked !== true) { fix.locked = true; fix.origen = "pos_sync"; }
      if (data.type !== "salida") fix.type = "salida";
      // Recolgarlo importa para los tenants migrados: su concepto de compras
      // nació bajo el General compartido de la época del tipo 'ambos', y sin
      // esto se quedaría ahí colgado aunque ya exista el General de compras.
      if (data.generalId !== purchaseGeneralId) fix.generalId = purchaseGeneralId;
      if (Object.keys(fix).length > 0) await conceptsRef.doc(purchaseConceptId).update(fix);
    }
  }

  if (!purchaseConceptId) {
    // Id de documento DETERMINISTA, igual que los subconceptos por producto.
    //
    // Es lo único que hace imposible duplicar el concepto, y hace falta de
    // verdad: dos compras que lleguen a la vez —cosa que pasa en cuanto el
    // primer envío agota su timeout y el POS pasa al siguiente mientras el
    // servidor sigue trabajando en el anterior— leerían las dos un tenant sin
    // rama de compras y crearían las dos la suya. Con `add()` eso ocurrió y
    // dejó dos "Compras POS" colgando del mismo General.
    //
    // Con id fijo, el segundo `create()` falla con ALREADY_EXISTS y se limita a
    // leer el que ya está.
    const ref = conceptsRef.doc(PURCHASE_CONCEPT_ID);
    const existing = await ref.get();

    if (existing.exists && isOurs(existing.data())) {
      purchaseConceptId = PURCHASE_CONCEPT_ID;
      const data = existing.data();
      const fix = {};
      if (data.generalId !== purchaseGeneralId) fix.generalId = purchaseGeneralId;
      if (data.type !== "salida") fix.type = "salida";
      if (Object.keys(fix).length > 0) await ref.update(fix);
    } else {
      // El nombre sí se sigue mirando, pero solo para decidir cómo LLAMARLO:
      // si el cliente ya tiene un "Compras POS" suyo, el nuestro nace con el
      // sufijo para que se distingan. Nunca lo adoptamos.
      const byName = await conceptsRef.where("name", "==", PURCHASE_CONCEPT_NAME).limit(10).get();
      const ajenos = byName.docs.filter((d) => !isOurs(d.data()));
      try {
        await ref.create({
          name: nameFor(PURCHASE_CONCEPT_NAME, ajenos),
          type: "salida",
          generalId: purchaseGeneralId,
          isActive: true,
          locked: true,
          origen: "pos_sync",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        // Carrera perdida: otra compra simultánea lo creó entre el get y el
        // create. Es exactamente el caso que este id fijo vuelve inofensivo.
        if (error.code !== 6) throw error;
      }
      purchaseConceptId = PURCHASE_CONCEPT_ID;
    }
  }

  await savePosPurchaseCatalog(tenantId, { purchaseGeneralId, purchaseConceptId });
  return { purchaseGeneralId, purchaseConceptId };
}

/** Un id de documento de Firestore no puede llevar '/' ni pasar de 1500 bytes. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Devuelve el subconcepto de un producto, creándolo la primera vez.
 *
 * El id del documento es DETERMINISTA (`pos_prod_{productId}`) en vez del
 * `add()` que usa el resto del repo. Es deliberado y es lo que convierte "no
 * se duplican los productos" en una garantía estructural: con `add()` más
 * búsqueda por nombre, dos resurtidos simultáneos del mismo producto nuevo
 * crean dos subconceptos. Aquí el segundo `create()` falla con ALREADY_EXISTS
 * y solo se lee. Cero consultas, cero índices, cero ventana de carrera.
 *
 * La identidad es el id del producto en el POS, NUNCA su nombre: así
 * renombrar un producto reusa su subconcepto en vez de crear otro, y dos
 * productos que se llamen igual no se mezclan.
 *
 * Devuelve `{ subconceptId }`, o `{ conflict: true }` si ese id lo ocupa un
 * documento que no es nuestro (no lo adoptamos).
 */
export async function ensureProductSubconcept(db, tenantId, purchaseConceptId, { productId, productName }) {
  const id = String(productId);
  if (!SAFE_ID.test(id)) return { invalid: true };

  const { subconceptsRef } = catalogRefs(db, tenantId);
  const docId = `pos_prod_${id}`;
  const ref = subconceptsRef.doc(docId);
  const name = String(productName || "").trim() || `Producto ${id}`;
  const snap = await ref.get();

  if (!snap.exists) {
    try {
      await ref.create({
        name,
        conceptId: purchaseConceptId,
        posProductId: id,
        // Copia sombra del nombre que tenía el producto la última vez que lo
        // sincronizamos. Sirve para distinguir "el cliente renombró esto" de
        // "lo renombraron en el POS" — ver abajo.
        posProductName: name,
        isActive: true,
        locked: true,
        origen: "pos_sync",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      // Carrera perdida: otro resurtido simultáneo lo creó entre el get y el
      // create. Es exactamente el caso que este diseño quiere que sea inocuo.
      if (error.code !== 6) throw error;
    }
    return { subconceptId: docId };
  }

  const data = snap.data();
  if (!isOurs(data)) return { conflict: true };

  const fix = {};
  // Aquí SÍ se recuelga, al revés que en activate.js: allí el documento se
  // adoptaba por nombre y podía no ser nuestro; éste es inequívocamente
  // nuestro (id determinista + `origen`) y su histórico son compras de este
  // producto, que pertenecen bajo el concepto de compras vigente.
  if (data.conceptId !== purchaseConceptId) fix.conceptId = purchaseConceptId;
  if (data.locked !== true) { fix.locked = true; fix.origen = "pos_sync"; }
  if (data.posProductName !== name) {
    fix.posProductName = name;
    // El nombre solo se sigue si el cliente no lo había cambiado él. Es lo
    // único que puede editar de un subconcepto bloqueado; si lo tocó, fue a
    // propósito y no se lo pisamos.
    if (data.name === data.posProductName) fix.name = name;
  }
  if (Object.keys(fix).length > 0) await ref.update(fix);

  return { subconceptId: docId };
}
