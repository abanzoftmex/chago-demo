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
        generatedMonths: expenseData.generatedMonths || [], // Use provided array or empty array
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

  // Generate pending transactions for the current month
  async generatePendingTransactions(user) {
    try {
      const activeExpenses = await this.getAll({ isActive: true });
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()).padStart(2, '0')}`; // Format: YYYY-MM
      const generatedTransactions = [];

      console.log(`Checking recurring expenses for current month: ${currentMonthKey}`);

      for (const expense of activeExpenses) {
        // Initialize generatedMonths array if it doesn't exist (for backward compatibility)
        const generatedMonths = expense.generatedMonths || [];
        
        // Check if we already generated for current month using the generatedMonths array
        const alreadyGenerated = generatedMonths.includes(currentMonthKey);

        if (!alreadyGenerated) {
          // Create the transaction for current month
          const transactionData = {
            type: "salida",
            generalId: expense.generalId,
            conceptId: expense.conceptId,
            subconceptId: expense.subconceptId,
            description: `${expense.description} (Recurrente)`,
            amount: expense.amount,
            date: currentMonth,
            providerId: expense.providerId,
            division: expense.division,
            isRecurring: true,
            recurringExpenseId: expense.id,
          };

          const newTransaction = await transactionService.create(transactionData, user);
          generatedTransactions.push(newTransaction);

          // Update the lastGenerated date and add the month to generatedMonths array
          const updatedGeneratedMonths = [...generatedMonths, currentMonthKey];
          await this.update(expense.id, { 
            lastGenerated: serverTimestamp(),
            generatedMonths: updatedGeneratedMonths
          }, user);
          
          console.log(`Generated recurring transaction for expense ${expense.id} for current month ${currentMonthKey}`);
        } else {
          console.log(`Skipping recurring expense ${expense.id} - already generated for current month ${currentMonthKey}`);
        }
      }

      if (generatedTransactions.length > 0) {
        console.log(`Generated ${generatedTransactions.length} new recurring transactions for current month ${currentMonthKey}`);
      } else {
        console.log(`No new recurring transactions needed for current month ${currentMonthKey}`);
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

  // Clean future transactions for a recurring expense
  async cleanFutureTransactions(recurringExpenseId, user) {
    try {
      const now = new Date();
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      // Get all transactions from this recurring expense
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("recurringExpenseId", "==", recurringExpenseId),
        where("isRecurring", "==", true)
      );
      
      const querySnapshot = await getDocs(transactionsQuery);
      const deletedTransactions = [];
      const deletedMonthKeys = new Set();
      
      for (const docSnapshot of querySnapshot.docs) {
        const transaction = { id: docSnapshot.id, ...docSnapshot.data() };
        const transactionDate = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
        
        // Only delete transactions from next month onwards (keep current month and past)
        if (transactionDate >= startOfNextMonth) {
          await transactionService.delete(transaction.id, user);
          deletedTransactions.push(transaction);
          
          // Track the month key for this deleted transaction
          const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth()).padStart(2, '0')}`;
          deletedMonthKeys.add(monthKey);
          
          console.log(`Deleted future recurring transaction: ${transaction.id} for date ${transactionDate.toLocaleDateString()}`);
        }
      }
      
      // Update the recurring expense to remove the deleted months from generatedMonths
      if (deletedMonthKeys.size > 0) {
        const expense = await this.getById(recurringExpenseId);
        const currentGeneratedMonths = expense.generatedMonths || [];
        const updatedGeneratedMonths = currentGeneratedMonths.filter(monthKey => !deletedMonthKeys.has(monthKey));
        
        await this.update(recurringExpenseId, {
          generatedMonths: updatedGeneratedMonths
        }, user);
        
        console.log(`Updated generatedMonths for expense ${recurringExpenseId}. Removed future months: ${Array.from(deletedMonthKeys).join(', ')}`);
      }
      
      console.log(`Cleaned ${deletedTransactions.length} future transactions for recurring expense ${recurringExpenseId}`);
      return deletedTransactions;
    } catch (error) {
      console.error("Error cleaning future transactions:", error);
      throw new Error("Error al limpiar transacciones futuras");
    }
  },

  // Toggle active status
  async toggleActive(id, user) {
    try {
      const expense = await this.getById(id);
      const newActiveStatus = !expense.isActive;
      
      // If deactivating, clean future transactions
      if (!newActiveStatus) {
        await this.cleanFutureTransactions(id, user);
      }
      
      await this.update(id, { isActive: newActiveStatus }, user);
      return newActiveStatus;
    } catch (error) {
      console.error("Error toggling recurring expense:", error);
      throw new Error("Error al cambiar el estado del gasto recurrente");
    }
  },

  // Get transactions generated by a recurring expense
  async getGeneratedTransactions(recurringExpenseId) {
    try {
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("recurringExpenseId", "==", recurringExpenseId),
        where("isRecurring", "==", true),
        orderBy("date", "desc")
      );
      
      const querySnapshot = await getDocs(transactionsQuery);
      const transactions = [];
      
      querySnapshot.forEach((doc) => {
        const transaction = { id: doc.id, ...doc.data() };
        transactions.push(transaction);
      });
      
      return transactions;
    } catch (error) {
      console.error("Error getting generated transactions:", error);
      throw new Error("Error al obtener las transacciones generadas");
    }
  },

  // Get generated months history for a recurring expense
  async getGeneratedMonthsHistory(recurringExpenseId) {
    try {
      const expense = await this.getById(recurringExpenseId);
      const generatedMonths = expense.generatedMonths || [];
      
      // Convert month keys to readable format and add additional info
      const monthsHistory = generatedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month), 1);
        const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        
        return {
          monthKey,
          monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          year: parseInt(year),
          month: parseInt(month),
          date
        };
      });
      
      // Sort by date (most recent first)
      monthsHistory.sort((a, b) => b.date - a.date);
      
      return monthsHistory;
    } catch (error) {
      console.error("Error getting generated months history:", error);
      throw new Error("Error al obtener el historial de meses generados");
    }
  },

  // Migration method to add generatedMonths field to existing recurring expenses
  async migrateExistingExpenses() {
    try {
      const allExpenses = await this.getAll();
      const expensesToMigrate = allExpenses.filter(expense => !expense.generatedMonths);
      
      console.log(`Found ${expensesToMigrate.length} recurring expenses to migrate`);
      
      for (const expense of expensesToMigrate) {
        const generatedMonths = [];
        
        // If lastGenerated exists, we can infer some generated months
        if (expense.lastGenerated) {
          const lastGeneratedDate = expense.lastGenerated.toDate();
          const monthKey = `${lastGeneratedDate.getFullYear()}-${String(lastGeneratedDate.getMonth()).padStart(2, '0')}`;
          generatedMonths.push(monthKey);
        }
        
        // Update the expense with the new generatedMonths field
        await this.update(expense.id, { generatedMonths }, { uid: 'system-migration' });
        console.log(`Migrated recurring expense ${expense.id} with generatedMonths: ${generatedMonths.join(', ')}`);
      }
      
      console.log(`Migration completed for ${expensesToMigrate.length} recurring expenses`);
      return expensesToMigrate.length;
    } catch (error) {
      console.error("Error migrating existing expenses:", error);
      throw new Error("Error en la migración de gastos recurrentes");
    }
  },
};