import { transactionService } from './transactionService';
import { conceptService } from './conceptService';

export const dashboardService = {
  // Get current month summary
  async getCurrentMonthSummary(tenantId) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      return this.getMonthSummary(startOfMonth, endOfMonth, tenantId);
    } catch (error) {
      console.error('Error getting current month summary:', error);
      throw new Error('Error al obtener el resumen del mes actual');
    }
  },

  // Get summary for a specific date range
  async getMonthSummary(startDate, endDate, tenantId) {
    try {
      const transactions = await transactionService.getByDateRange(startDate, endDate, {}, tenantId);

      const summary = {
        entradas: 0,
        salidas: 0,
        balance: 0,
        totalTransactions: transactions.length,
        entradasCount: 0,
        salidasCount: 0
      };

      transactions.forEach(transaction => {
        if (transaction.type === 'entrada') {
          summary.entradas += transaction.amount;
          summary.entradasCount++;
        } else if (transaction.type === 'salida') {
          summary.salidas += transaction.amount;
          summary.salidasCount++;
        }
      });

      summary.balance = summary.entradas - summary.salidas;

      return summary;
    } catch (error) {
      console.error('Error getting month summary:', error);
      // En modo demo, retornar resumen vacío
      return {
        entradas: 0,
        salidas: 0,
        balance: 0,
        totalTransactions: 0,
        entradasCount: 0,
        salidasCount: 0
      };
    }
  },

  // Get transactions by concept for current month
  async getTransactionsByConcept(tenantId) {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      return this.getTransactionsByConceptForDateRange(startOfMonth, endOfMonth, tenantId);
    } catch (error) {
      console.error('Error getting transactions by concept:', error);
      throw new Error('Error al obtener transacciones por concepto');
    }
  },

  // Get transactions by concept for a specific date range
  async getTransactionsByConceptForDateRange(startDate, endDate, tenantId) {
    try {
      const transactions = await transactionService.getByDateRange(startDate, endDate, {}, tenantId);
      const concepts = await conceptService.getAll(tenantId);

      // Create a map of concept names
      const conceptMap = {};
      concepts.forEach(concept => {
        conceptMap[concept.id] = concept.name;
      });

      // Group transactions by concept
      const conceptData = {};

      transactions.forEach(transaction => {
        const conceptName = conceptMap[transaction.conceptId] || 'Sin concepto';

        if (!conceptData[conceptName]) {
          conceptData[conceptName] = {
            entradas: 0,
            salidas: 0,
            total: 0,
            count: 0
          };
        }

        if (transaction.type === 'entrada') {
          conceptData[conceptName].entradas += transaction.amount;
        } else {
          conceptData[conceptName].salidas += transaction.amount;
        }

        conceptData[conceptName].total += transaction.amount;
        conceptData[conceptName].count++;
      });

      return conceptData;
    } catch (error) {
      console.error('Error getting transactions by concept for date range:', error);
      // En modo demo, retornar objeto vacío
      return {};
    }
  },

  // Get monthly trends for the last 6 months
  async getMonthlyTrends(tenantId) {
    try {
      const trends = [];
      const now = new Date();

      // Get data for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

        const transactions = await transactionService.getByDateRange(startOfMonth, endOfMonth, {}, tenantId);

        const monthData = {
          month: monthDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
          entradas: 0,
          salidas: 0,
          balance: 0,
          transactionCount: transactions.length
        };

        transactions.forEach(transaction => {
          if (transaction.type === 'entrada') {
            monthData.entradas += transaction.amount;
          } else if (transaction.type === 'salida') {
            monthData.salidas += transaction.amount;
          }
        });

        monthData.balance = monthData.entradas - monthData.salidas;
        trends.push(monthData);
      }

      return trends;
    } catch (error) {
      console.error('Error getting monthly trends:', error);
      throw new Error('Error al obtener tendencias mensuales');
    }
  },

  // Get payment status summary
  async getPaymentStatusSummary(tenantId) {
    try {
      const transactions = await transactionService.getAll({ type: 'salida' }, tenantId);

      const summary = {
        pendiente: { count: 0, amount: 0 },
        parcial: { count: 0, amount: 0 },
        pagado: { count: 0, amount: 0 }
      };

      transactions.forEach(transaction => {
        const status = transaction.status || 'pendiente';
        if (summary[status]) {
          summary[status].count++;
          summary[status].amount += transaction.balance || transaction.amount;
        }
      });

      return summary;
    } catch (error) {
      console.error('Error getting payment status summary:', error);
      throw new Error('Error al obtener resumen de estado de pagos');
    }
  },

  // Get available months and years with data
  async getAvailableMonthsAndYears(tenantId) {
    try {
      const transactions = await transactionService.getAll({}, tenantId);

      if (transactions.length === 0) {
        return { months: [], years: [] };
      }

      // Extract unique month-year combinations
      const monthYearSet = new Set();
      const yearSet = new Set();

      transactions.forEach(transaction => {
        if (transaction.date) {
          // Handle both Date objects and Firestore timestamps
          let date;
          if (transaction.date.toDate) {
            // Firestore timestamp
            date = transaction.date.toDate();
          } else if (transaction.date instanceof Date) {
            date = transaction.date;
          } else {
            // String date
            date = new Date(transaction.date);
          }

          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = date.getMonth();
            const monthYear = `${year}-${month.toString().padStart(2, '0')}`;

            monthYearSet.add(monthYear);
            yearSet.add(year);
          }
        }
      });

      // Convert to sorted arrays
      const monthYears = Array.from(monthYearSet).sort().map(monthYear => {
        const [year, month] = monthYear.split('-');
        return {
          year: parseInt(year),
          month: parseInt(month),
          monthYear,
          displayName: new Date(parseInt(year), parseInt(month), 1).toLocaleDateString('es-ES', {
            month: 'long',
            year: 'numeric'
          })
        };
      });

      const years = Array.from(yearSet).sort((a, b) => b - a); // Most recent first

      return {
        months: monthYears,
        years
      };
    } catch (error) {
      console.error('Error getting available months and years:', error);
      throw new Error('Error al obtener meses y años disponibles');
    }
  },

  // Get available months for a specific year
  async getAvailableMonthsForYear(year, tenantId) {
    try {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      const transactions = await transactionService.getByDateRange(startOfYear, endOfYear, {}, tenantId);

      if (transactions.length === 0) {
        return [];
      }

      const monthSet = new Set();

      transactions.forEach(transaction => {
        if (transaction.date) {
          let date;
          if (transaction.date.toDate) {
            date = transaction.date.toDate();
          } else if (transaction.date instanceof Date) {
            date = transaction.date;
          } else {
            date = new Date(transaction.date);
          }

          if (!isNaN(date.getTime()) && date.getFullYear() === year) {
            monthSet.add(date.getMonth());
          }
        }
      });

      const months = Array.from(monthSet).sort().map(month => ({
        month,
        year,
        displayName: new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long' })
      }));

      return months;
    } catch (error) {
      console.error('Error getting available months for year:', error);
      throw new Error('Error al obtener meses disponibles para el año');
    }
  }
};