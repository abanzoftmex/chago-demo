/**
 * POST /api/integrations/pos-purchases
 *
 * Recibe un surtido de almacén del punto de venta —que implica una compra— y
 * lo refleja como Salida. Llamada de sistema (Authorization: Bearer <token
 * del vínculo>), nunca de un usuario logueado en chago-demo.
 *
 * Cuelga de su PROPIA rama, separada de la de ventas: un General "Punto de
 * venta · {negocio} · Compras" de tipo 'salida', el concepto "Compras POS" y
 * un subconcepto POR PRODUCTO, que se crea la primera vez que ese producto se surte y se reusa siempre
 * después — la identidad es el id del producto en el POS, no su nombre, así
 * que renombrarlo no duplica nada. Ver `lib/server/posCatalog.js`.
 *
 * Solo llegan aquí los surtidos CON costo unitario: sin costo no hay compra
 * que registrar, y una salida de $0 solo ensuciaría los reportes de gasto.
 *
 * La cantidad puede ser decimal (hasta 4 cifras): un insumo se compra por kilo o
 * por litro. `unit` es opcional y solo rotula la descripción.
 * Las restas de almacén (merma, ajuste de conteo) no llegan nunca — no son
 * un gasto, y el POS ni las envía.
 *
 * Idempotente por `externalId`, igual que las ventas. Para anularla sirve el
 * mismo `/api/integrations/pos-transactions/{id}/void`.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken } from "../../../lib/server/posIntegrationService";
import { ensurePurchaseBranch, ensureProductSubconcept } from "../../../lib/server/posCatalog";
import {
  createPosTransactionWithPayment,
  findPosTransactionByExternalId,
  posTransactionBase,
  POS_KIND_PURCHASE,
} from "../../../lib/server/posTransactionWriter";

/**
 * Una cantidad de compra válida: mayor a cero y de hasta 4 decimales.
 *
 * Era un entero, y bastaba mientras el único punto de venta surtía piezas. Un
 * insumo se compra por kilo o por litro (2.5 kg de aguacate), y rechazar eso
 * obligaba al POS a mentir sobre la cantidad. Los enteros de siempre pasan igual.
 *
 * Cuatro decimales porque es lo que guardan los puntos de venta; más que eso no
 * es una cantidad que alguien haya tecleado.
 */
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
  const { chagoTenantId, externalId, productId, productName, quantity, unitCost, unit, date, note, businessName } = req.body || {};

  if (!chagoTenantId) return res.status(400).json({ error: "chagoTenantId es requerido" });
  if (!externalId) return res.status(400).json({ error: "externalId es requerido" });
  if (!productId) return res.status(400).json({ error: "productId es requerido" });
  if (!String(productName || "").trim()) return res.status(400).json({ error: "productName es requerido" });

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

  try {
    const db = admin.firestore();

    // Rama de compras: en régimen ya está lista y esto no cuesta ni una
    // lectura extra. Solo se construye la primera vez, que es lo que permite
    // que un tenant vinculado hace meses empiece a mandar compras sin que
    // nadie tenga que abrir Torre de Control.
    //
    // No depende de la rama de ventas: cada tipo tiene su propio General, así
    // que un tenant puede recibir compras aunque nunca haya cobrado una venta.
    let { purchaseGeneralId, purchaseConceptId } = integration;
    if (!integration.purchaseReadyAt || !purchaseGeneralId || !purchaseConceptId) {
      ({ purchaseGeneralId, purchaseConceptId } = await ensurePurchaseBranch(
        db,
        chagoTenantId,
        businessName,
        integration
      ));
    }

    const name = String(productName).trim();
    const sub = await ensureProductSubconcept(db, chagoTenantId, purchaseConceptId, {
      productId,
      productName: name,
    });
    if (sub.invalid) return res.status(400).json({ error: "productId no es un identificador válido" });
    if (sub.conflict) {
      return res.status(409).json({ error: "El subconcepto de ese producto lo ocupa un documento ajeno a la integración" });
    }

    // Idempotencia: un surtido ya recibido no se duplica. La colección la
    // comparten ventas y compras, así que un `externalId` repetido que
    // pertenezca al otro flujo es una colisión, no un reintento — devolver el
    // id de una venta aquí perdería la compra en silencio.
    const existing = await findPosTransactionByExternalId(db, chagoTenantId, externalId);
    if (existing) {
      if (existing.data().posKind !== POS_KIND_PURCHASE) {
        return res.status(409).json({ error: "Ese externalId ya lo usa otro movimiento del punto de venta" });
      }
      return res.status(200).json({ chagoTransactionId: existing.id, alreadyExisted: true });
    }

    // La descripción se arma SIEMPRE aquí, nunca se acepta del cliente: que
    // diga cuánto se compró es un requisito del cliente, no una sugerencia.
    // La unidad (kg, lt…) sí la manda el POS, pero solo como etiqueta corta; sin
    // ella queda «unidad(es)», que es lo que siempre dijo.
    const unidad = String(unit || "").trim().slice(0, 10);
    const description = [`Compra POS · ${name} · ${qty} ${unidad || "unidad(es)"}`, String(note || "").trim()]
      .filter(Boolean)
      .join(" · ");

    // Nace junto con el pago que la salda — ver `createPosTransactionWithPayment`.
    const docRef = await createPosTransactionWithPayment(db, chagoTenantId, {
      ...posTransactionBase({ amount, externalId, date, posKind: POS_KIND_PURCHASE }),
      type: "salida",
      generalId: purchaseGeneralId,
      conceptId: purchaseConceptId,
      subconceptId: sub.subconceptId,
      description,
      // `reportService.divisionBreakdown` solo suma las salidas que TIENEN
      // división; sin esto la compra existiría en el total pero desaparecería
      // del desglose y las cifras no cuadrarían. Es el mismo valor que pone
      // la captura manual.
      division: "general",
      externalFolio: null,
      posProductId: String(productId),
      posProductName: name,
      quantity: qty,
      unitCost: cost,
      ...(unidad && { posUnit: unidad }),
    });

    return res.status(201).json({ chagoTransactionId: docRef.id, subconceptId: sub.subconceptId });
  } catch (error) {
    console.error("❌ Error creando compra desde POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
