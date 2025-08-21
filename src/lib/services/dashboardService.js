import { transactionService } from './transactionService';
import { conceptService } from './conceptService';

export const dashboardService = {
  // Get current month summary
  async getCurrentMonthSummary() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      return this.getMonthSummary(startOfMonth, endOfMonth);
    } catch (error) {
      console.error('Error getting current month summary:', error);
      throw new Error('Error al obtener el resumen del mes actual');
    }
  },

  // Get summary for a specific date range
  async getMonthSummary(startDate, endDate) {
    try {
      const transactions = await transactionService.getByDateRange(startDate, endDate);
      
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
      throw new Error('Error al obtener el resumen del mes');
    }
  },

  // Get transactions by concept for current month
  async getTransactionsByConcept() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      return this.getTransactionsByConceptForDateRange(startOfMonth, endOfMonth);
    } catch (error) {
      console.error('Error getting transactions by concept:', error);
      throw new Error('Error al obtener transacciones por concepto');
    }
  },

  // Get transactions by concept for a specific date range
  async getTransactionsByConceptForDateRange(startDate, endDate) {
    try {
      const transactions = await transactionService.getByDateRange(startDate, endDate);
      const concepts = await conceptService.getAll();
      
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
      throw new Error('Error al obtener transacciones por concepto para el rango de fechas');
    }
  },

  // Get monthly trends for the last 6 months
  async getMonthlyTrends() {
    try {
      const trends = [];
      const now = new Date();
      
      // Get data for the last 6 months
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);
        
        const transactions = await transactionService.getByDateRange(startOfMonth, endOfMonth);
        
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
  async getPaymentStatusSummary() {
    try {
      const transactions = await transactionService.getAll({ type: 'salida' });
      
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
  }
};