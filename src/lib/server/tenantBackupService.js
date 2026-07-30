/**
 * Servicio de copias de seguridad y limpieza de datos por tenant.
 *
 * - Exporta todas las subcolecciones del tenant a un JSON restaurable.
 * - El archivo se guarda en Firebase Storage (tenant-backups/{tenantId}/{backupId}.json)
 *   y sus metadatos en la colección raíz `tenantBackups` de Firestore.
 * - La limpieza elimina todas las subcolecciones del tenant excepto las
 *   preservadas (usuarios/members); el documento raíz del tenant no se toca.
 * - La restauración reemplaza los datos actuales por los del respaldo,
 *   conservando siempre los usuarios actuales.
 *
 * Solo debe usarse desde API routes protegidas por la sesión de setup.
 */

import admin from "../firebase/firebaseAdmin";

const BACKUPS_COLLECTION = "tenantBackups";
const STORAGE_FOLDER = "tenant-backups";
const BACKUP_VERSION = 1;

// Tamaño de chunk (bytes) para el fallback en Firestore: 700 KB en base64
// (~933 KB) queda debajo del límite de 1 MiB por documento.
const CHUNK_BYTES = 700_000;

// Subcolecciones que nunca se eliminan ni se sobrescriben al restaurar
export const PRESERVED_COLLECTIONS = ["members"];

export class BackupError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const { Timestamp, GeoPoint } = admin.firestore;

/**
 * Convierte valores de Firestore (Timestamp, GeoPoint, referencias, bytes)
 * a un formato JSON con marcadores __type para poder restaurarlos.
 */
const serializeValue = (value) => {
  if (value === null || value === undefined) return value;

  if (value instanceof Timestamp) {
    return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }

  if (value instanceof GeoPoint) {
    return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }

  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  }

  if (typeof value === "object" && typeof value.path === "string" && typeof value.get === "function") {
    return { __type: "documentRef", path: value.path };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = serializeValue(item);
    }
    return result;
  }

  return value;
};

const deserializeValue = (value) => {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }

  if (typeof value === "object") {
    switch (value.__type) {
      case "timestamp":
        return new Timestamp(value.seconds, value.nanoseconds);
      case "geopoint":
        return new GeoPoint(value.latitude, value.longitude);
      case "bytes":
        return Buffer.from(value.base64, "base64");
      case "documentRef":
        return admin.firestore().doc(value.path);
      default: {
        const result = {};
        for (const [key, item] of Object.entries(value)) {
          result[key] = deserializeValue(item);
        }
        return result;
      }
    }
  }

  return value;
};

// El nombre del bucket configurado puede no existir (proyectos nuevos usan
// {projectId}.firebasestorage.app en lugar de {projectId}.appspot.com, o
// Storage puede no estar habilitado). Se prueban candidatos una sola vez y,
// si ninguno existe, los respaldos se guardan en Firestore por chunks.
let cachedBucket = null;
let bucketResolved = false;

const resolveBackupBucket = async () => {
  if (bucketResolved) return cachedBucket;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const candidates = [
    process.env.FIREBASE_STORAGE_BUCKET,
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    projectId ? `${projectId}.firebasestorage.app` : null,
    projectId ? `${projectId}.appspot.com` : null,
  ].filter((name, index, list) => name && list.indexOf(name) === index);

  for (const name of candidates) {
    try {
      const bucket = admin.storage().bucket(name);
      const [exists] = await bucket.exists();
      if (exists) {
        cachedBucket = bucket;
        break;
      }
    } catch (error) {
      console.warn(`Bucket de Storage no disponible (${name}):`, error.message);
    }
  }

  bucketResolved = true;

  if (!cachedBucket) {
    console.warn(
      "⚠️ Ningún bucket de Storage disponible; los respaldos se guardarán en Firestore por chunks."
    );
  }

  return cachedBucket;
};

const getTenantRef = async (tenantId) => {
  if (!tenantId || typeof tenantId !== "string") {
    throw new BackupError(400, "El tenant es requerido");
  }

  const tenantRef = admin.firestore().collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();

  if (!tenantSnap.exists) {
    throw new BackupError(404, "Tenant no encontrado");
  }

  return { tenantRef, tenantSnap };
};

/**
 * Exporta el documento raíz del tenant y todas sus subcolecciones
 * (una por una, tal como existen en Firestore) a un objeto JSON.
 */
export const exportTenant = async (tenantId) => {
  const { tenantRef, tenantSnap } = await getTenantRef(tenantId);

  const collections = {};
  const collectionRefs = await tenantRef.listCollections();

  for (const collectionRef of collectionRefs) {
    const snapshot = await collectionRef.get();
    collections[collectionRef.id] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      data: serializeValue(docSnap.data()),
    }));
  }

  return {
    version: BACKUP_VERSION,
    tenantId,
    nombreEmpresa: tenantSnap.data().nombreEmpresa || null,
    exportedAt: new Date().toISOString(),
    tenantDoc: serializeValue(tenantSnap.data()),
    collections,
  };
};

/**
 * Crea una copia de seguridad completa del tenant.
 * @param {string} tenantId
 * @param {Object} options - { type: 'manual' | 'pre-wipe' | 'pre-restore', note }
 * @returns {Promise<Object>} - Metadatos del respaldo creado
 */
export const createBackup = async (tenantId, { type = "manual", note = null } = {}) => {
  const firestore = admin.firestore();
  const exportData = await exportTenant(tenantId);

  const backupRef = firestore.collection(BACKUPS_COLLECTION).doc();
  const jsonBuffer = Buffer.from(JSON.stringify(exportData), "utf8");

  const bucket = await resolveBackupBucket();
  let storagePath = null;
  let storageMode = "firestore-chunks";
  let chunkCount = 0;

  if (bucket) {
    storagePath = `${STORAGE_FOLDER}/${tenantId}/${backupRef.id}.json`;
    await bucket.file(storagePath).save(jsonBuffer, {
      metadata: { contentType: "application/json" },
    });
    storageMode = "storage";
  } else {
    const writer = firestore.bulkWriter();
    for (let offset = 0; offset < jsonBuffer.length; offset += CHUNK_BYTES) {
      const index = chunkCount;
      writer.set(backupRef.collection("chunks").doc(String(index).padStart(6, "0")), {
        index,
        data: jsonBuffer.subarray(offset, offset + CHUNK_BYTES).toString("base64"),
      });
      chunkCount += 1;
    }
    await writer.close();
  }

  const collectionCounts = {};
  let totalDocs = 0;
  for (const [name, docs] of Object.entries(exportData.collections)) {
    collectionCounts[name] = docs.length;
    totalDocs += docs.length;
  }

  await backupRef.set({
    tenantId,
    nombreEmpresa: exportData.nombreEmpresa,
    type,
    note,
    storageMode,
    storagePath,
    chunkCount,
    sizeBytes: jsonBuffer.length,
    totalDocs,
    collectionCounts,
    version: BACKUP_VERSION,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    backupId: backupRef.id,
    tenantId,
    type,
    storageMode,
    storagePath,
    sizeBytes: jsonBuffer.length,
    totalDocs,
    collectionCounts,
  };
};

/**
 * Elimina todas las subcolecciones del tenant excepto las preservadas.
 * El documento raíz del tenant (nombreEmpresa, ownerUid, etc.) se conserva.
 */
export const wipeTenantData = async (tenantId) => {
  const firestore = admin.firestore();
  const { tenantRef } = await getTenantRef(tenantId);

  const collectionRefs = await tenantRef.listCollections();
  const deletedCollections = {};

  for (const collectionRef of collectionRefs) {
    if (PRESERVED_COLLECTIONS.includes(collectionRef.id)) continue;

    const countSnap = await collectionRef.count().get();
    await firestore.recursiveDelete(collectionRef);
    deletedCollections[collectionRef.id] = countSnap.data().count;
  }

  const deletedDocs = Object.values(deletedCollections).reduce((sum, count) => sum + count, 0);

  return { tenantId, deletedDocs, deletedCollections };
};

/**
 * Devuelve el contenido JSON crudo de un respaldo (Storage o chunks de
 * Firestore, según cómo se haya guardado) junto con sus metadatos.
 */
export const getBackupFileBuffer = async (backupId) => {
  if (!backupId || typeof backupId !== "string") {
    throw new BackupError(400, "El respaldo es requerido");
  }

  const backupRef = admin.firestore().collection(BACKUPS_COLLECTION).doc(backupId);
  const metaSnap = await backupRef.get();

  if (!metaSnap.exists) {
    throw new BackupError(404, "Respaldo no encontrado");
  }

  const meta = metaSnap.data();
  let jsonBuffer;

  if (meta.storagePath) {
    const bucket = await resolveBackupBucket();
    if (!bucket) {
      throw new BackupError(500, "El bucket de Storage del respaldo no está disponible");
    }
    [jsonBuffer] = await bucket.file(meta.storagePath).download();
  } else {
    const chunksSnap = await backupRef.collection("chunks").orderBy("index").get();

    if (chunksSnap.empty) {
      throw new BackupError(404, "El contenido del respaldo no se encontró");
    }

    jsonBuffer = Buffer.concat(
      chunksSnap.docs.map((chunkDoc) => Buffer.from(chunkDoc.data().data, "base64"))
    );
  }

  return { backupId, meta, jsonBuffer };
};

/**
 * Carga un respaldo (metadatos + contenido JSON parseado).
 */
export const loadBackup = async (backupId) => {
  const { meta, jsonBuffer } = await getBackupFileBuffer(backupId);
  return { backupId, meta, data: JSON.parse(jsonBuffer.toString("utf8")) };
};

/**
 * Restaura los datos del tenant desde un respaldo.
 * Primero limpia los datos actuales (excepto usuarios) y luego escribe
 * los documentos del respaldo. Los usuarios actuales nunca se sobrescriben
 * y el documento raíz del tenant no se modifica.
 */
export const restoreBackup = async (backupId) => {
  const { meta, data } = await loadBackup(backupId);
  const tenantId = meta.tenantId;

  // Verifica que el tenant siga existiendo antes de tocar nada
  await getTenantRef(tenantId);

  await wipeTenantData(tenantId);

  const firestore = admin.firestore();
  const writer = firestore.bulkWriter();
  const restoredCollections = {};
  let restoredDocs = 0;

  for (const [collectionName, docs] of Object.entries(data.collections || {})) {
    if (PRESERVED_COLLECTIONS.includes(collectionName)) continue;

    for (const { id, data: docData } of docs) {
      writer.set(
        firestore.collection("tenants").doc(tenantId).collection(collectionName).doc(id),
        deserializeValue(docData)
      );
      restoredDocs += 1;
    }
    restoredCollections[collectionName] = docs.length;
  }

  await writer.close();

  return { tenantId, backupId, restoredDocs, restoredCollections };
};

/**
 * Lista los respaldos registrados, opcionalmente filtrados por tenant.
 * El ordenamiento se hace en memoria para no requerir índices compuestos.
 */
export const listBackups = async (tenantId = null) => {
  let query = admin.firestore().collection(BACKUPS_COLLECTION);
  if (tenantId) {
    query = query.where("tenantId", "==", tenantId);
  }

  const snapshot = await query.get();
  const backups = snapshot.docs.map((docSnap) => {
    const backupData = docSnap.data();
    return {
      id: docSnap.id,
      ...backupData,
      createdAt: backupData.createdAt?.toDate?.()?.toISOString() || null,
    };
  });

  backups.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  return backups;
};

/**
 * Elimina un respaldo: el archivo de Storage (si existe), los chunks de
 * Firestore y sus metadatos.
 */
export const deleteBackup = async (backupId) => {
  if (!backupId || typeof backupId !== "string") {
    throw new BackupError(400, "El respaldo es requerido");
  }

  const firestore = admin.firestore();
  const backupRef = firestore.collection(BACKUPS_COLLECTION).doc(backupId);
  const metaSnap = await backupRef.get();

  if (!metaSnap.exists) {
    throw new BackupError(404, "Respaldo no encontrado");
  }

  const { storagePath, tenantId } = metaSnap.data();

  if (storagePath) {
    try {
      const bucket = await resolveBackupBucket();
      if (bucket) {
        await bucket.file(storagePath).delete({ ignoreNotFound: true });
      }
    } catch (error) {
      console.warn("No se pudo eliminar el archivo del respaldo en Storage:", error.message);
    }
  }

  // Elimina el documento de metadatos junto con la subcolección de chunks
  await firestore.recursiveDelete(backupRef);

  return { backupId, tenantId };
};

/**
 * Registra un evento en el activityLog del tenant (best-effort).
 */
export const logTenantActivity = async (tenantId, entry) => {
  try {
    await admin
      .firestore()
      .collection("tenants")
      .doc(tenantId)
      .collection("activityLog")
      .add({
        ...entry,
        tenantId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("No se pudo registrar la actividad del tenant:", error.message);
  }
};
