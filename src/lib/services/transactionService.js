import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/firebaseConfig";
import { logService } from "./logService";

const COLLECTION_NAME = "transactions";

export const transactionService = {
  // Create a new transaction
  async create(transactionData, user) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...transactionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: "pendiente",
        payments: [],
        totalPaid: 0,
        balance: transactionData.amount,
      });

      const newTransaction = { id: docRef.id, ...transactionData };
      
      // Log the transaction creation
      if (user) {
        await logService.logTransactionCreation({
          user,
          transactionId: docRef.id,
          transactionData: newTransaction
        });
      }

      return newTransaction;
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw new Error("Error al crear la transacción");
    }
  },

  // Get transaction by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("Transacción no encontrada");
      }
    } catch (error) {
      console.error("Error getting transaction:", error);
      throw new Error("Error al obtener la transacción");
    }
  },

  // Get all transactions with optional filters
  async getAll(filters = {}) {
    try {
      let q = collection(db, COLLECTION_NAME);

      // Apply filters
      if (filters.type) {
        q = query(q, where("type", "==", filters.type));
      }

      if (filters.providerId) {
        q = query(q, where("providerId", "==", filters.providerId));
      }

      if (filters.generalId) {
        q = query(q, where("generalId", "==", filters.generalId));
      }

      if (filters.conceptId) {
        q = query(q, where("conceptId", "==", filters.conceptId));
      }

      if (filters.subconceptId) {
        q = query(q, where("subconceptId", "==", filters.subconceptId));
      }

      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }

      if (filters.excludeStatus) {
        q = query(q, where("status", "!=", filters.excludeStatus));
      }
      
      if (filters.division) {
        q = query(q, where("division", "==", filters.division));
      }

      // Handle date filtering - need to combine both conditions properly
      if (filters.startDate && filters.endDate) {
        // Use date range filtering with proper ordering
        q = query(q, where("date", ">=", filters.startDate), where("date", "<=", filters.endDate));
        q = query(q, orderBy("date", "desc"));
      } else {
        // Apply ordering by createdAt when no date filters
        q = query(q, orderBy("createdAt", "desc"));
      }

      // Apply pagination after ordering
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      if (filters.startAfter) {
        q = query(q, startAfter(filters.startAfter));
      }

      const querySnapshot = await getDocs(q);
      let transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      return transactions;
    } catch (error) {
      console.error("Error getting transactions:", error);
      // Fallback to original method if date filtering fails
      try {
        let fallbackQ = collection(db, COLLECTION_NAME);

        // Apply basic filters without date filtering
        if (filters.type) {
          fallbackQ = query(fallbackQ, where("type", "==", filters.type));
        }

        fallbackQ = query(fallbackQ, orderBy("createdAt", "desc"));

        if (filters.limit) {
          fallbackQ = query(fallbackQ, limit(filters.limit * 3)); // Get more to filter later
        }

        const fallbackSnapshot = await getDocs(fallbackQ);
        let fallbackTransactions = [];

        fallbackSnapshot.forEach((doc) => {
          fallbackTransactions.push({ id: doc.id, ...doc.data() });
        });

        // Apply date filtering after getting results
        if (filters.startDate && filters.endDate) {
          fallbackTransactions = fallbackTransactions.filter(transaction => {
            if (!transaction.date) return false;
            const transactionDate = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
            return transactionDate >= filters.startDate && transactionDate <= filters.endDate;
          });
        }

        return fallbackTransactions;
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError);
        throw new Error("Error al obtener las transacciones");
      }
    }
  },

  // Update transaction
  async update(id, updateData, user) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      // Get the current transaction data before updating
      let previousData = null;
      if (user) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          previousData = { id: docSnap.id, ...docSnap.data() };
        }
      }
      
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      const updatedTransaction = { id, ...updateData };
      
      // Log the transaction update
      if (user && previousData) {
        await logService.logTransactionUpdate({
          user,
          transactionId: id,
          transactionData: updatedTransaction,
          previousData
        });
      }

      return updatedTransaction;
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw new Error("Error al actualizar la transacción");
    }
  },

  // Delete transaction
  async delete(id, user, deletionReason = null) {
    try {
      // Check if user has permission to delete (contador and director_general roles cannot delete)
      if (user && ['contador', 'director_general'].includes(user.role)) {
        throw new Error("No tienes permisos para eliminar transacciones");
      }

      // Get the transaction data before deleting it
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        throw new Error("Transacción no encontrada");
      }

      const transactionData = { id: docSnap.id, ...docSnap.data() };

      // Delete the transaction
      await deleteDoc(docRef);

      // Log the transaction deletion
      if (user) {
        await logService.logTransactionDeletion({
          user,
          transactionId: id,
          transactionData,
          deletionReason // Pasar el motivo de eliminación
        });
      }

      return true;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw new Error("Error al eliminar la transacción");
    }
  },

  // Update transaction status and balance based on payments
  async updatePaymentStatus(id, totalPaid, totalAmount) {
    try {
      const balance = totalAmount - totalPaid;
      let status = "pendiente";

      if (totalPaid >= totalAmount) {
        status = "pagado";
      } else if (totalPaid > 0) {
        status = "parcial";
      }

      await this.update(id, {
        totalPaid,
        balance,
        status,
      });

      return { totalPaid, balance, status };
    } catch (error) {
      console.error("Error updating payment status:", error);
      throw new Error("Error al actualizar el estado de pago");
    }
  },

  // Get transactions by date range
  async getByDateRange(startDate, endDate, filters = {}) {
    try {
      let q = collection(db, COLLECTION_NAME);

      // Apply date range filter
      q = query(
        q,
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      // Apply additional filters
      if (filters.type) {
        q = query(q, where("type", "==", filters.type));
      }

      if (filters.providerId) {
        q = query(q, where("providerId", "==", filters.providerId));
      }

      if (filters.generalId) {
        q = query(q, where("generalId", "==", filters.generalId));
      }

      if (filters.conceptId) {
        q = query(q, where("conceptId", "==", filters.conceptId));
      }

      if (filters.subconceptId) {
        q = query(q, where("subconceptId", "==", filters.subconceptId));
      }

      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }

      q = query(q, orderBy("date", "desc"));

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      return transactions;
    } catch (error) {
      console.error("Error getting transactions by date range:", error);
      throw new Error("Error al obtener transacciones por rango de fechas");
    }
  },

  // Delete all transactions from a specific month (DEV ONLY)
  async deleteTransactionsByMonth(year, month, user, onProgress = null) {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        throw new Error("Esta función solo está disponible en desarrollo");
      }

      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

      console.log(`🗑️ Deleting transactions from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

      // Get all transactions in the month
      const transactions = await this.getByDateRange(startDate, endDate);
      
      console.log(`Found ${transactions.length} transactions to delete`);

      // Notify initial progress
      if (onProgress) {
        onProgress(0, transactions.length);
      }

      let deletedCount = 0;
      const errors = [];

      // Delete each transaction
      for (let i = 0; i < transactions.length; i++) {
        const transaction = transactions[i];
        try {
          await this.delete(transaction.id, user);
          deletedCount++;
          console.log(`Deleted transaction ${transaction.id} - ${transaction.description}`);
          
          // Update progress
          if (onProgress) {
            onProgress(deletedCount, transactions.length);
          }
        } catch (error) {
          console.error(`Error deleting transaction ${transaction.id}:`, error);
          errors.push(`Error deleting transaction ${transaction.id}: ${error.message}`);
          
          // Still update progress even on error
          if (onProgress) {
            onProgress(deletedCount, transactions.length);
          }
        }
      }

      // Log the bulk deletion
      if (user) {
        await logService.log({
          level: 'warn',
          action: 'BULK_DELETE_TRANSACTIONS',
          userId: user.uid,
          userEmail: user.email,
          details: {
            year,
            month,
            monthName: new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long' }),
            deletedCount,
            totalFound: transactions.length,
            errors: errors.length
          },
          metadata: {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV
          }
        });
      }

      const result = {
        deletedCount,
        totalFound: transactions.length,
        errors
      };

      console.log(`🗑️ Deletion completed: ${deletedCount}/${transactions.length} transactions deleted`);
      
      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} errors occurred during deletion:`, errors);
      }

      return result;
    } catch (error) {
      console.error("Error deleting transactions by month:", error);
      throw new Error(`Error al eliminar transacciones del mes: ${error.message}`);
    }
  },

  // Create an initial expense without creating entities in the system
  async createInitialExpense(transactionData, user) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...transactionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: transactionData.status || "aprobado",
        payments: [],
        totalPaid: 0,
        balance: transactionData.amount,
        isInitialExpense: true, // Mark as initial expense
        // Use direct names instead of IDs
        generalId: null,
        conceptId: null,
        subconceptId: null,
        providerId: null
      });

      const newTransaction = { id: docRef.id, ...transactionData };
      
      // Log the initial expense creation
      if (user) {
        await logService.logTransactionCreation({
          user,
          transactionId: docRef.id,
          transactionData: newTransaction
        });
      }

      return newTransaction;
    } catch (error) {
      console.error("Error creating initial expense:", error);
      throw new Error("Error al crear el gasto inicial");
    }
  },

  // Upload file to Firebase Storage for transactions
  async uploadFile(file, transactionId) {
    try {
      console.log("TransactionService - Starting file upload:", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      // Validate file
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = `transactions/${transactionId}/${fileName}`;

      // Upload file with metadata
      const storageRef = ref(storage, filePath);
      const metadata = {
        contentType: file.type || 'application/octet-stream',
        customMetadata: {
          originalFileName: file.name,
          uploadedAt: new Date().toISOString()
        }
      };
      
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return {
        fileName,
        fileUrl: downloadURL,
        fileType: file.type,
        fileSize: file.size,
        uploadedAt: new Date(),
      };
    } catch (error) {
      console.error("TransactionService - Error uploading file:", error);
      throw new Error("Error al subir el archivo");
    }
  },

  // Delete file from Firebase Storage
  async deleteFile(fileName, transactionId) {
    try {
      const filePath = `transactions/${transactionId}/${fileName}`;
      const storageRef = ref(storage, filePath);
      await deleteObject(storageRef);
      console.log(`File ${fileName} deleted successfully from storage`);
      return true;
    } catch (error) {
      // Don't throw error if file doesn't exist - this is expected behavior
      if (error.code === "storage/object-not-found") {
        console.log(`File ${fileName} was already deleted or doesn't exist in storage - this is OK`);
        return true;
      }
      
      // For other storage errors, log but don't throw to avoid breaking the flow
      console.error("Storage error when deleting file:", error);
      throw new Error("Error al eliminar el archivo del almacenamiento");
    }
  },

  // Remove attachment from transaction
  async removeAttachment(transactionId, fileName, user) {
    try {
      const transaction = await this.getById(transactionId);

      // Remove attachment from array
      const updatedAttachments = (transaction.attachments || []).filter(
        (attachment) => attachment.fileName !== fileName
      );

      // Try to delete file from storage (don't fail if file doesn't exist)
      try {
        await this.deleteFile(fileName, transactionId);
      } catch (storageError) {
        // Log the storage error but don't fail the entire operation
        console.warn("Storage deletion warning (continuing with database update):", storageError);
      }

      // Update transaction document
      await this.update(transactionId, { attachments: updatedAttachments }, user);

      return true;
    } catch (error) {
      console.error("Error removing attachment:", error);
      throw new Error("Error al eliminar el archivo adjunto");
    }
  },

  // Add attachments to transaction
  async addAttachments(transactionId, files, user) {
    try {
      const transaction = await this.getById(transactionId);
      const existingAttachments = transaction.attachments || [];
      const newAttachments = [];

      // Upload new files
      for (const file of files) {
        const attachment = await this.uploadFile(file, transactionId);
        newAttachments.push(attachment);
      }

      // Combine with existing attachments
      const allAttachments = [...existingAttachments, ...newAttachments];

      // Update transaction
      await this.update(transactionId, { attachments: allAttachments }, user);

      return allAttachments;
    } catch (error) {
      console.error("Error adding attachments:", error);
      throw new Error("Error al agregar archivos adjuntos");
    }
  },

  // Validate file
  validateFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB (más generoso que pagos)
    const allowedTypes = [
      "image/jpeg", 
      "image/jpg", 
      "image/png", 
      "image/gif", 
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain"
    ];

    if (!file) {
      return { isValid: false, error: "No se ha seleccionado ningún archivo" };
    }

    if (file.size > maxSize) {
      return { 
        isValid: false, 
        error: `El archivo es muy grande. Tamaño máximo permitido: ${(maxSize / 1024 / 1024).toFixed(1)}MB` 
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return { 
        isValid: false, 
        error: "Tipo de archivo no permitido. Formatos permitidos: JPG, PNG, GIF, PDF, DOC, DOCX, TXT" 
      };
    }

    return { isValid: true };
  },

  // Get transaction statistics for a date range (only counts, not full data)
  async getStatsByDateRange(startDate, endDate, filters = {}) {
    try {
      let q = collection(db, COLLECTION_NAME);

      // Apply date range filter
      q = query(
        q,
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );

      // Apply additional filters (except status - we need all statuses for counting)
      if (filters.type) {
        q = query(q, where("type", "==", filters.type));
      }

      if (filters.providerId) {
        q = query(q, where("providerId", "==", filters.providerId));
      }

      if (filters.generalId) {
        q = query(q, where("generalId", "==", filters.generalId));
      }

      if (filters.conceptId) {
        q = query(q, where("conceptId", "==", filters.conceptId));
      }

      if (filters.subconceptId) {
        q = query(q, where("subconceptId", "==", filters.subconceptId));
      }

      const querySnapshot = await getDocs(q);
      
      // Initialize counters
      const stats = {
        pendiente: 0,
        parcial: 0,
        pagado: 0,
        total: 0
      };

      // Count each transaction by status
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const status = data.status || 'pendiente'; // Default to pendiente if no status
        
        if (stats.hasOwnProperty(status)) {
          stats[status]++;
        }
        stats.total++;
      });

      return stats;
    } catch (error) {
      console.error("Error getting transaction stats by date range:", error);
      throw new Error("Error al obtener estadísticas de transacciones");
    }
  },
};
