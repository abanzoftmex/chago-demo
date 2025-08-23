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

      if (filters.status) {
        q = query(q, where("status", "==", filters.status));
      }

      if (filters.excludeStatus) {
        q = query(q, where("status", "!=", filters.excludeStatus));
      }
      
      if (filters.division) {
        q = query(q, where("division", "==", filters.division));
      }

      // Apply ordering
      q = query(q, orderBy("createdAt", "desc"));

      // Apply pagination
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
      
      // Filtrar por fecha después de obtener los resultados
      if (filters.startDate && filters.endDate) {
        transactions = transactions.filter(transaction => {
          if (!transaction.date) return false;
          const transactionDate = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
          return transactionDate >= filters.startDate && transactionDate <= filters.endDate;
        });
      }

      return transactions;
    } catch (error) {
      console.error("Error getting transactions:", error);
      throw new Error("Error al obtener las transacciones");
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
  async delete(id, user) {
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
          transactionData
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
};
