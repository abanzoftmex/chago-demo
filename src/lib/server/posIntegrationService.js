/**
 * Vínculo con punto-de-venta (POS) — un tenant de chago-demo puede recibir
 * sus ventas cobradas como Entradas automáticas.
 *
 * El token lo EMITE chago-demo (este sistema es el dueño de los datos que se
 * van a escribir) y solo se muestra una vez al generarlo — aquí solo se
 * guarda su hash (SHA-256), nunca el texto plano, así que ni una fuga de la
 * base de datos revela el secreto real. Cada llamada entrante se valida
 * hasheando el token presentado y comparando contra ese hash.
 *
 * Vive en `tenants/{tenantId}.posIntegration`, un campo más del documento
 * del tenant — no una colección aparte.
 */

import crypto from "crypto";
import admin from "../firebase/firebaseAdmin";

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const genToken = () => crypto.randomBytes(32).toString("hex");

/** Lee el bloque de integración de un tenant (o null si nunca se configuró). */
export async function getPosIntegration(tenantId) {
  const snap = await admin.firestore().collection("tenants").doc(tenantId).get();
  if (!snap.exists) return null;
  return snap.data().posIntegration || null;
}

/**
 * Genera un token nuevo para el tenant, lo activa, y devuelve el texto
 * plano UNA SOLA VEZ — el llamador debe mostrarlo y no puede recuperarlo
 * después (solo queda su hash).
 */
export async function generatePosIntegrationToken(tenantId) {
  const token = genToken();
  const tenantRef = admin.firestore().collection("tenants").doc(tenantId);
  const existing = (await tenantRef.get()).data()?.posIntegration || {};

  await tenantRef.set(
    {
      posIntegration: {
        ...existing,
        enabled: true,
        tokenHash: hashToken(token),
        linkedAt: existing.linkedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    { merge: true }
  );

  return token;
}

/** Activa/desactiva el vínculo sin tocar el token ya emitido. */
export async function setPosIntegrationEnabled(tenantId, enabled) {
  await admin
    .firestore()
    .collection("tenants")
    .doc(tenantId)
    .set(
      { posIntegration: { enabled, updatedAt: admin.firestore.FieldValue.serverTimestamp() } },
      { merge: true }
    );
}

/** Revoca el vínculo por completo — cualquier reactivación futura necesita un token nuevo. */
export async function revokePosIntegration(tenantId) {
  await admin
    .firestore()
    .collection("tenants")
    .doc(tenantId)
    .set(
      {
        posIntegration: {
          enabled: false,
          tokenHash: null,
          generalId: null,
          conceptId: null,
          subconceptIds: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

/** Guarda el catálogo (general + concepto + subconceptos) resuelto al activar. */
export async function savePosIntegrationCatalog(tenantId, { generalId, conceptId, subconceptIds }) {
  await admin
    .firestore()
    .collection("tenants")
    .doc(tenantId)
    .set(
      {
        posIntegration: {
          generalId,
          conceptId,
          subconceptIds,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
}

/**
 * Encuentra el tenant dueño de un token dado y lo valida.
 *
 * No hay forma barata de "buscar por hash" en Firestore sin un índice
 * dedicado, y esta llamada solo ocurre en el puñado de tenants que de
 * verdad tienen el módulo activado — así que se resuelve con el
 * `chagoTenantId` que manda el propio llamador (viene en el body) y aquí
 * solo se CONFIRMA que el token coincide con el de ESE tenant. Un token
 * válido de un tenant nunca sirve para otro, porque el hash comparado es
 * siempre el de `chagoTenantId`.
 */
export async function verifyPosIntegrationToken(chagoTenantId, presentedToken) {
  if (!chagoTenantId || !presentedToken) return { ok: false, error: "Faltan credenciales" };

  const integration = await getPosIntegration(chagoTenantId);
  if (!integration?.enabled || !integration?.tokenHash) {
    return { ok: false, error: "Este tenant no tiene el módulo de punto de venta activado" };
  }

  const presentedHash = hashToken(presentedToken);
  // Comparación en tiempo constante — evita filtrar por timing cuánto del
  // hash coincide.
  const a = Buffer.from(presentedHash, "hex");
  const b = Buffer.from(integration.tokenHash, "hex");
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) return { ok: false, error: "Token inválido" };
  return { ok: true, integration };
}

/** Extrae el Bearer token del header Authorization, o null si no viene. */
export function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
