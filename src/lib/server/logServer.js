/**
 * Bitácora escrita desde el SERVIDOR, con Admin SDK.
 *
 * Las rutas de administración de usuarios registran sus acciones llamando a
 * `logService`, que escribe con el SDK del navegador. Las reglas exigen ser
 * miembro activo del tenant para crear en `tenants/{id}/logs`, y una ruta de
 * API no es miembro de nada: al desplegarlas, cada alta, edición o cambio de
 * estado de usuario dejaría de quedar registrada.
 *
 * Los textos y la forma del documento son los mismos que produce `logService`,
 * a propósito: la bitácora la leen personas, y dos redacciones distintas para
 * la misma acción según quién la escribiera sería peor que no tenerla.
 *
 * Ninguna de estas funciones lanza. Perder una línea de bitácora nunca puede
 * tumbar la operación que la produjo — es el mismo criterio que ya tenía
 * `logService`.
 */

import admin from "../firebase/firebaseAdmin";

const logsPath = (tenantId) => (tenantId ? `tenants/${tenantId}/logs` : "logs");

/** Quita `undefined`, que Firestore rechaza, sin tocar el resto. */
function sanitize(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item !== undefined) out[key] = sanitize(item);
    }
    return out;
  }
  return value;
}

async function createLog(logData) {
  try {
    await admin
      .firestore()
      .collection(logsPath(logData?.tenantId))
      .add({
        ...sanitize(logData || {}),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("[logServer] No se pudo escribir la bitácora:", error.message);
  }
}

const quien = (user) => ({
  id: user?.uid || "system",
  nombre: user?.displayName || user?.email || "Usuario desconocido",
});

export async function logUserCreation({ user, userId, userData, tenantId = null }) {
  const actor = quien(user);
  return createLog({
    action: "create",
    entityType: "user",
    entityId: userId,
    entityData: userData,
    userId: actor.id,
    userName: actor.nombre,
    tenantId,
    details: `Usuario ${actor.nombre} creó la cuenta de ${userData?.displayName || userData?.email}`,
  });
}

export async function logUserStatusChange({ user, userId, userData, action, previousStatus, tenantId = null }) {
  const actor = quien(user);
  const objetivo = userData?.displayName || userData?.email;
  const verbo = action === "disable" ? "desactivó" : "activó";
  return createLog({
    action,
    entityType: "user",
    entityId: userId,
    entityData: userData,
    previousData: { isActive: previousStatus },
    userId: actor.id,
    userName: actor.nombre,
    tenantId,
    details: `Usuario ${actor.nombre} ${verbo} la cuenta de ${objetivo}`,
  });
}

export async function logUserUpdate({ user, userId, userData, previousData, tenantId = null }) {
  const actor = quien(user);
  const objetivo = userData?.displayName || userData?.email || previousData?.displayName || "Usuario sin nombre";

  // Editarse a uno mismo se redacta distinto: "actualizó su propio perfil".
  const details =
    actor.id === userId
      ? `Usuario ${actor.nombre} actualizó su propio perfil`
      : `Usuario ${actor.nombre} actualizó el perfil de ${objetivo}`;

  // Solo los campos que interesa conservar; el documento de usuario entero
  // metería ruido y datos que no hacen falta en una bitácora.
  const limpio = (data, extra = {}) =>
    data
      ? {
          displayName: data.displayName || "Sin nombre",
          role: data.role || "Sin rol",
          email: data.email || "Sin email",
          isActive: data.isActive ?? true,
          ...extra,
        }
      : null;

  return createLog({
    action: "update",
    entityType: "user",
    entityId: userId,
    entityData: limpio(userData, { updatedAt: userData?.updatedAt || new Date().toISOString() }),
    previousData: limpio(previousData, {
      createdAt: previousData?.createdAt || null,
      updatedAt: previousData?.updatedAt || null,
    }),
    userId: actor.id,
    userName: actor.nombre,
    tenantId,
    details,
  });
}

export { createLog };
