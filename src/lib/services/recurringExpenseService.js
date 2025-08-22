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
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { transactionService } from "./transactionService";

const COLLECTION_NAME = "recurringExpenses";

export const recurringExpenseService = {
  // Create a new recurring expense
  async create(expenseData, user) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...expenseData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        lastGenerated: null,
      });

      return { id: docRef.id, ...expenseData };
    } catch (error) {
      console.error("Error creating recurring expense:", error);
      throw new Error("Error al crear el gasto recurrente");
    }
  },

  // Get all recurring expenses
  async getAll(filters = {}) {
    try {
      let q = collection(db, COLLECTION_NAME);

      if (filters.isActive !== undefined) {
        q = query(q, where("isActive", "==", filters.isActive));
      }

      q = query(q, orderBy("createdAt", "desc"));

      const querySnapshot = await getDocs(q);
      const expenses = [];

      querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() });
      });

      return expenses;
    } catch (error) {
      console.error("Error getting recurring expenses:", error);
      throw new Error("Error al obtener los gastos recurrentes");
    }
  },

  // Update recurring expense
  async update(id, updateData, user) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      return { id, ...updateData };
    } catch (error) {
      console.error("Error updating recurring expense:", error);
      throw new Error("Error al actualizar el gasto recurrente");
    }
  },

  // Delete recurring expense
  async delete(id, user) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("Error deleting recurring expense:", error);
      throw new Error("Error al eliminar el gasto recurrente");
    }
  },

  // Generate pending transactions for the next month
  async generatePendingTransactions(user) {
    try {
      const activeExpenses = await this.getAll({ isActive: true });
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const generatedTransactions = [];

      for (const expense of activeExpenses) {
        // Check if we already generated for next month
        const lastGenerated = expense.lastGenerated?.toDate();
        const shouldGenerate = !lastGenerated || 
          lastGenerated.getMonth() !== nextMonth.getMonth() || 
          lastGenerated.getFullYear() !== nextMonth.getFullYear();

        if (shouldGenerate) {
          // Create the transaction for next month
          const transactionData = {
            type: "salida",
            generalId: expense.generalId,
            conceptId: expense.conceptId,
            subconceptId: expense.subconceptId,
            description: `${expense.description} (Recurrente)`,
            amount: expense.amount,
            date: nextMonth,
            providerId: expense.providerId,
            division: expense.division,
            isRecurring: true,
            recurringExpenseId: expense.id,
          };

          const newTransaction = await transactionService.create(transactionData, user);
          generatedTransactions.push(newTransaction);

          // Update the lastGenerated date
          await this.update(expense.id, { lastGenerated: serverTimestamp() }, user);
        }
      }

      return generatedTransactions;
    } catch (error) {
      console.error("Error generating pending transactions:", error);
      throw new Error("Error al generar transacciones pendientes");
    }
  },

  // Get recurring expense by ID
  async getById(id) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error("Gasto recurrente no encontrado");
      }
    } catch (error) {
      console.error("Error getting recurring expense:", error);
      throw new Error("Error al obtener el gasto recurrente");
    }
  },

  // Toggle active status
  async toggleActive(id, user) {
    try {
      const expense = await this.getById(id);
      await this.update(id, { isActive: !expense.isActive }, user);
      return !expense.isActive;
    } catch (error) {
      console.error("Error toggling recurring expense:", error);
      throw new Error("Error al cambiar el estado del gasto recurrente");
    }
  },
};