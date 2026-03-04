/**
 * Servicio de acceso a datos por tenant - Entradas
 * Todas las operaciones se realizan dentro del contexto del tenant
 */

import { db } from "../firebase/firebaseConfig";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { requirePermission } from "./roleServiceMultiTenant";
import { getUserTenantId } from "./tenantService";

/**
 * Crea una nueva entrada en el tenant del usuario
 * @param {Object} entradaData - Datos de la entrada
 * @param {string} userId - UID del usuario que crea la entrada
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const createEntrada = async (entradaData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canCreateEntradas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    // Preparar datos de la entrada
    const entrada = {
      ...entradaData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Agregar a la subcolección del tenant
    const entradasRef = collection(db, `tenants/${tenantId}/entradas`);
    const docRef = await addDoc(entradasRef, entrada);

    console.log(`Entrada creada: ${docRef.id} en tenant ${tenantId}`);
    return {
      success: true,
      entradaId: docRef.id,
      entrada: { id: docRef.id, ...entrada },
    };
  } catch (error) {
    console.error("Error creando entrada:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene todas las entradas del tenant del usuario
 * @param {string} userId - UID del usuario
 * @param {Object} options - Opciones de filtrado y paginación
 * @returns {Promise<Object>} - Lista de entradas
 */
export const getEntradas = async (userId, options = {}) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewEntradas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    // Construir query
    let queryRef = collection(db, `tenants/${tenantId}/entradas`);
    
    // Aplicar filtros
    const conditions = [];
    
    if (options.fechaInicio && options.fechaFin) {
      conditions.push(where("fecha", ">=", options.fechaInicio));
      conditions.push(where("fecha", "<=", options.fechaFin));
    }
    
    if (options.concepto) {
      conditions.push(where("concepto", "==", options.concepto));
    }
    
    if (options.proveedor) {
      conditions.push(where("proveedor", "==", options.proveedor));
    }

    // Aplicar condiciones
    if (conditions.length > 0) {
      queryRef = query(queryRef, ...conditions);
    }

    // Ordenamiento
    const orderField = options.orderBy || "createdAt";
    const orderDirection = options.orderDirection || "desc";
    queryRef = query(queryRef, orderBy(orderField, orderDirection));

    // Paginación
    if (options.limitTo) {
      queryRef = query(queryRef, limit(options.limitTo));
    }

    if (options.startAfterDoc) {
      queryRef = query(queryRef, startAfter(options.startAfterDoc));
    }

    const snapshot = await getDocs(queryRef);
    const entradas = [];

    snapshot.forEach((doc) => {
      entradas.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      entradas,
      total: entradas.length,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error("Error obteniendo entradas:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene una entrada específica por ID
 * @param {string} entradaId - ID de la entrada
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Datos de la entrada
 */
export const getEntradaById = async (entradaId, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewEntradas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const entradaRef = doc(db, `tenants/${tenantId}/entradas`, entradaId);
    const entradaSnap = await getDoc(entradaRef);

    if (!entradaSnap.exists()) {
      return {
        success: false,
        error: "Entrada no encontrada",
      };
    }

    return {
      success: true,
      entrada: {
        id: entradaSnap.id,
        ...entradaSnap.data(),
      },
    };
  } catch (error) {
    console.error("Error obteniendo entrada:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Actualiza una entrada existente
 * @param {string} entradaId - ID de la entrada
 * @param {Object} updateData - Datos a actualizar
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const updateEntrada = async (entradaId, updateData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canManageTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const entradaRef = doc(db, `tenants/${tenantId}/entradas`, entradaId);
    
    // Verificar que la entrada existe
    const entradaSnap = await getDoc(entradaRef);
    if (!entradaSnap.exists()) {
      return {
        success: false,
        error: "Entrada no encontrada",
      };
    }

    // Preparar datos de actualización
    const dataToUpdate = {
      ...updateData,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(entradaRef, dataToUpdate);

    console.log(`Entrada actualizada: ${entradaId}`);
    return {
      success: true,
      entradaId,
    };
  } catch (error) {
    console.error("Error actualizando entrada:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Elimina una entrada
 * @param {string} entradaId - ID de la entrada
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deleteEntrada = async (entradaId, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canDeleteTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const entradaRef = doc(db, `tenants/${tenantId}/entradas`, entradaId);
    
    // Verificar que la entrada existe
    const entradaSnap = await getDoc(entradaRef);
    if (!entradaSnap.exists()) {
      return {
        success: false,
        error: "Entrada no encontrada",
      };
    }

    await deleteDoc(entradaRef);

    console.log(`Entrada eliminada: ${entradaId}`);
    return {
      success: true,
      entradaId,
    };
  } catch (error) {
    console.error("Error eliminando entrada:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Crea múltiples entradas en batch
 * @param {Array} entradasData - Array de datos de entradas
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const createEntradasBatch = async (entradasData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canCreateEntradas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const batch = writeBatch(db);
    const entradasRef = collection(db, `tenants/${tenantId}/entradas`);
    const createdEntradas = [];

    entradasData.forEach((entradaData) => {
      const docRef = doc(entradasRef);
      const entrada = {
        ...entradaData,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(docRef, entrada);
      createdEntradas.push({
        id: docRef.id,
        ...entrada,
      });
    });

    await batch.commit();

    console.log(`${entradasData.length} entradas creadas en batch para tenant ${tenantId}`);
    return {
      success: true,
      entradas: createdEntradas,
      count: entradasData.length,
    };
  } catch (error) {
    console.error("Error creando entradas en batch:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene resumen de entradas por período
 * @param {string} userId - UID del usuario
 * @param {Object} period - Período de consulta {inicio, fin}
 * @returns {Promise<Object>} - Resumen de entradas
 */
export const getEntradasSummary = async (userId, period) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewEntradas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener entradas del período
    const entradasResult = await getEntradas(userId, {
      fechaInicio: period.inicio,
      fechaFin: period.fin,
    });

    if (!entradasResult.success) {
      return entradasResult;
    }

    const entradas = entradasResult.entradas;

    // Calcular resumen
    const summary = {
      total: entradas.length,
      totalAmount: entradas.reduce((sum, entrada) => sum + (entrada.monto || 0), 0),
      byConcepto: {},
      byProveedor: {},
      byMonth: {},
    };

    entradas.forEach((entrada) => {
      // Por concepto
      const concepto = entrada.concepto || "Sin concepto";
      if (!summary.byConcepto[concepto]) {
        summary.byConcepto[concepto] = { count: 0, amount: 0 };
      }
      summary.byConcepto[concepto].count++;
      summary.byConcepto[concepto].amount += entrada.monto || 0;

      // Por proveedor
      const proveedor = entrada.proveedor || "Sin proveedor";
      if (!summary.byProveedor[proveedor]) {
        summary.byProveedor[proveedor] = { count: 0, amount: 0 };
      }
      summary.byProveedor[proveedor].count++;
      summary.byProveedor[proveedor].amount += entrada.monto || 0;

      // Por mes (si tiene fecha)
      if (entrada.fecha) {
        const fecha = entrada.fecha.toDate ? entrada.fecha.toDate() : new Date(entrada.fecha);
        const monthKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
        if (!summary.byMonth[monthKey]) {
          summary.byMonth[monthKey] = { count: 0, amount: 0 };
        }
        summary.byMonth[monthKey].count++;
        summary.byMonth[monthKey].amount += entrada.monto || 0;
      }
    });

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("Error obteniendo resumen de entradas:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};