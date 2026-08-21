/**
 * POST /api/integrations/pos-transactions
 *
 * Recibe una venta ya cobrada en punto-de-venta y la refleja como Entrada.
 * Llamada de sistema (Authorization: Bearer <token del vínculo>), nunca de
 * un usuario logueado en el navegador — mismo criterio que ya usan
 * api/cron/*.js en este repo.
 *
 * Idempotente por `externalId` (el _id de la venta en punto-de-venta): si ya
 * se recibió antes, devuelve la misma transacción en vez de duplicarla —
 * necesario porque punto-de-venta reintenta envíos que no confirmaron a
 * tiempo.
 *
 * "El que manda es el que envía": la transacción nace con `locked:true` y
 * `origen:'pos_sync'`. La UI de chago-demo debe ocultar edición/eliminación
 * sobre eso, y `firestore.rules` (cambio a desplegar aparte) se lo niega a
 * un usuario normal — este endpoint, con credencial de Admin SDK, no está
 * sujeto a esas reglas.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifyPosIntegrationToken, extractBearerToken } from "../../../lib/server/posIntegrationService";
import crypto from "crypto";

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } }, // el PDF adjunto va en base64 en el body
};

const VALID_PAYMENT_METHODS = ["Efectivo", "Tarjeta Débito", "Tarjeta Crédito", "Transferencia"];

async function uploadAttachment(chagoTenantId, transactionId, base64, fileName) {
  const bucket = admin.storage().bucket();
  const buffer = Buffer.from(base64, "base64");
  const path = `transactions/${transactionId}/${Date.now()}_${fileName}`;
  const file = bucket.file(path);
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: "application/pdf",
      metadata: { firebaseStorageDownloadTokens: downloadToken, originalFileName: fileName },
    },
  });

  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;

  return {
    fileName: `${Date.now()}_${fileName}`,
    fileUrl,
    fileType: "application/pdf",
    fileSize: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const token = extractBearerToken(req);
  const {
    chagoTenantId,
    externalId,
    amount,
    paymentMethod,
    folio,
    date,
    description,
    ticketPdfBase64,
  } = req.body || {};

  if (!chagoTenantId) return res.status(400).json({ error: "chagoTenantId es requerido" });
  if (!externalId) return res.status(400).json({ error: "externalId es requerido" });
  if (!(parseFloat(amount) > 0)) return res.status(400).json({ error: "amount debe ser mayor a 0" });
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ error: `paymentMethod debe ser uno de: ${VALID_PAYMENT_METHODS.join(", ")}` });
  }

  const verification = await verifyPosIntegrationToken(chagoTenantId, token);
  if (!verification.ok) return res.status(401).json({ error: verification.error });

  const { integration } = verification;
  const subconceptId = integration.subconceptIds?.[paymentMethod];
  if (!integration.conceptId || !subconceptId) {
    return res.status(409).json({
      error: "Este tenant no tiene el catálogo de Ventas POS activado — vuelve a guardar el vínculo en Torre de Control",
    });
  }

  try {
    const db = admin.firestore();
    const transaccionesRef = db.collection(`tenants/${chagoTenantId}/transacciones`);

    // Idempotencia: una venta ya recibida antes no se duplica.
    const existing = await transaccionesRef.where("externalId", "==", String(externalId)).limit(1).get();
    if (!existing.empty) {
      return res.status(200).json({ chagoTransactionId: existing.docs[0].id, alreadyExisted: true });
    }

    const amountNum = parseFloat(amount);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const transactionData = {
      type: "entrada",
      conceptId: integration.conceptId,
      subconceptId,
      description: description || `Venta POS · Folio ${folio || externalId}`,
      amount: amountNum,
      date: date ? new Date(date) : new Date(),
      providerId: "",
      status: "pagado",
      payments: [],
      totalPaid: amountNum,
      balance: 0,
      externalId: String(externalId),
      externalFolio: folio || null,
      origen: "pos_sync",
      locked: true,
      voided: false,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await transaccionesRef.add(transactionData);

    if (ticketPdfBase64) {
      try {
        const attachment = await uploadAttachment(chagoTenantId, docRef.id, ticketPdfBase64, `ticket_${folio || externalId}.pdf`);
        await docRef.update({ attachments: [attachment] });
      } catch (attachError) {
        // El adjunto es un plus, no debe tumbar la creación de la entrada ya
        // guardada — se registra y se sigue.
        console.error("⚠️ Error subiendo adjunto de venta POS (entrada ya creada):", attachError);
      }
    }

    return res.status(201).json({ chagoTransactionId: docRef.id });
  } catch (error) {
    console.error("❌ Error creando entrada desde POS:", error);
    return res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
}
