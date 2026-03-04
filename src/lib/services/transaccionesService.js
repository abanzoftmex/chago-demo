/**
 * Servicio de acceso a datos por tenant - Transacciones
 * Maneja todas las transacciones (entradas y salidas) del tenant
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
  collectionGroup,
} from "firebase/firestore";
import { requirePermission } from "./roleServiceMultiTenant";
import { getUserTenantId } from "./tenantService";

/**
 * Crea una nueva transacción en el tenant del usuario
 * @param {Object} transactionData - Datos de la transacción
 * @param {string} userId - UID del usuario que crea la transacción
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const createTransaccion = async (transactionData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canManageTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    // Preparar datos de la transacción
    const transaccion = {
      ...transactionData,
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Agregar a la subcolección del tenant
    const transaccionesRef = collection(db, `tenants/${tenantId}/transacciones`);
    const docRef = await addDoc(transaccionesRef, transaccion);

    console.log(`Transacción creada: ${docRef.id} en tenant ${tenantId}`);
    return {
      success: true,
      transaccionId: docRef.id,
      transaccion: { id: docRef.id, ...transaccion },
    };
  } catch (error) {
    console.error("Error creando transacción:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene todas las transacciones del tenant del usuario
 * @param {string} userId - UID del usuario
 * @param {Object} options - Opciones de filtrado y paginación
 * @returns {Promise<Object>} - Lista de transacciones
 */
export const getTransacciones = async (userId, options = {}) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewHistorial");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    // Construir query
    let queryRef = collection(db, `tenants/${tenantId}/transacciones`);
    
    // Aplicar filtros
    const conditions = [];
    
    if (options.fechaInicio && options.fechaFin) {
      conditions.push(where("fecha", ">=", options.fechaInicio));
      conditions.push(where("fecha", "<=", options.fechaFin));
    }
    
    if (options.tipo) {
      conditions.push(where("tipo", "==", options.tipo)); // 'entrada' | 'salida'
    }
    
    if (options.concepto) {
      conditions.push(where("concepto", "==", options.concepto));
    }
    
    if (options.proveedor) {
      conditions.push(where("proveedor", "==", options.proveedor));
    }

    if (options.metodoPago) {
      conditions.push(where("metodoPago", "==", options.metodoPago));
    }

    if (options.montoMin && options.montoMax) {
      conditions.push(where("monto", ">=", options.montoMin));
      conditions.push(where("monto", "<=", options.montoMax));
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
    const transacciones = [];

    snapshot.forEach((doc) => {
      transacciones.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      transacciones,
      total: transacciones.length,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error("Error obteniendo transacciones:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene una transacción específica por ID
 * @param {string} transaccionId - ID de la transacción
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Datos de la transacción
 */
export const getTransaccionById = async (transaccionId, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewHistorial");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const transaccionRef = doc(db, `tenants/${tenantId}/transacciones`, transaccionId);
    const transaccionSnap = await getDoc(transaccionRef);

    if (!transaccionSnap.exists()) {
      return {
        success: false,
        error: "Transacción no encontrada",
      };
    }

    return {
      success: true,
      transaccion: {
        id: transaccionSnap.id,
        ...transaccionSnap.data(),
      },
    };
  } catch (error) {
    console.error("Error obteniendo transacción:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Actualiza una transacción existente
 * @param {string} transaccionId - ID de la transacción
 * @param {Object} updateData - Datos a actualizar
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const updateTransaccion = async (transaccionId, updateData, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canManageTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const transaccionRef = doc(db, `tenants/${tenantId}/transacciones`, transaccionId);
    
    // Verificar que la transacción existe
    const transaccionSnap = await getDoc(transaccionRef);
    if (!transaccionSnap.exists()) {
      return {
        success: false,
        error: "Transacción no encontrada",
      };
    }

    // Preparar datos de actualización
    const dataToUpdate = {
      ...updateData,
      updatedBy: userId,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(transaccionRef, dataToUpdate);

    console.log(`Transacción actualizada: ${transaccionId}`);
    return {
      success: true,
      transaccionId,
    };
  } catch (error) {
    console.error("Error actualizando transacción:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Elimina una transacción
 * @param {string} transaccionId - ID de la transacción
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deleteTransaccion = async (transaccionId, userId) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canDeleteTransactions");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener tenantId del usuario
    const tenantId = await getUserTenantId(userId);
    
    const transaccionRef = doc(db, `tenants/${tenantId}/transacciones`, transaccionId);
    
    // Verificar que la transacción existe
    const transaccionSnap = await getDoc(transaccionRef);
    if (!transaccionSnap.exists()) {
      return {
        success: false,
        error: "Transacción no encontrada",
      };
    }

    await deleteDoc(transaccionRef);

    console.log(`Transacción eliminada: ${transaccionId}`);
    return {
      success: true,
      transaccionId,
    };
  } catch (error) {
    console.error("Error eliminando transacción:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene resumen financiero del tenant por período
 * @param {string} userId - UID del usuario
 * @param {Object} period - Período de consulta {inicio, fin}
 * @returns {Promise<Object>} - Resumen financiero
 */
export const getResumenFinanciero = async (userId, period) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewReports");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener transacciones del período
    const transaccionesResult = await getTransacciones(userId, {
      fechaInicio: period.inicio,
      fechaFin: period.fin,
    });

    if (!transaccionesResult.success) {
      return transaccionesResult;
    }

    const transacciones = transaccionesResult.transacciones;

    // Separar entradas y salidas
    const entradas = transacciones.filter(t => t.tipo === "entrada");
    const salidas = transacciones.filter(t => t.tipo === "salida");

    // Calcular totales
    const totalEntradas = entradas.reduce((sum, t) => sum + (t.monto || 0), 0);
    const totalSalidas = salidas.reduce((sum, t) => sum + (t.monto || 0), 0);
    const balanceNeto = totalEntradas - totalSalidas;

    // Resumen por concepto
    const conceptos = {};
    transacciones.forEach((transaccion) => {
      const concepto = transaccion.concepto || "Sin concepto";
      if (!conceptos[concepto]) {
        conceptos[concepto] = {
          entradas: { count: 0, amount: 0 },
          salidas: { count: 0, amount: 0 },
        };
      }

      if (transaccion.tipo === "entrada") {
        conceptos[concepto].entradas.count++;
        conceptos[concepto].entradas.amount += transaccion.monto || 0;
      } else {
        conceptos[concepto].salidas.count++;
        conceptos[concepto].salidas.amount += transaccion.monto || 0;
      }
    });

    // Resumen por método de pago
    const metodosPago = {};
    transacciones.forEach((transaccion) => {
      const metodo = transaccion.metodoPago || "Sin especificar";
      if (!metodosPago[metodo]) {
        metodosPago[metodo] = { count: 0, amount: 0 };
      }
      metodosPago[metodo].count++;
      metodosPago[metodo].amount += transaccion.monto || 0;
    });

    // Resumen por mes
    const meses = {};
    transacciones.forEach((transaccion) => {
      if (transaccion.fecha) {
        const fecha = transaccion.fecha.toDate ? transaccion.fecha.toDate() : new Date(transaccion.fecha);
        const monthKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`;
        if (!meses[monthKey]) {
          meses[monthKey] = {
            entradas: { count: 0, amount: 0 },
            salidas: { count: 0, amount: 0 },
          };
        }

        if (transaccion.tipo === "entrada") {
          meses[monthKey].entradas.count++;
          meses[monthKey].entradas.amount += transaccion.monto || 0;
        } else {
          meses[monthKey].salidas.count++;
          meses[monthKey].salidas.amount += transaccion.monto || 0;
        }
      }
    });

    const resumen = {
      periodo: period,
      totales: {
        entradas: {
          count: entradas.length,
          amount: totalEntradas,
        },
        salidas: {
          count: salidas.length,
          amount: totalSalidas,
        },
        balance: balanceNeto,
        transaccionesTotales: transacciones.length,
      },
      desglosePorConcepto: conceptos,
      desglosePorMetodoPago: metodosPago,
      desglosePorMes: meses,
    };

    return {
      success: true,
      resumen,
    };
  } catch (error) {
    console.error("Error obteniendo resumen financiero:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Busca transacciones por texto libre
 * @param {string} userId - UID del usuario
 * @param {string} searchTerm - Término de búsqueda
 * @param {Object} options - Opciones adicionales de filtrado
 * @returns {Promise<Object>} - Resultados de la búsqueda
 */
export const searchTransacciones = async (userId, searchTerm, options = {}) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewHistorial");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener todas las transacciones del período especificado
    const transaccionesResult = await getTransacciones(userId, options);

    if (!transaccionesResult.success) {
      return transaccionesResult;
    }

    const transacciones = transaccionesResult.transacciones;

    // Filtrar por texto en múltiples campos
    const searchTermLower = searchTerm.toLowerCase();
    const filteredTransacciones = transacciones.filter((transaccion) => {
      const searchFields = [
        transaccion.concepto,
        transaccion.subconcepto,
        transaccion.descripcion,
        transaccion.proveedor,
        transaccion.referencia,
        transaccion.notas,
      ];

      return searchFields.some(field => 
        field && field.toLowerCase().includes(searchTermLower)
      );
    });

    return {
      success: true,
      transacciones: filteredTransacciones,
      total: filteredTransacciones.length,
      searchTerm: searchTerm,
    };
  } catch (error) {
    console.error("Error buscando transacciones:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene estadísticas avanzadas del tenant
 * @param {string} userId - UID del usuario
 * @param {Object} period - Período de análisis
 * @returns {Promise<Object>} - Estadísticas detalladas
 */
export const getEstadisticasAvanzadas = async (userId, period) => {
  try {
    // Verificar permisos
    const permissionCheck = await requirePermission(userId, "canViewReports");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    // Obtener resumen financiero base
    const resumenResult = await getResumenFinanciero(userId, period);
    if (!resumenResult.success) {
      return resumenResult;
    }

    const resumen = resumenResult.resumen;

    // Calcular promedios mensuales
    const mesesConDatos = Object.keys(resumen.desglosePorMes);
    const promedioMensual = {
      entradas: mesesConDatos.length > 0 
        ? resumen.totales.entradas.amount / mesesConDatos.length 
        : 0,
      salidas: mesesConDatos.length > 0 
        ? resumen.totales.salidas.amount / mesesConDatos.length 
        : 0,
    };

    // Top conceptos por monto
    const conceptosByMonto = Object.entries(resumen.desglosePorConcepto)
      .map(([concepto, data]) => ({
        concepto,
        totalEntradas: data.entradas.amount,
        totalSalidas: data.salidas.amount,
        balance: data.entradas.amount - data.salidas.amount,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 10);

    // Análisis de tendencias (comparar primer y último mes)
    let tendencia = null;
    if (mesesConDatos.length >= 2) {
      const primerMes = resumen.desglosePorMes[mesesConDatos[0]];
      const ultimoMes = resumen.desglosePorMes[mesesConDatos[mesesConDatos.length - 1]];
      
      tendencia = {
        entradas: {
          cambio: ultimoMes.entradas.amount - primerMes.entradas.amount,
          porcentaje: primerMes.entradas.amount > 0 
            ? ((ultimoMes.entradas.amount - primerMes.entradas.amount) / primerMes.entradas.amount) * 100
            : 0,
        },
        salidas: {
          cambio: ultimoMes.salidas.amount - primerMes.salidas.amount,
          porcentaje: primerMes.salidas.amount > 0 
            ? ((ultimoMes.salidas.amount - primerMes.salidas.amount) / primerMes.salidas.amount) * 100
            : 0,
        },
      };
    }

    const estadisticas = {
      ...resumen,
      promedioMensual,
      topConceptos: conceptosByMonto,
      tendencias: tendencia,
      metricas: {
        transaccionPromedio: resumen.totales.transaccionesTotales > 0 
          ? (resumen.totales.entradas.amount + resumen.totales.salidas.amount) / resumen.totales.transaccionesTotales
          : 0,
        ratioEntradasSalidas: resumen.totales.salidas.amount > 0 
          ? resumen.totales.entradas.amount / resumen.totales.salidas.amount
          : 0,
        mesesAnalizados: mesesConDatos.length,
      },
    };

    return {
      success: true,
      estadisticas,
    };
  } catch (error) {
    console.error("Error obteniendo estadísticas avanzadas:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};