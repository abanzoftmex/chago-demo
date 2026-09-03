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

// Helper to get tenant-scoped collection reference
const getCollection = (tenantId) => {
  if (!tenantId) throw new Error('Tenant ID es requerido');
  const id = typeof tenantId === 'string' ? tenantId : String(tenantId);
  if (id === '[object Object]') throw new Error('Tenant ID inválido: se recibió un objeto en lugar de string');
  return collection(db, `tenants/${id}/${COLLECTION_NAME}`);
};

const getDocRef = (tenantId, id) => {
  if (!tenantId) throw new Error('Tenant ID es requerido');
  const tid = typeof tenantId === 'string' ? tenantId : String(tenantId);
  return doc(db, `tenants/${tid}/${COLLECTION_NAME}/${id}`);
};

// La fecha del negocio y la regla de "cuándo toca generar" viven en
// `lib/recurring/schedule`, compartidas con el módulo de servidor que usa el
// cron. Escritas dos veces, acabarían discrepando.
import { getMexicoDate, formatDateKey, shouldGenerateForDate, monthlyBackfillDates } from "../recurring/schedule";

export const recurringExpenseService = {
  // Create a new recurring expense
  async create(expenseData, tenantId) {
    try {
      if (!tenantId) throw new Error('Tenant ID es requerido');
      const docRef = await addDoc(getCollection(tenantId), {
        ...expenseData,
        type: expenseData.type || "salida",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: expenseData.isActive !== undefined ? expenseData.isActive : true,
        lastGenerated: null,
        generatedDates: expenseData.generatedDates || [], // New field for tracking specific dates
        // Keep backward compatibility
        generatedMonths: expenseData.generatedMonths || [],
        frequency: expenseData.frequency || 'monthly', // Default to monthly for backward compatibility
      });

      return { id: docRef.id, ...expenseData, type: expenseData.type || "salida" };
    } catch (error) {
      console.error("Error creating recurring expense:", error);
      throw new Error("Error al crear la transacción recurrente");
    }
  },

  // Get all recurring expenses
  async getAll(tenantId, filters = {}) {
    try {
      if (!tenantId) throw new Error('Tenant ID es requerido');
      let q = getCollection(tenantId);

      if (filters.isActive !== undefined) {
        q = query(q, where("isActive", "==", filters.isActive));
      }

      q = query(q, orderBy("createdAt", "desc"));

      const querySnapshot = await getDocs(q);
      const expenses = [];

      querySnapshot.forEach((doc) => {
        expenses.push({ id: doc.id, ...doc.data() });
      });

      // Filter by type in-memory to support older documents without breaking queries
      return expenses.filter(e => {
        const itemType = e.type || "salida";
        return filters.type ? itemType === filters.type : true;
      });
    } catch (error) {
      console.error("Error getting recurring expenses:", error);
      // Retornar array vacío en lugar de error
      return [];
    }
  },

  // Update recurring expense
  async update(id, updateData, tenantId) {
    try {
      const docRef = getDocRef(tenantId, id);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });

      return { id, ...updateData };
    } catch (error) {
      console.error("Error updating recurring expense:", error);
      throw new Error("Error al actualizar la transacción recurrente");
    }
  },

  // Delete recurring expense
  async delete(id, tenantId) {
    try {
      const docRef = getDocRef(tenantId, id);
      await deleteDoc(docRef);
      return true;
    } catch (error) {
      console.error("Error deleting recurring expense:", error);
      throw new Error("Error al eliminar la transacción recurrente");
    }
  },

  // Generate pending transactions based on frequency (daily check)
  async generatePendingTransactions(tenantId, user) {
    try {
      const activeExpenses = await this.getAll(tenantId, { isActive: true });
      // ✅ Usar zona horaria de México para evaluar correctamente el día
      const today = getMexicoDate();
      console.log(`[TIMEZONE] Server UTC: ${new Date().toISOString()}, Mexico: ${today.toISOString()}, Day: ${today.getDate()}`);

      const todayKey = this.formatDateKey(today);
      const generatedTransactions = [];

      console.log(`Checking recurring transactions for date: ${todayKey}`);

      for (const expense of activeExpenses) {
        // Initialize generatedDates array if it doesn't exist (for backward compatibility)
        const generatedDates = expense.generatedDates || expense.generatedMonths || [];
        const frequency = expense.frequency || 'monthly'; // Default to monthly for backward compatibility
        const startDate = expense.startDate ? (expense.startDate.toDate ? expense.startDate.toDate() : new Date(expense.startDate)) : null;

        // Skip if start date is in the future
        if (startDate && startDate > today) {
          console.log(`Skipping recurring item ${expense.id} - start date is in the future`);
          continue;
        }

        // Check if we should generate based on frequency
        const shouldGenerate = this.shouldGenerateForDate(today, frequency, generatedDates, startDate);

        if (shouldGenerate) {
          // Create the transaction for today
          const transactionData = {
            type: expense.type || "salida",
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

          const newTransaction = await transactionService.create(transactionData, user, tenantId);
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
          }, tenantId);

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

  // Backfill al CREAR un recurrente MENSUAL con inicio en el pasado: genera de
  // una vez los días 1 que ya ocurrieron (desde el inicio hasta hoy, con tope de
  // 1 año atrás), cada uno fechado en su día 1 real y como transacción pendiente.
  // La deduplicación por `generatedDates` evita chocar con el cron.
  async backfillMonthly(expense, tenantId, user) {
    try {
      if ((expense.frequency || "monthly") !== "monthly") return [];
      const startDate = expense.startDate?.toDate
        ? expense.startDate.toDate()
        : expense.startDate
        ? new Date(expense.startDate)
        : null;
      const generatedDates = expense.generatedDates || expense.generatedMonths || [];
      const dates = monthlyBackfillDates(startDate, generatedDates);
      if (dates.length === 0) return [];

      const created = [];
      const newKeys = [];
      for (const d of dates) {
        const transactionData = {
          type: expense.type || "salida",
          generalId: expense.generalId,
          conceptId: expense.conceptId,
          subconceptId: expense.subconceptId,
          description: `${expense.description} (Recurrente)`,
          amount: expense.amount,
          date: d, // ← su día 1 real, no "hoy"
          providerId: expense.providerId,
          division: expense.division,
          isRecurring: true,
          recurringExpenseId: expense.id,
        };
        const tx = await transactionService.create(transactionData, user, tenantId);
        created.push(tx);
        newKeys.push(formatDateKey(d));
      }

      const updatedGeneratedDates = [...generatedDates, ...newKeys];
      await this.update(
        expense.id,
        {
          lastGenerated: serverTimestamp(),
          generatedDates: updatedGeneratedDates,
          generatedMonths: updatedGeneratedDates, // compat mensual
        },
        tenantId
      );

      console.log(`Backfill mensual: generadas ${created.length} transacciones para ${expense.id}`);
      return created;
    } catch (error) {
      console.error("Error en backfill mensual:", error);
      throw new Error("Error al generar las transacciones pasadas del recurrente");
    }
  },

  // Estos dos delegan en `lib/recurring/schedule`, que es donde vive la regla
  // y de donde la toma también el cron del servidor. Se conservan como métodos
  // porque el resto del servicio los llama con `this.`
  formatDateKey(date) {
    return formatDateKey(date);
  },

  shouldGenerateForDate(currentDate, frequency, generatedDates, startDate) {
    return shouldGenerateForDate(currentDate, frequency, generatedDates, startDate);
  },

  // Get recurring expense by ID
  async getById(id, tenantId) {
    try {
      const docRef = getDocRef(tenantId, id);
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
  async cleanFutureTransactions(recurringExpenseId, tenantId, user) {
    try {
      const now = new Date();
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Get all transactions from this recurring expense
      const transactionsQuery = query(
        collection(db, `tenants/${tenantId}/transacciones`),
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
        const expense = await this.getById(recurringExpenseId, tenantId);
        const currentGeneratedMonths = expense.generatedMonths || [];
        const updatedGeneratedMonths = currentGeneratedMonths.filter(monthKey => !deletedMonthKeys.has(monthKey));

        await this.update(recurringExpenseId, {
          generatedMonths: updatedGeneratedMonths
        }, tenantId);

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
  async toggleActive(id, tenantId, user) {
    try {
      const expense = await this.getById(id, tenantId);
      const newActiveStatus = !expense.isActive;

      // If deactivating, clean future transactions
      if (!newActiveStatus) {
        await this.cleanFutureTransactions(id, tenantId, user);
      }

      await this.update(id, { isActive: newActiveStatus }, tenantId);
      return newActiveStatus;
    } catch (error) {
      console.error("Error toggling recurring expense:", error);
      throw new Error("Error al cambiar el estado del gasto recurrente");
    }
  },

  // Get transactions generated by a recurring expense
  async getGeneratedTransactions(recurringExpenseId, tenantId) {
    try {
      const transactionsQuery = query(
        collection(db, `tenants/${tenantId}/transacciones`),
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
  async getGeneratedMonthsHistory(recurringExpenseId, tenantId) {
    try {
      const expense = await this.getById(recurringExpenseId, tenantId);
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
  async migrateExistingExpenses(tenantId) {
    try {
      const allExpenses = await this.getAll(tenantId);
      const expensesToMigrate = allExpenses.filter(expense =>
        !expense.generatedMonths || !expense.generatedDates || !expense.frequency || !expense.type
      );

      console.log(`Found ${expensesToMigrate.length} recurring expenses to migrate`);

      for (const expense of expensesToMigrate) {
        const updateData = {
          generatedMonths: expense.generatedMonths || [],
          generatedDates: expense.generatedDates || [],
          frequency: expense.frequency || 'monthly', // Default to monthly for backward compatibility
          type: expense.type || 'salida'
        };

        // If lastGenerated exists, we can infer some generated months
        if (expense.lastGenerated && updateData.generatedMonths.length === 0) {
          const lastGeneratedDate = expense.lastGenerated.toDate();
          const monthKey = `${lastGeneratedDate.getFullYear()}-${String(lastGeneratedDate.getMonth()).padStart(2, '0')}`;
          const dateKey = this.formatDateKey(lastGeneratedDate);
          updateData.generatedMonths.push(monthKey);
          updateData.generatedDates.push(dateKey);
        }

        // Update the expense with the new fields
        await this.update(expense.id, updateData, tenantId);
        console.log(`Migrated recurring expense ${expense.id} with frequency: ${updateData.frequency}, type: ${updateData.type}`);
      }

      console.log(`Migration completed for ${expensesToMigrate.length} recurring expenses`);
      return expensesToMigrate.length;
    } catch (error) {
      console.error("Error migrating existing expenses:", error);
      // Retornar 0 en lugar de error
      return 0;
    }
  },
};