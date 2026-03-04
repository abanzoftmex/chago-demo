/**
 * Servicio de acceso a datos por tenant - Salidas
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
 * Crea una nueva salida en el tenant del usuario
 * @param {Object} salidaData - Datos de la salida
 * @param {string} userId - UID del usuario que crea la salida
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const createSalida = async (salidaData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canCreateSalidas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    // Preparar datos de la salida
    const salida = {
      ...salidaData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Agregar a la subcolección del tenant
    const salidasRef = collection(db, `tenants/${tenantId}/salidas`);
    const docRef = await addDoc(salidasRef, salida);

    console.log(`Salida creada: ${docRef.id} en tenant ${tenantId}`);
    return {
      success: true,
      salidaId: docRef.id,
      salida: { id: docRef.id, ...salida },
    };
  } catch (error) {
    console.error("Error creando salida:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene todas las salidas del tenant del usuario
 * @param {string} userId - UID del usuario
 * @param {Object} options - Opciones de filtrado y paginación
 * @returns {Promise<Object>} - Lista de salidas
 */
export const getSalidas = async (userId, options = {}) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewSalidas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    // Construir query
    let queryRef = collection(db, `tenants/${tenantId}/salidas`);
    
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

    if (options.subconcepto) {
      conditions.push(where("subconcepto", "==", options.subconcepto));
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
    const salidas = [];

    snapshot.forEach((doc) => {
      salidas.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      salidas,
      total: salidas.length,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error("Error obteniendo salidas:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene una salida específica por ID
 * @param {string} salidaId - ID de la salida
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Datos de la salida
 */
export const getSalidaById = async (salidaId, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewSalidas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const salidaRef = doc(db, `tenants/${tenantId}/salidas`, salidaId);
    const salidaSnap = await getDoc(salidaRef);

    if (!salidaSnap.exists()) {
      return {
        success: false,
        error: "Salida no encontrada",
      };
    }

    return {
      success: true,
      salida: {
        id: salidaSnap.id,
        ...salidaSnap.data(),
      },
    };
  } catch (error) {
    console.error("Error obteniendo salida:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Actualiza una salida existente
 * @param {string} salidaId - ID de la salida
 * @param {Object} updateData - Datos a actualizar
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const updateSalida = async (salidaId, updateData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canManageTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const salidaRef = doc(db, `tenants/${tenantId}/salidas`, salidaId);
    
    // Verificar que la salida existe
    const salidaSnap = await getDoc(salidaRef);
    if (!salidaSnap.exists()) {
      return {
        success: false,
        error: "Salida no encontrada",
      };
    }

    // Preparar datos de actualización
    const dataToUpdate = {
      ...updateData,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(salidaRef, dataToUpdate);

    console.log(`Salida actualizada: ${salidaId}`);
    return {
      success: true,
      salidaId,
    };
  } catch (error) {
    console.error("Error actualizando salida:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Elimina una salida
 * @param {string} salidaId - ID de la salida
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deleteSalida = async (salidaId, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canDeleteTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const salidaRef = doc(db, `tenants/${tenantId}/salidas`, salidaId);
    
    // Verificar que la salida existe
    const salidaSnap = await getDoc(salidaRef);
    if (!salidaSnap.exists()) {
      return {
        success: false,
        error: "Salida no encontrada",
      };
    }

    await deleteDoc(salidaRef);

    console.log(`Salida eliminada: ${salidaId}`);
    return {
      success: true,
      salidaId,
    };
  } catch (error) {
    console.error("Error eliminando salida:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Crea múltiples salidas en batch
 * @param {Array} salidasData - Array de datos de salidas
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const createSalidasBatch = async (salidasData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canCreateSalidas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const batch = writeBatch(db);
    const salidasRef = collection(db, `tenants/${tenantId}/salidas`);
    const createdSalidas = [];

    salidasData.forEach((salidaData) => {
      const docRef = doc(salidasRef);
      const salida = {
        ...salidaData,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(docRef, salida);
      createdSalidas.push({
        id: docRef.id,
        ...salida,
      });
    });

    await batch.commit();

    console.log(`${salidasData.length} salidas creadas en batch para tenant ${tenantId}`);
    return {
      success: true,
      salidas: createdSalidas,
      count: salidasData.length,
    };
  } catch (error) {
    console.error("Error creando salidas en batch:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene resumen de salidas por período
 * @param {string} userId - UID del usuario
 * @param {Object} period - Período de consulta {inicio, fin}
 * @returns {Promise<Object>} - Resumen de salidas
 */
export const getSalidasSummary = async (userId, period) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewSalidas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener salidas del período
    const salidasResult = await getSalidas(userId, {
      fechaInicio: period.inicio,
      fechaFin: period.fin,
    });

    if (!salidasResult.success) {
      return salidasResult;
    }

    const salidas = salidasResult.salidas;

    // Calcular resumen
    const summary = {
      total: salidas.length,
      totalAmount: salidas.reduce((sum, salida) => sum + (salida.monto || 0), 0),
      byConcepto: {},
      bySubconcepto: {},
      byProveedor: {},
      byMonth: {},
    };

    salidas.forEach((salida) => {
      // Por concepto
      const concepto = salida.concepto || "Sin concepto";
      if (!summary.byConcepto[concepto]) {
        summary.byConcepto[concepto] = { count: 0, amount: 0 };
      }
      summary.byConcepto[concepto].count++;
      summary.byConcepto[concepto].amount += salida.monto || 0;

      // Por subconcepto
      const subconcepto = salida.subconcepto || "Sin subconcepto";
      if (!summary.bySubconcepto[subconcepto]) {
        summary.bySubconcepto[subconcepto] = { count: 0, amount: 0 };
      }
      summary.bySubconcepto[subconcepto].count++;
      summary.bySubconcepto[subconcepto].amount += salida.monto || 0;

      // Por proveedor
      const proveedor = salida.proveedor || "Sin proveedor";
      if (!summary.byProveedor[proveedor]) {
        summary.byProveedor[proveedor] = { count: 0, amount: 0 };
      }
      summary.byProveedor[proveedor].count++;
      summary.byProveedor[proveedor].amount += salida.monto || 0;

      // Por mes (si tiene fecha)
      if (salida.fecha) {
        const fecha = salida.fecha.toDate ? salida.fecha.toDate() : new Date(salida.fecha);
        const monthKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
        if (!summary.byMonth[monthKey]) {
          summary.byMonth[monthKey] = { count: 0, amount: 0 };
        }
        summary.byMonth[monthKey].count++;
        summary.byMonth[monthKey].amount += salida.monto || 0;
      }
    });

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("Error obteniendo resumen de salidas:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene salidas recurrentes del tenant
 * @param {string} userId - UID del usuario
 * @param {Object} options - Opciones de filtrado
 * @returns {Promise<Object>} - Lista de salidas recurrentes
 */
export const getSalidasRecurrentes = async (userId, options = {}) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewSalidas");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener salidas marcadas como recurrentes
    const salidasResult = await getSalidas(userId, {
      ...options,
      // Filtrar solo las recurrentes si es un campo disponible
    });

    if (!salidasResult.success) {
      return salidasResult;
    }

    // Filtrar salidas recurrentes (si tienen el campo isRecurrente)
    const salidasRecurrentes = salidasResult.salidas.filter(
      salida => salida.isRecurrente === true
    );

    return {
      success: true,
      salidas: salidasRecurrentes,
      total: salidasRecurrentes.length,
    };
  } catch (error) {
    console.error("Error obteniendo salidas recurrentes:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};