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
  // Función auxiliar para sanitizar datos complejos
  sanitizeData(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    // Manejar objetos Timestamp de Firebase
    if (obj && typeof obj === 'object' && obj._seconds !== undefined) {
      return new Date(obj._seconds * 1000 + (obj._nanoseconds || 0) / 1000000).toISOString();
    }

    // Manejar objetos Timestamp de Firestore Admin SDK
    if (obj && typeof obj === 'object' && obj.toDate && typeof obj.toDate === 'function') {
      try {
        return obj.toDate().toISOString();
      } catch (error) {
        return obj.toString();
      }
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeData(item));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }

    // Para cualquier otro tipo, intentar convertir a string
    try {
      return String(obj);
    } catch (error) {
      return null;
    }
  },

  // Create a new log entry
  async create(logData) {
    try {
      // Sanitize complex data to avoid Firestore errors
      const sanitized = this.sanitizeData(logData || {});

      const finalData = {
        ...sanitized,
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, COLLECTION_NAME), finalData);

      return { id: docRef.id, ...logData };
    } catch (error) {
      console.error("Error creating log:", error);
      console.error("Error details:", error.message);
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

  // Log user creation
  async logUserCreation({ user, userId, userData }) {
    try {
      const currentUserId = user.uid;
      const currentUserName = user.displayName || user.email || "Usuario desconocido";

      return await this.create({
        action: "create",
        entityType: "user",
        entityId: userId,
        entityData: userData,
        userId: currentUserId,
        userName: currentUserName,
        details: `Usuario ${currentUserName} creó la cuenta de ${userData.displayName || userData.email}`
      });
    } catch (error) {
      console.error("Error logging user creation:", error);
      return null;
    }
  },

  // Log user update
  async logUserUpdate({ user, userId, userData, previousData }) {
    try {
      console.log("=== LOG USER UPDATE DEBUG ===");
      console.log("User performing action:", user);
      console.log("Target userId:", userId);
      console.log("Updated userData:", userData);
      console.log("Previous userData:", previousData);

      const currentUserId = user.uid;
      const currentUserName = user.displayName || user.email || "Usuario desconocido";
      const targetUserName = userData?.displayName || userData?.email || previousData?.displayName || "Usuario sin nombre";

      let details = `Usuario ${currentUserName} actualizó el perfil de ${targetUserName}`;

      // Si es auto-edición
      if (currentUserId === userId) {
        details = `Usuario ${currentUserName} actualizó su propio perfil`;
      }

      console.log("Action details:", details);

      // Preparar datos limpios para el log
      const cleanUserData = userData ? {
        displayName: userData.displayName || "Sin nombre",
        role: userData.role || "Sin rol",
        email: userData.email || "Sin email",
        isActive: userData.isActive ?? true,
        updatedAt: userData.updatedAt || new Date().toISOString()
      } : null;

      const cleanPreviousData = previousData ? {
        displayName: previousData.displayName || "Sin nombre",
        role: previousData.role || "Sin rol",
        email: previousData.email || "Sin email",
        isActive: previousData.isActive ?? true,
        createdAt: previousData.createdAt || null,
        updatedAt: previousData.updatedAt || null
      } : null;

      const logData = {
        action: "update",
        entityType: "user",
        entityId: userId,
        entityData: cleanUserData,
        previousData: cleanPreviousData,
        userId: currentUserId,
        userName: currentUserName,
        details: details
      };

      console.log("Final log data:", logData);

      const result = await this.create(logData);
      console.log("Log creation result:", result);
      console.log("=== END LOG USER UPDATE DEBUG ===");

      return result;
    } catch (error) {
      console.error("Error logging user update:", error);
      return null;
    }
  },

  // Log user status change (enable/disable)
  async logUserStatusChange({ user, userId, userData, action, previousStatus }) {
    try {
      const currentUserId = user.uid;
      const currentUserName = user.displayName || user.email || "Usuario desconocido";
      const targetUserName = userData.displayName || userData.email;

      const actionText = action === "disable" ? "desactivó" : "activó";
      const details = `Usuario ${currentUserName} ${actionText} la cuenta de ${targetUserName}`;

      return await this.create({
        action: action,
        entityType: "user",
        entityId: userId,
        entityData: userData,
        previousData: { isActive: previousStatus },
        userId: currentUserId,
        userName: currentUserName,
        details: details
      });
    } catch (error) {
      console.error("Error logging user status change:", error);
      return null;
    }
  },

  // Log user deletion
  async logUserDeletion({ user, userId, userData }) {
    try {
      const currentUserId = user.uid;
      const currentUserName = user.displayName || user.email || "Usuario desconocido";
      const targetUserName = userData.displayName || userData.email;

      return await this.create({
        action: "delete",
        entityType: "user",
        entityId: userId,
        entityData: userData,
        userId: currentUserId,
        userName: currentUserName,
        details: `Usuario ${currentUserName} eliminó la cuenta de ${targetUserName}`
      });
    } catch (error) {
      console.error("Error logging user deletion:", error);
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