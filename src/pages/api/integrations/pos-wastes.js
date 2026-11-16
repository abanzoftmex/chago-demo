/**
 * POST /api/integrations/pos-wastes
 *
 * Recibe una MERMA del punto de venta —mercancía que se perdió: se caducó, se cayó, se quemó— y la refleja como Salida
 * de pérdidas. Llamada de sistema (Authorization: Bearer <token del vínculo>), nunca de un usuario logueado en
 * chago-demo.
 *
 * Cuelga de su PROPIA rama, separada de la de compras y la de ventas: un General "Punto de venta · {negocio} · Mermas"
 * de tipo 'salida', el concepto "Mermas POS" y un subconcepto POR CAUSA (caducado, accidente, error de preparación…),
 * que se crea la primera vez que esa causa aparece y se reusa siempre después. La identidad es el CÓDIGO de la causa,
 * no su etiqueta: renombrarla no duplica nada. Ver `lib/server/posCatalog.js`.
 *
 * Por qué por causa y no por producto: lo que el dueño pregunta de una pérdida es «¿por qué se pierde?». El producto va
 * en el detalle de cada movimiento (`posProductId`, `posProductName`, cantidad y costo), de donde se puede cortar por
 * artículo; la causa es lo que se quiere ver sumado.
 *
 * Solo llegan aquí las mermas CON costo unitario: sin costo no hay pérdida en dinero que asentar, y una salida de $0
 * solo ensuciaría los reportes. La cantidad puede ser decimal (hasta 4 cifras): un insumo se pierde por kilo o litro.
 *
 * Idempotente por `externalId`, igual que las ventas y las compras. Para anularla sirve el mismo
 * `/api/integrations/pos-transactions/{id}/void`.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken, motivoDeOrigenRechazado } from "../../../lib/server/posIntegrationService";
import { ensureWasteBranch, ensureWasteCauseSubconcept } from "../../../lib/server/posCatalog";
import {
  createPosTransactionWithPayment,
  findPosTransactionByExternalId,
  posTransactionBase,
  POS_KIND_WASTE,
} from "../../../lib/server/posTransactionWriter";

/** Lo único que se acepta como código de causa: letras, números, guion y guion bajo (ver `ensureWasteCauseSubconcept`). */
const SAFE_CAUSE = /^[A-Za-z0-9_-]{1,40}$/;

/** Una cantidad válida: mayor a cero y de hasta 4 decimales (la misma regla que `pos-purchases`). */
const MAX_DECIMALES = 4;
function esCantidadValida(qty) {
  if (!Number.isFinite(qty) || qty <= 0) return false;
  const escalada = qty * 10 ** MAX_DECIMALES;
  return Math.abs(escalada - Math.round(escalada)) < 1e-6;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const token = extractBearerToken(req);
  const {
    chagoTenantId, externalId, productId, productName, quantity, unitCost, unit, cause, causeLabel,
    date, note, businessName, sistemaOrigen,
  } = req.body || {};

  if (!chagoTenantId) return res.status(400).json({ error: "chagoTenantId es requerido" });
  if (!externalId) return res.status(400).json({ error: "externalId es requerido" });
  if (!productId) return res.status(400).json({ error: "productId es requerido" });
  if (!String(productName || "").trim()) return res.status(400).json({ error: "productName es requerido" });
  if (!String(cause || "").trim()) return res.status(400).json({ error: "cause es requerida" });
  // Antes de tocar nada: el código de la causa da nombre a un documento (`pos_merma_{causa}`), así que tiene que caber
  if (!SAFE_CAUSE.test(String(cause))) return res.status(400).json({ error: "cause no es un identificador válido" });

  const qty = Number(quantity);
  if (!esCantidadValida(qty)) {
    return res.status(400).json({ error: "quantity debe ser un número mayor a 0, de hasta 4 decimales" });
  }
  const cost = Number(unitCost);
  if (!Number.isFinite(cost) || cost <= 0) {
    return res.status(400).json({ error: "unitCost debe ser mayor a 0" });
  }
  const amount = Math.round(qty * cost * 100) / 100;
  if (!(amount > 0)) return res.status(400).json({ error: "El monto calculado debe ser mayor a 0" });

  const verification = await verifyPosIntegrationToken(chagoTenantId, token);
  if (!verification.ok) return res.status(401).json({ error: verification.error });

  const { integration } = verification;

  // Un solo sistema a la vez (ver `motivoDeOrigenRechazado`)
  const origenRechazado = motivoDeOrigenRechazado(integration, sistemaOrigen);
  if (origenRechazado) return res.status(409).json({ error: origenRechazado, codigo: "ORIGEN_NO_VIGENTE" });

  try {
    const db = admin.firestore();

    // Rama de mermas: en régimen ya está lista y esto no cuesta ni una lectura extra. Solo se construye la primera vez,
    // así que un negocio vinculado hace meses empieza a mandar mermas sin que nadie abra Torre de Control.
    let { wasteGeneralId, wasteConceptId } = integration;
    if (!integration.wasteReadyAt || !wasteGeneralId || !wasteConceptId) {
      const branch = await ensureWasteBranch(db, chagoTenantId, businessName);
      if (branch.conflict) {
        return res.status(409).json({ error: "El General o el concepto de mermas lo ocupa un documento ajeno a la integración" });
      }
      ({ wasteGeneralId, wasteConceptId } = branch);
    }

    const sub = await ensureWasteCauseSubconcept(db, chagoTenantId, wasteConceptId, {
      cause,
      causeLabel: String(causeLabel || "").trim(),
    });
    if (sub.invalid) return res.status(400).json({ error: "cause no es un identificador válido" });
    if (sub.conflict) {
      return res.status(409).json({ error: "El subconcepto de esa causa lo ocupa un documento ajeno a la integración" });
    }

    // Idempotencia: una merma ya recibida no se duplica. La colección la comparten ventas, compras y mermas, así que un
    // `externalId` repetido que pertenezca a otro flujo es una colisión, no un reintento — devolver su id perdería la
    // merma en silencio.
    const existing = await findPosTransactionByExternalId(db, chagoTenantId, externalId);
    if (existing) {
      if (existing.data().posKind !== POS_KIND_WASTE) {
        return res.status(409).json({ error: "Ese externalId ya lo usa otro movimiento del punto de venta" });
      }
      return res.status(200).json({ chagoTransactionId: existing.id, alreadyExisted: true });
    }

    // La descripción se arma SIEMPRE aquí, nunca se acepta del cliente: que diga qué se perdió, cuánto y por qué es lo
    // que hace útil el movimiento al revisarlo suelto, sin abrir el POS.
    const name = String(productName).trim();
    const unidad = String(unit || "").trim().slice(0, 10);
    const motivo = String(causeLabel || "").trim() || String(cause);
    const description = [`Merma POS · ${name} · ${qty} ${unidad || "unidad(es)"} · ${motivo}`, String(note || "").trim()]
      .filter(Boolean)
      .join(" · ");

    // Nace junto con el pago que la salda — ver `createPosTransactionWithPayment`.
    const docRef = await createPosTransactionWithPayment(db, chagoTenantId, {
      ...posTransactionBase({
        amount,
        externalId,
        date,
        posKind: POS_KIND_WASTE,
        posSystem: integration.sistemaOrigen,
      }),
      type: "salida",
      generalId: wasteGeneralId,
      conceptId: wasteConceptId,
      subconceptId: sub.subconceptId,
      description,
      // `reportService.divisionBreakdown` solo suma las salidas que TIENEN división; sin esto la merma existiría en el
      // total pero desaparecería del desglose. Es el mismo valor que pone la captura manual.
      division: "general",
      externalFolio: null,
      posProductId: String(productId),
      posProductName: name,
      posWasteCause: String(cause),
      quantity: qty,
      unitCost: cost,
      ...(unidad && { posUnit: unidad }),
    });

    return res.status(201).json({ chagoTransactionId: docRef.id, subconceptId: sub.subconceptId });
  } catch (error) {
    console.error("❌ Error creando merma desde POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
