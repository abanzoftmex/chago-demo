/**
 * Helper general para operaciones de tenant
 * Funciones reutilizables para acceso a datos por tenant
 */

import { db } from "../firebase/firebaseConfig";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  getCountFromServer,
} from "firebase/firestore";
import { getUserTenantId } from "./tenantService";
import { requirePermission } from "./roleServiceMultiTenant";

/**
 * Obtiene una referencia a cualquier colección del tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} collectionName - Nombre de la colección
 * @returns {CollectionReference} - Referencia a la colección
 */
export const getTenantCollectionRef = (tenantId, collectionName) => {
  return collection(db, `tenants/${tenantId}/${collectionName}`);
};

/**
 * Obtiene una referencia a un documento específico del tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} collectionName - Nombre de la colección
 * @param {string} docId - ID del documento
 * @returns {DocumentReference} - Referencia al documento
 */
export const getTenantDocRef = (tenantId, collectionName, docId) => {
  return doc(db, `tenants/${tenantId}/${collectionName}`, docId);
};

/**
 * Cuenta documentos en una colección del tenant
 * @param {string} userId - UID del usuario
 * @param {string} collectionName - Nombre de la colección
 * @param {Array} conditions - Condiciones where opcionales
 * @returns {Promise<Object>} - Resultado con el conteo
 */
export const countTenantDocuments = async (userId, collectionName, conditions = []) => {
  try {
    const tenantId = await getUserTenantId(userId);
    let queryRef = collection(db, `tenants/${tenantId}/${collectionName}`);

    if (conditions.length > 0) {
      queryRef = query(queryRef, ...conditions);
    }

    const snapshot = await getCountFromServer(queryRef);
    return {
      success: true,
      count: snapshot.data().count,
    };
  } catch (error) {
    console.error(`Error contando documentos en ${collectionName}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene todos los documentos de una colección del tenant con paginación
 * @param {string} userId - UID del usuario
 * @param {string} collectionName - Nombre de la colección
 * @param {Object} options - Opciones de consulta
 * @returns {Promise<Object>} - Documentos y metadatos
 */
export const getTenantDocuments = async (userId, collectionName, options = {}) => {
  try {
    const tenantId = await getUserTenantId(userId);
    let queryRef = collection(db, `tenants/${tenantId}/${collectionName}`);

    // Aplicar condiciones where
    if (options.conditions && options.conditions.length > 0) {
      queryRef = query(queryRef, ...options.conditions);
    }

    // Aplicar ordenamiento
    if (options.orderBy) {
      const orderDirection = options.orderDirection || "asc";
      queryRef = query(queryRef, orderBy(options.orderBy, orderDirection));
    }

    // Aplicar límite
    if (options.limit) {
      queryRef = query(queryRef, limit(options.limit));
    }

    const snapshot = await getDocs(queryRef);
    const documents = [];

    snapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return {
      success: true,
      documents,
      total: documents.length,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error(`Error obteniendo documentos de ${collectionName}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Crea múltiples documentos en batch para una colección del tenant
 * @param {string} userId - UID del usuario
 * @param {string} collectionName - Nombre de la colección
 * @param {Array} documentsData - Array de datos de documentos
 * @param {string} permission - Permiso requerido
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const createTenantDocumentsBatch = async (userId, collectionName, documentsData, permission) => {
  try {
    // Verificar permisos si se especifica
    if (permission) {
      const permissionCheck = await requirePermission(userId, permission);
      if (!permissionCheck.success) {
        return permissionCheck;
      }
    }

    const tenantId = await getUserTenantId(userId);
    const batch = writeBatch(db);
    const collectionRef = collection(db, `tenants/${tenantId}/${collectionName}`);
    const createdDocuments = [];

    documentsData.forEach((docData) => {
      const docRef = doc(collectionRef);
      const documentWithMetadata = {
        ...docData,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(docRef, documentWithMetadata);
      createdDocuments.push({
        id: docRef.id,
        ...documentWithMetadata,
      });
    });

    await batch.commit();

    console.log(`${documentsData.length} documentos creados en batch para ${collectionName}`);
    return {
      success: true,
      documents: createdDocuments,
      count: documentsData.length,
    };
  } catch (error) {
    console.error(`Error creando documentos en batch para ${collectionName}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Busca documentos en múltiples colecciones del tenant
 * @param {string} userId - UID del usuario
 * @param {Array} collections - Array de nombres de colecciones
 * @param {string} searchTerm - Término de búsqueda
 * @param {Array} searchFields - Campos donde buscar
 * @returns {Promise<Object>} - Resultados de búsqueda agrupados
 */
export const searchInTenantCollections = async (userId, collections, searchTerm, searchFields = []) => {
  try {
    const tenantId = await getUserTenantId(userId);
    const searchTermLower = searchTerm.toLowerCase();
    const results = {};

    // Buscar en cada colección
    for (const collectionName of collections) {
      const docsResult = await getTenantDocuments(userId, collectionName, {
        // Obtener todos los documentos para hacer búsqueda local
        // En una implementación real, consideraría usar Algolia o similar para búsquedas de texto
      });

      if (docsResult.success) {
        const filteredDocs = docsResult.documents.filter((doc) => {
          // Si no se especifican campos, buscar en todos los campos de texto
          const fieldsToSearch = searchFields.length > 0 ? searchFields : Object.keys(doc);
          
          return fieldsToSearch.some(field => {
            const value = doc[field];
            return value && typeof value === 'string' && value.toLowerCase().includes(searchTermLower);
          });
        });

        results[collectionName] = {
          documents: filteredDocs,
          count: filteredDocs.length,
        };
      } else {
        results[collectionName] = {
          documents: [],
          count: 0,
          error: docsResult.error,
        };
      }
    }

    // Calcular totales
    const totalResults = Object.values(results).reduce((sum, result) => sum + result.count, 0);

    return {
      success: true,
      results,
      searchTerm,
      totalResults,
      collectionsSearched: collections,
    };
  } catch (error) {
    console.error("Error en búsqueda multi-colección:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Obtiene un resumen rápido del tenant (conteos de documentos)
 * @param {string} userId - UID del usuario
 * @param {Array} collections - Colecciones a incluir en el resumen
 * @returns {Promise<Object>} - Resumen del tenant
 */
export const getTenantSummary = async (userId, collections = ['entradas', 'salidas', 'transacciones']) => {
  try {
    const tenantId = await getUserTenantId(userId);
    const summary = {
      tenantId,
      collections: {},
      timestamp: new Date().toISOString(),
    };

    // Obtener conteos para cada colección
    for (const collectionName of collections) {
      const countResult = await countTenantDocuments(userId, collectionName);
      if (countResult.success) {
        summary.collections[collectionName] = {
          count: countResult.count,
        };
      } else {
        summary.collections[collectionName] = {
          count: 0,
          error: countResult.error,
        };
      }
    }

    return {
      success: true,
      summary,
    };
  } catch (error) {
    console.error("Error obteniendo resumen del tenant:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Valida que un usuario tenga acceso a un tenant específico
 * @param {string} userId - UID del usuario
 * @param {string} targetTenantId - ID del tenant objetivo
 * @returns {Promise<boolean>} - True si tiene acceso
 */
export const validateUserTenantAccess = async (userId, targetTenantId) => {
  try {
    const userTenantId = await getUserTenantId(userId);
    return userTenantId === targetTenantId;
  } catch (error) {
    console.error("Error validando acceso al tenant:", error);
    return false;
  }
};

/**
 * Obtiene metadatos de auditoría para un documento
 * @param {Object} document - Documento a auditar
 * @returns {Object} - Metadatos de auditoría
 */
export const extractAuditMetadata = (document) => {
  return {
    createdBy: document.createdBy || null,
    createdAt: document.createdAt || null,
    updatedBy: document.updatedBy || null,
    updatedAt: document.updatedAt || null,
    lastModified: document.updatedAt || document.createdAt || null,
  };
};

/**
 * Formatea fechas de Firestore para visualización
 * @param {Object} document - Documento con fechas
 * @param {Array} dateFields - Campos que contienen fechas
 * @returns {Object} - Documento con fechas formateadas
 */
export const formatFirestoreDates = (document, dateFields = ['createdAt', 'updatedAt', 'fecha']) => {
  const formatted = { ...document };

  dateFields.forEach(field => {
    if (formatted[field]) {
      // Si es un Timestamp de Firestore
      if (formatted[field].toDate) {
        formatted[field] = formatted[field].toDate();
      }
      // Si es un string de fecha
      else if (typeof formatted[field] === 'string') {
        formatted[field] = new Date(formatted[field]);
      }
    }
  });

  return formatted;
};

/**
 * Agrupa documentos por un campo específico
 * @param {Array} documents - Documentos a agrupar
 * @param {string} groupBy - Campo por el cual agrupar
 * @param {Function} aggregator - Función de agregación personalizada
 * @returns {Object} - Documentos agrupados
 */
export const groupDocumentsBy = (documents, groupBy, aggregator = null) => {
  const grouped = {};

  documents.forEach(doc => {
    const key = doc[groupBy] || 'Sin especificar';
    
    if (!grouped[key]) {
      grouped[key] = {
        items: [],
        count: 0,
        // Campos para agregación básica
        totalAmount: 0,
      };
    }

    grouped[key].items.push(doc);
    grouped[key].count++;

    // Agregación básica de monto si existe
    if (doc.monto && typeof doc.monto === 'number') {
      grouped[key].totalAmount += doc.monto;
    }

    // Agregación personalizada
    if (aggregator && typeof aggregator === 'function') {
      grouped[key] = aggregator(grouped[key], doc);
    }
  });

  return grouped;
};

/**
 * Genera un reporte básico para cualquier colección del tenant
 * @param {string} userId - UID del usuario
 * @param {string} collectionName - Nombre de la colección
 * @param {Object} options - Opciones del reporte
 * @returns {Promise<Object>} - Reporte generado
 */
export const generateBasicTenantReport = async (userId, collectionName, options = {}) => {
  try {
    const permissionCheck = await requirePermission(userId, "canViewReports");
    if (!permissionCheck.success) {
      return permissionCheck;
    }

    const docsResult = await getTenantDocuments(userId, collectionName, options.queryOptions || {});
    
    if (!docsResult.success) {
      return docsResult;
    }

    const documents = docsResult.documents;

    const report = {
      collectionName,
      totalDocuments: documents.length,
      dateRange: options.dateRange || null,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAmount: documents.reduce((sum, doc) => sum + (doc.monto || 0), 0),
        averageAmount: documents.length > 0 
          ? documents.reduce((sum, doc) => sum + (doc.monto || 0), 0) / documents.length 
          : 0,
      },
      groupedBy: {},
    };

    // Agrupar por campos solicitados
    if (options.groupBy && Array.isArray(options.groupBy)) {
      options.groupBy.forEach(field => {
        report.groupedBy[field] = groupDocumentsBy(documents, field);
      });
    }

    return {
      success: true,
      report,
    };
  } catch (error) {
    console.error(`Error generando reporte para ${collectionName}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};