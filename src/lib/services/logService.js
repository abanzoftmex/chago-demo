import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const COLLECTION_NAME = "logs";

export const logService = {
  // Create a new log entry
  async create(logData) {
    try {
      // Remove undefined values to avoid Firestore errors
      const sanitized = Object.fromEntries(
        Object.entries(logData || {}).filter(([_, v]) => v !== undefined)
      );
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...sanitized,
        timestamp: serverTimestamp(),
      });

      return { id: docRef.id, ...logData };
    } catch (error) {
      console.error("Error creating log:", error);
      throw new Error("Error al crear el registro de log");
    }
  },

  // Get all logs with optional filters
  async getAll(filters = {}) {
    try {
      let q = collection(db, COLLECTION_NAME);

      // Apply filters
      if (filters.action) {
        if (filters.action === 'delete') {
          // Include delete logs and delete_reason logs
          q = query(q, where('action', 'in', ['delete', 'delete_reason']));
        } else {
          q = query(q, where('action', '==', filters.action));
        }
      }

      if (filters.userId) {
        q = query(q, where("userId", "==", filters.userId));
      }

      if (filters.entityType) {
        q = query(q, where("entityType", "==", filters.entityType));
      }

      if (filters.transactionType) {
        q = query(q, where("transactionType", "==", filters.transactionType));
      }

      // Apply date filters
      if (filters.startDate) {
        const startTimestamp = Timestamp.fromDate(new Date(filters.startDate));
        q = query(q, where("timestamp", ">=", startTimestamp));
      }

      if (filters.endDate) {
        const endTimestamp = Timestamp.fromDate(new Date(filters.endDate + " 23:59:59"));
        q = query(q, where("timestamp", "<=", endTimestamp));
      }

      // Apply ordering by timestamp (newest first)
      q = query(q, orderBy("timestamp", "desc"));

      // Apply pagination
      if (filters.limit) {
        const lim = typeof filters.limit === 'string' ? parseInt(filters.limit, 10) : filters.limit;
        if (lim && !Number.isNaN(lim)) {
          q = query(q, limit(lim));
        }
      }

      if (filters.startAfter) {
        q = query(q, startAfter(filters.startAfter));
      }

      const querySnapshot = await getDocs(q);
      let logs = [];

      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });

      // Apply text search filter if provided (client-side filtering)
      if (filters.searchText && filters.searchText.trim()) {
        const searchText = filters.searchText.toLowerCase().trim();
        logs = logs.filter(log => {
          const searchableFields = [
            log.details || '',
            log.userName || '',
            log.entityType || '',
            log.action || '',
            log.entityId || ''
          ].join(' ').toLowerCase();

          return searchableFields.includes(searchText);
        });
      }

      return logs;
    } catch (error) {
      console.error("Error getting logs:", error);
      throw new Error("Error al obtener los registros de log");
    }
  },

  // Log a transaction deletion
  async logTransactionDeletion({ user, transactionId, transactionData, deletionReason = null }) {
    try {
      const userId = user.uid;
      const userName = user.displayName || user.email || "Usuario desconocido";

      // Determinar si es ingreso o gasto
      const transactionType = transactionData?.type || 'desconocido';
      const transactionTypeLabel = transactionType === "entrada" ? "ingreso" : (transactionType === "salida" ? "gasto" : transactionType);

      // Construir el mensaje de detalles
      let details = `Usuario ${userName} eliminó un ${transactionTypeLabel} (${transactionId})`;
      if (deletionReason && deletionReason.trim()) {
        details += ` - Motivo: ${deletionReason.trim()}`;
      }

      return await this.create({
        action: "delete",
        entityType: "transaction",
        entityId: transactionId,
        entityData: transactionData,
        userId,
        userName,
        transactionType: transactionType, // Guardar el tipo de transacción original
        deletionReason: deletionReason || null, // Guardar el motivo si existe
        details: details
      });
    } catch (error) {
      console.error("Error logging transaction deletion:", error);
      // Don't throw error to avoid blocking the main operation
      return null;
    }
  },

  // Helper method to extract transaction type from various sources
  extractTransactionType(log) {
    // 1. Direct transactionType field
    if (log.transactionType && log.transactionType !== 'desconocido') {
      return log.transactionType;
    }

    // 2. From entityData
    if (log.entityData && log.entityData.type) {
      return log.entityData.type;
    }

    // 3. From nested entityData
    if (log.entityData && log.entityData.entityData && log.entityData.entityData.type) {
      return log.entityData.entityData.type;
    }

    // 4. Try to infer from details text
    if (log.details) {
      if (log.details.includes('ingreso')) return 'entrada';
      if (log.details.includes('gasto')) return 'salida';
    }

    return null;
  },

  // Log a transaction creation
  async logTransactionCreation({ user, transactionId, transactionData }) {
    try {
      const userId = user.uid;
      const userName = user.displayName || user.email || "Usuario desconocido";
      
      // Determinar si es ingreso o gasto
      const transactionType = transactionData.type === "entrada" ? "ingreso" : "gasto";
      
      return await this.create({
        action: "create",
        entityType: "transaction",
        entityId: transactionId,
        entityData: transactionData,
        userId,
        userName,
        transactionType: transactionData.type, // Guardar el tipo de transacción
        details: `Usuario ${userName} creó un ${transactionType} (${transactionId})`
      });
    } catch (error) {
      console.error("Error logging transaction creation:", error);
      // Don't throw error to avoid blocking the main operation
      return null;
    }
  },

  // Log a transaction update
  async logTransactionUpdate({ user, transactionId, transactionData, previousData }) {
    try {
      const userId = user.uid;
      const userName = user.displayName || user.email || "Usuario desconocido";
      
      // Determinar si es ingreso o gasto
      const transactionType = transactionData.type === "entrada" ? "ingreso" : "gasto";
      
      return await this.create({
        action: "update",
        entityType: "transaction",
        entityId: transactionId,
        entityData: transactionData,
        previousData: previousData,
        userId,
        userName,
        transactionType: transactionData.type, // Guardar el tipo de transacción
        details: `Usuario ${userName} actualizó un ${transactionType} (${transactionId})`
      });
    } catch (error) {
      console.error("Error logging transaction update:", error);
      // Don't throw error to avoid blocking the main operation
      return null;
    }
  },

  // Clear all logs - for testing purposes only
  async clearAll() {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
      
      // Create an array of promises to delete each document
      const deletePromises = [];
      
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      // Execute all delete operations
      await Promise.all(deletePromises);
      
      return { success: true, message: "Todos los registros han sido eliminados" };
    } catch (error) {
      console.error("Error clearing logs:", error);
      throw new Error("Error al limpiar los registros de actividad");
    }
  }
};