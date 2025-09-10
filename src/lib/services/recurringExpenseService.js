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
        isActive: expenseData.isActive !== undefined ? expenseData.isActive : true,
        lastGenerated: null,
        generatedDates: expenseData.generatedDates || [], // New field for tracking specific dates
        // Keep backward compatibility
        generatedMonths: expenseData.generatedMonths || [],
        frequency: expenseData.frequency || 'monthly', // Default to monthly for backward compatibility
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

  // Generate pending transactions based on frequency (daily check)
  async generatePendingTransactions(user) {
    try {
      const activeExpenses = await this.getAll({ isActive: true });
      const today = new Date();
      const todayKey = this.formatDateKey(today);
      const generatedTransactions = [];

      console.log(`Checking recurring expenses for date: ${todayKey}`);

      for (const expense of activeExpenses) {
        // Initialize generatedDates array if it doesn't exist (for backward compatibility)
        const generatedDates = expense.generatedDates || expense.generatedMonths || [];
        const frequency = expense.frequency || 'monthly'; // Default to monthly for backward compatibility
        const startDate = expense.startDate ? (expense.startDate.toDate ? expense.startDate.toDate() : new Date(expense.startDate)) : null;
        
        // Skip if start date is in the future
        if (startDate && startDate > today) {
          console.log(`Skipping expense ${expense.id} - start date is in the future`);
          continue;
        }

        // Check if we should generate based on frequency
        const shouldGenerate = this.shouldGenerateForDate(today, frequency, generatedDates, startDate);

        if (shouldGenerate) {
          // Create the transaction for today
          const transactionData = {
            type: "salida",
            generalId: expense.generalId,
            conceptId: expense.conceptId,
            subconceptId: expense.subconceptId,
            description: `${expense.description} (Recurrente)`,
            amount: expense.amount,
            date: today,
            providerId: expense.providerId,
            division: expense.division,
            isRecurring: true,
            recurringExpenseId: expense.id,
          };

          const newTransaction = await transactionService.create(transactionData, user);
          generatedTransactions.push(newTransaction);

          // Update the lastGenerated date and add the date to generatedDates array
          const updatedGeneratedDates = [...generatedDates, todayKey];
          await this.update(expense.id, { 
            lastGenerated: serverTimestamp(),
            generatedDates: updatedGeneratedDates,
            // Keep backward compatibility with generatedMonths for monthly expenses
            ...(frequency === 'monthly' && {
              generatedMonths: updatedGeneratedDates
            })
          }, user);
          
          console.log(`Generated recurring transaction for expense ${expense.id} (${frequency}) for date ${todayKey}`);
        } else {
          console.log(`Skipping recurring expense ${expense.id} - not due for generation on ${todayKey}`);
        }
      }

      if (generatedTransactions.length > 0) {
        console.log(`Generated ${generatedTransactions.length} new recurring transactions for date ${todayKey}`);
      } else {
        console.log(`No new recurring transactions needed for date ${todayKey}`);
      }

      return generatedTransactions;
    } catch (error) {
      console.error("Error generating pending transactions:", error);
      throw new Error("Error al generar transacciones pendientes");
    }
  },

  // Helper method to format date as YYYY-MM-DD
  formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // Helper method to determine if we should generate a transaction for a given date
  shouldGenerateForDate(currentDate, frequency, generatedDates, startDate) {
    const dateKey = this.formatDateKey(currentDate);
    
    // Check if already generated for this exact date
    if (generatedDates.includes(dateKey)) {
      return false;
    }

    // Check based on frequency
    switch (frequency) {
      case 'daily':
        return true; // Generate every day (if not already generated)
        
      case 'weekly':
        // Generate every Monday (day 1, where Sunday = 0)
        return currentDate.getDay() === 1;
        
      case 'biweekly':
        // Generate on 15th and day before last day of month
        const day = currentDate.getDate();
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        const dayBeforeLast = lastDayOfMonth - 1;
        return day === 15 || day === dayBeforeLast;
        
      case 'monthly':
        // Generate on 1st of month (backward compatibility)
        return currentDate.getDate() === 1;
        
      default:
        return false;
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
      const expensesToMigrate = allExpenses.filter(expense => 
        !expense.generatedMonths && !expense.generatedDates && !expense.frequency
      );
      
      console.log(`Found ${expensesToMigrate.length} recurring expenses to migrate`);
      
      for (const expense of expensesToMigrate) {
        const updateData = {
          generatedMonths: [],
          generatedDates: [],
          frequency: 'monthly' // Default to monthly for backward compatibility
        };
        
        // If lastGenerated exists, we can infer some generated months
        if (expense.lastGenerated) {
          const lastGeneratedDate = expense.lastGenerated.toDate();
          const monthKey = `${lastGeneratedDate.getFullYear()}-${String(lastGeneratedDate.getMonth()).padStart(2, '0')}`;
          const dateKey = this.formatDateKey(lastGeneratedDate);
          updateData.generatedMonths.push(monthKey);
          updateData.generatedDates.push(dateKey);
        }
        
        // Update the expense with the new fields
        await this.update(expense.id, updateData, { uid: 'system-migration' });
        console.log(`Migrated recurring expense ${expense.id} with frequency: ${updateData.frequency}, dates: ${updateData.generatedDates.join(', ')}`);
      }
      
      console.log(`Migration completed for ${expensesToMigrate.length} recurring expenses`);
      return expensesToMigrate.length;
    } catch (error) {
      console.error("Error migrating existing expenses:", error);
      throw new Error("Error en la migración de gastos recurrentes");
    }
  },
};