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
import { db } from "../firebase/firebaseConfig";
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

      if (filters.generalId) {
        q = query(q, where("generalId", "==", filters.generalId));
      }

      if (filters.conceptId) {
        q = query(q, where("conceptId", "==", filters.conceptId));
      }

      if (filters.subconceptId) {
        q = query(q, where("subconceptId", "==", filters.subconceptId));
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
};
