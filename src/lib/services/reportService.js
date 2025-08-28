import { transactionService } from './transactionService';
import { providerService } from './providerService';
import { conceptService } from './conceptService';
import { descriptionService } from './descriptionService';
import { createEnhancedPDFReport } from './pdfTemplates';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';

export const reportService = {
  // Get filtered transactions for reports with pending carryover
  async getFilteredTransactions(filters) {
    try {
      let transactions = [];
      
      if (filters.startDate && filters.endDate) {
        // Get transactions for the selected period
        transactions = await transactionService.getByDateRange(
          filters.startDate,
          filters.endDate,
          {
            type: filters.type,
            providerId: filters.providerId,
            generalId: filters.generalId,
            conceptId: filters.conceptId,
            subconceptId: filters.subconceptId
          }
        );

        // Get all pending transactions from before the start date
        const allTransactions = await transactionService.getAll({
          type: 'salida', // Only expenses can be pending
          status: 'pendiente'
        });

        // Filter pending transactions that are from before the selected period
        const pendingFromPrevious = allTransactions.filter(transaction => {
          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          const startDate = new Date(filters.startDate);
          
          return transactionDate < startDate && transaction.status === 'pendiente';
        });

        // Add pending transactions to the current period report
        transactions = [...transactions, ...pendingFromPrevious];
        
        // Remove duplicates (in case a pending transaction is already in the period)
        const uniqueTransactions = transactions.reduce((acc, current) => {
          const exists = acc.find(item => item.id === current.id);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []);
        
        transactions = uniqueTransactions;
      } else {
        transactions = await transactionService.getAll({
          type: filters.type,
          providerId: filters.providerId,
          generalId: filters.generalId,
          conceptId: filters.conceptId,
          subconceptId: filters.subconceptId
        });
      }
      
      return transactions;
    } catch (error) {
      console.error('Error getting filtered transactions:', error);
      throw new Error('Error al obtener transacciones filtradas');
    }
  },

  // Generate report statistics with carryover balance
  async generateReportStats(transactions, filters = {}) {
    try {
      const stats = {
        totalTransactions: transactions.length,
        totalEntradas: 0,
        totalSalidas: 0,
        totalBalance: 0,
        entradasCount: 0,
        salidasCount: 0,
        averageEntrada: 0,
        averageSalida: 0,
        carryoverBalance: 0, // Balance arrastrado de meses anteriores
        currentPeriodBalance: 0, // Balance del período actual
        paymentStatus: {
          pendiente: { count: 0, amount: 0, carryover: 0 },
          parcial: { count: 0, amount: 0, carryover: 0 },
          pagado: { count: 0, amount: 0, carryover: 0 }
        },
        conceptBreakdown: {},
        providerBreakdown: {},
        monthlyBreakdown: {}
      };

      // Get reference data
      const [concepts, providers, descriptions] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll()
      ]);

      const conceptMap = {};
      concepts.forEach(concept => {
        conceptMap[concept.id] = concept.name;
      });

      const providerMap = {};
      providers.forEach(provider => {
        providerMap[provider.id] = provider.name;
      });

      const descriptionMap = {};
      descriptions.forEach(description => {
        descriptionMap[description.id] = description.name;
      });

      // Determine if we're filtering by date range
      const hasDateFilter = filters.startDate && filters.endDate;
      const startDate = hasDateFilter ? new Date(filters.startDate) : null;
      const endDate = hasDateFilter ? new Date(filters.endDate) : null;

      // Process transactions
      transactions.forEach(transaction => {
        const amount = transaction.amount || 0;
        const conceptName = conceptMap[transaction.conceptId] || 'Sin concepto';
        const providerName = providerMap[transaction.providerId] || 'Sin proveedor';
        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const month = transactionDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

        // Determine if this transaction is from the current period or carried over
        const isCarryover = hasDateFilter && transactionDate < startDate && transaction.status === 'pendiente';

        // Basic stats
        if (transaction.type === 'entrada') {
          if (!isCarryover) {
            stats.totalEntradas += amount;
            stats.entradasCount++;
            stats.currentPeriodBalance += amount;
          }
        } else if (transaction.type === 'salida') {
          if (!isCarryover) {
            stats.totalSalidas += amount;
            stats.salidasCount++;
            stats.currentPeriodBalance -= amount;
          } else {
            // This is a carryover pending transaction
            stats.carryoverBalance -= (transaction.balance || amount);
          }
          
          // Payment status (only for salidas)
          const status = transaction.status || 'pendiente';
          if (stats.paymentStatus[status]) {
            stats.paymentStatus[status].count++;
            if (isCarryover) {
              stats.paymentStatus[status].carryover += transaction.balance || amount;
            } else {
              stats.paymentStatus[status].amount += transaction.balance || amount;
            }
          }
        }

        // Concept breakdown
        if (!stats.conceptBreakdown[conceptName]) {
          stats.conceptBreakdown[conceptName] = {
            entradas: 0,
            salidas: 0,
            total: 0,
            count: 0
          };
        }
        
        if (transaction.type === 'entrada') {
          stats.conceptBreakdown[conceptName].entradas += amount;
        } else {
          stats.conceptBreakdown[conceptName].salidas += amount;
        }
        stats.conceptBreakdown[conceptName].total += amount;
        stats.conceptBreakdown[conceptName].count++;

        // Provider breakdown (only for salidas)
        if (transaction.type === 'salida' && transaction.providerId) {
          if (!stats.providerBreakdown[providerName]) {
            stats.providerBreakdown[providerName] = {
              amount: 0,
              count: 0,
              pendingAmount: 0
            };
          }
          
          stats.providerBreakdown[providerName].amount += amount;
          stats.providerBreakdown[providerName].count++;
          stats.providerBreakdown[providerName].pendingAmount += transaction.balance || 0;
        }

        // Monthly breakdown
        if (!stats.monthlyBreakdown[month]) {
          stats.monthlyBreakdown[month] = {
            entradas: 0,
            salidas: 0,
            balance: 0,
            count: 0
          };
        }
        
        if (transaction.type === 'entrada') {
          stats.monthlyBreakdown[month].entradas += amount;
        } else {
          stats.monthlyBreakdown[month].salidas += amount;
        }
        stats.monthlyBreakdown[month].balance = 
          stats.monthlyBreakdown[month].entradas - stats.monthlyBreakdown[month].salidas;
        stats.monthlyBreakdown[month].count++;
      });

      // Calculate derived stats
      stats.totalBalance = stats.currentPeriodBalance + stats.carryoverBalance;
      stats.averageEntrada = stats.entradasCount > 0 ? stats.totalEntradas / stats.entradasCount : 0;
      stats.averageSalida = stats.salidasCount > 0 ? stats.totalSalidas / stats.salidasCount : 0;

      return stats;
    } catch (error) {
      console.error('Error generating report stats:', error);
      throw new Error('Error al generar estadísticas del reporte');
    }
  },

  // Export to Excel
  async exportToExcel(transactions, stats, filters) {
    try {
      const workbook = XLSX.utils.book_new();

      // Get reference data for lookups
      const [concepts, providers, descriptions] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll()
      ]);

      const conceptMap = {};
      concepts.forEach(concept => {
        conceptMap[concept.id] = concept.name;
      });

      const providerMap = {};
      providers.forEach(provider => {
        providerMap[provider.id] = provider.name;
      });

      const descriptionMap = {};
      descriptions.forEach(description => {
        descriptionMap[description.id] = description.name;
      });

      // Transactions sheet
      const transactionsData = transactions.map(transaction => ({
        'ID': transaction.id,
        'Fecha': new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date)
          .toLocaleDateString('es-ES'),
        'Tipo': transaction.type,
        'Concepto': conceptMap[transaction.conceptId] || 'Sin concepto',
        'Descripción': descriptionMap[transaction.descriptionId] || 'Sin descripción',
        'Proveedor': providerMap[transaction.providerId] || 'N/A',
        'Monto': transaction.amount,
        'Estado': transaction.status || 'pendiente',
        'Total Pagado': transaction.totalPaid || 0,
        'Saldo': transaction.balance || transaction.amount
      }));

      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');

      // Summary sheet
      const summaryData = [
        ['Estadística', 'Valor'],
        ['Total de Transacciones', stats.totalTransactions],
        ['Total Entradas', `${stats.totalEntradas.toLocaleString('es-MX')}`],
        ['Total Salidas', `${stats.totalSalidas.toLocaleString('es-MX')}`],
        ['Balance Total', `${stats.totalBalance.toLocaleString('es-MX')}`],
        ['Promedio Entradas', `${stats.averageEntrada.toLocaleString('es-MX')}`],
        ['Promedio Salidas', `${stats.averageSalida.toLocaleString('es-MX')}`],
        [''],
        ['Estado de Pagos', ''],
        ['Pendientes', `${stats.paymentStatus.pendiente.count} (${stats.paymentStatus.pendiente.amount.toLocaleString('es-MX')})`],
        ['Parciales', `${stats.paymentStatus.parcial.count} (${stats.paymentStatus.parcial.amount.toLocaleString('es-MX')})`],
        ['Pagados', `${stats.paymentStatus.pagado.count} (${stats.paymentStatus.pagado.amount.toLocaleString('es-MX')})`]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      // Concept breakdown sheet
      const conceptData = Object.entries(stats.conceptBreakdown).map(([concept, data]) => ({
        'Concepto': concept,
        'Entradas': `${data.entradas.toLocaleString('es-MX')}`,
        'Salidas': `${data.salidas.toLocaleString('es-MX')}`,
        'Total': `${data.total.toLocaleString('es-MX')}`,
        'Cantidad': data.count
      }));

      const conceptSheet = XLSX.utils.json_to_sheet(conceptData);
      XLSX.utils.book_append_sheet(workbook, conceptSheet, 'Por Concepto');

      // Generate filename
      const now = new Date();
      const filename = `reporte_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
      
      return filename;
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw new Error('Error al exportar a Excel');
    }
  },

  // Enhanced PDF export with modern design
  async exportToPDF(transactions, stats, filters) {
    try {
      // Use the enhanced PDF template
      const doc = await createEnhancedPDFReport(
        transactions, 
        stats, 
        filters, 
        conceptService, 
        providerService
      );
      
      // Generate filename with better naming
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
      const filename = `SFC_Reporte_Financiero_${dateStr}_${timeStr}.pdf`;
      
      // Save file
      doc.save(filename);
      
      return filename;
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw new Error('Error al exportar a PDF');
    }
  }
};