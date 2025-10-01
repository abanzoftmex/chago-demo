import { transactionService } from './transactionService';
import { providerService } from './providerService';
import { conceptService } from './conceptService';
import { descriptionService } from './descriptionService';
import { generalService } from './generalService';
import { carryoverService } from './carryoverService';
import { createEnhancedPDFReport } from './pdfTemplates';
import * as XLSX from 'xlsx';

export const reportService = {
  // Obtener transacciones filtradas para reportes incluyendo el arrastre de pendientes
  // El "arrastre" incluye TODOS los gastos pendientes de todos los meses (no solo anteriores)
  async getFilteredTransactions(filters) {
    try {
      let transactions = [];
      
      if (filters.startDate && filters.endDate) {
        // Obtener transacciones del período seleccionado
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

        // Obtener TODAS las transacciones pendientes hasta el mes del reporte
        // Solo incluir gastos pendientes que sean del mes del reporte o anteriores
        const allTransactions = await transactionService.getAll();
        const reportEndDate = new Date(filters.endDate);
        const reportYear = reportEndDate.getFullYear();
        const reportMonth = reportEndDate.getMonth(); // 0-based (0=enero, 11=diciembre)

        // Filtrar gastos pendientes que sean hasta el mes del reporte (no meses futuros)
        const allPendingTransactions = allTransactions.filter(transaction => {
          if (transaction.type !== 'salida' || transaction.status !== 'pendiente') {
            return false;
          }
          
          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          const transactionYear = transactionDate.getFullYear();
          const transactionMonth = transactionDate.getMonth();
          
          // Solo incluir gastos pendientes hasta el mes del reporte
          return (transactionYear < reportYear) || 
                 (transactionYear === reportYear && transactionMonth <= reportMonth);
        });

        console.log('🔍 Filtrado de gastos pendientes por mes:', {
          reportMonth: `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`,
          totalPendingInSystem: allTransactions.filter(t => t.type === 'salida' && t.status === 'pendiente').length,
          pendingUntilReportMonth: allPendingTransactions.length,
          pendingByMonth: allPendingTransactions.reduce((acc, t) => {
            const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
            const monthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
            acc[monthKey] = (acc[monthKey] || 0) + 1;
            return acc;
          }, {})
        });

        // Debug específico: buscar transacciones de agosto 2025
        const augustTransactions = allTransactions.filter(transaction => {
          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          return transactionDate.getMonth() === 7 && transactionDate.getFullYear() === 2025; // Agosto = mes 7
        });


        // Debug específico: buscar transacciones tipo 'salida' de agosto
        const augustSalidas = allTransactions.filter(transaction => {
          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          return transactionDate.getMonth() === 7 && transactionDate.getFullYear() === 2025 && transaction.type === 'salida';
        });

        // Debug específico: buscar la transacción del 5 de agosto 2025
        const specificDateTransactions = allTransactions.filter(transaction => {
          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          const dateStr = transactionDate.toISOString().split('T')[0];
          return dateStr === '2025-08-05' || dateStr === '2025-08-04' || dateStr === '2025-08-06'; // Rango por si hay diferencia de zona horaria
        });

       


        // Todas las transacciones pendientes de tipo 'salida' contribuyen al arrastre
        const pendingExpenses = allPendingTransactions;

        // Agregar todas las transacciones pendientes al reporte para el cálculo del arrastre
        const beforeMerge = transactions.length;
        transactions = [...transactions, ...pendingExpenses];
        const afterMerge = transactions.length;
        
        // Eliminar duplicados (en caso de que una transacción pendiente ya esté en el período)
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

  // Generar estadísticas del reporte con balance de arrastre mejorado
  async generateReportStats(transactions, filters = {}) {
    try {
      console.log(`🔍 generateReportStats: filters recibidos:`, filters);
      
      const stats = {
        totalTransactions: transactions.length,
        totalEntradas: 0,
        totalSalidas: 0,
        totalPaid: 0, // Total pagado de todos los gastos
        totalBalance: 0,
        entradasCount: 0,
        salidasCount: 0,
        averageEntrada: 0,
        averageSalida: 0,
        carryoverBalance: 0, // Balance arrastrado de gastos pendientes
        carryoverIncome: 0, // Ingresos arrastrados del mes anterior
        currentPeriodBalance: 0, // Balance del período actual
        paymentStatus: {
          pendiente: { count: 0, amount: 0, carryover: 0 },
          parcial: { count: 0, amount: 0, carryover: 0 },
          pagado: { count: 0, amount: 0, carryover: 0 },
          // Nueva categoría para gastos pendientes de meses anteriores
          pendienteAnterior: { count: 0, amount: 0, carryover: 0 }
        },
        conceptBreakdown: {},
        generalBreakdown: {},
        providerBreakdown: {},
        monthlyBreakdown: {}
      };

      // Obtener el arrastre de ingresos para el período actual si está filtrando por mes
      const hasDateFilter = filters.startDate && filters.endDate;
      let monthlyCarryover = null;
      
      if (hasDateFilter) {
        // Parsear la fecha correctamente evitando problemas de zona horaria
        let startDateStr = filters.startDate;
        if (filters.startDate instanceof Date) {
          startDateStr = filters.startDate.toISOString().split('T')[0];
        }
        
        const startDateParts = startDateStr.split('-');
        const year = parseInt(startDateParts[0]);
        const month = parseInt(startDateParts[1]);
        
        console.log(`🔍 generateReportStats: Extrayendo fechas - startDate=${startDateStr}, year=${year}, month=${month}`);
        console.log(`🔍 Buscando arrastre para mostrar en ${month}/${year}`);
        
        try {
          // Buscar el arrastre que viene HACIA este mes
          // Si estamos viendo septiembre, buscamos el arrastre calculado PARA septiembre (desde agosto)
          // Si estamos viendo octubre, buscamos el arrastre calculado PARA octubre (desde septiembre)
          
          console.log(`🔍 Buscando arrastre calculado PARA ${month}/${year}`);
          monthlyCarryover = await carryoverService.getCarryoverForMonth(year, month);
          console.log('📊 Resultado de carryover desde registro:', monthlyCarryover);
          
          if (monthlyCarryover && monthlyCarryover.saldoArrastre > 0) {
            stats.carryoverIncome = monthlyCarryover.saldoArrastre;
            console.log(`✅ Arrastre aplicado: ${monthlyCarryover.saldoArrastre} del ${monthlyCarryover.previousMonth}/${monthlyCarryover.previousYear}`);
          } else {
            console.log(`❌ No hay arrastre para ${month}/${year} o es 0`, {
              hasCarryover: !!monthlyCarryover,
              saldoArrastre: monthlyCarryover?.saldoArrastre
            });
          }
        } catch (error) {
          console.warn('⚠️ Error obteniendo arrastre:', error.message);
        }
      }

      // Get reference data
      const [concepts, providers, descriptions, generals] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll(),
        generalService.getAll()
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

      const generalMap = {};
      generals.forEach(general => {
        generalMap[general.id] = general.name;
      });

      // Use the already declared hasDateFilter and define date range variables
      const startDate = hasDateFilter ? new Date(filters.startDate) : null;
      let endDate = null;
      if (hasDateFilter) {
        endDate = new Date(filters.endDate);
        // Ajustar la fecha de fin para incluir todo el día (23:59:59)
        endDate.setHours(23, 59, 59, 999);
      }

    
      // Process transactions
      transactions.forEach(transaction => {
        const amount = transaction.amount || 0;
        const conceptName = conceptMap[transaction.conceptId] || 'Sin concepto';
        const providerName = providerMap[transaction.providerId] || 'Sin proveedor';
        const generalName = generalMap[transaction.generalId] || 'Sin categoría general';
        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const month = transactionDate.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });

        // Determine if this transaction is from the current period or carried over
        // Solo las transacciones pendientes de MESES ANTERIORES son arrastre
        // Las transacciones pendientes del período actual NO son arrastre
        const isCarryover = transaction.status === 'pendiente' && 
                           transaction.type === 'salida' && 
                           hasDateFilter && 
                           transactionDate < startDate;
        
        // Verificar si la transacción está dentro del período seleccionado
        const isInPeriod = !hasDateFilter || 
          (transactionDate >= startDate && transactionDate <= endDate);

        // Log para debugging de clasificación de transacciones
        if (isInPeriod && transaction.type === 'salida') {
          console.log(`🔍 Clasificando transacción:`, {
            id: transaction.id.substring(0, 8),
            date: transactionDate.toISOString().split('T')[0],
            amount,
            status: transaction.status,
            isRecurring: transaction.isRecurring,
            isCarryover,
            isInPeriod,
            description: transaction.description?.substring(0, 30)
          });
        }

       

        // Basic stats
        if (transaction.type === 'entrada') {
          // Solo contabilizar entradas que estén en el período Y que NO sean arrastre
          if (isInPeriod && !transaction.isCarryover) {
            stats.totalEntradas += amount;
            stats.entradasCount++;
            stats.currentPeriodBalance += amount;
          }
          // Si es una transacción de arrastre del período actual, no la contamos en totalEntradas
          // pero sí en el balance del período
          else if (isInPeriod && transaction.isCarryover) {
            stats.currentPeriodBalance += amount;
          }
        } else if (transaction.type === 'salida') {
          if (isInPeriod && !isCarryover) {
            // Salidas del período actual (incluye pendientes del período)
            stats.totalSalidas += amount;
            stats.salidasCount++;
            stats.currentPeriodBalance -= amount;
            
            console.log(`✅ Contabilizando gasto del período:`, {
              id: transaction.id.substring(0, 8),
              amount,
              status: transaction.status,
              totalSalidas: stats.totalSalidas,
              salidasCount: stats.salidasCount
            });
          }
          
          if (isCarryover) {
            // TODAS las transacciones pendientes contribuyen al arrastre
            // (incluyendo las del período actual y meses anteriores)
            stats.carryoverBalance -= (transaction.balance || amount);
          }
          
          // Calcular total pagado para todas las transacciones de salida
          const totalPaid = transaction.totalPaid || 0;
          stats.totalPaid += totalPaid;
          
          console.log(`💰 Procesando gasto - totalPaid: ${totalPaid}, stats.totalPaid acumulado: ${stats.totalPaid}`);
          
          // Payment status (only for salidas)
          const status = transaction.status || 'pendiente';
          
          if (isCarryover && status === 'pendiente') {
            // Gastos pendientes de meses anteriores van a categoría especial
            stats.paymentStatus.pendienteAnterior.count++;
            stats.paymentStatus.pendienteAnterior.carryover += transaction.balance || amount;
          } else if (stats.paymentStatus[status]) {
            // Gastos del período actual (incluye pendientes del período)
            stats.paymentStatus[status].count++;
            // Para transacciones pagadas, usar amount; para pendientes, usar balance
            const amountToAdd = status === 'pagado' ? amount : (transaction.balance || amount);
            stats.paymentStatus[status].amount += amountToAdd;
          }
        }

        // Concept breakdown - solo para transacciones del período actual
        if (isInPeriod && !isCarryover) {
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
        }

        // General breakdown - solo para transacciones del período actual
        if (isInPeriod && !isCarryover) {
          if (!stats.generalBreakdown[generalName]) {
            stats.generalBreakdown[generalName] = {
              entradas: 0,
              salidas: 0,
              total: 0,
              count: 0
            };
          }
          
          if (transaction.type === 'entrada') {
            stats.generalBreakdown[generalName].entradas += amount;
          } else {
            stats.generalBreakdown[generalName].salidas += amount;
          }
          stats.generalBreakdown[generalName].total += amount;
          stats.generalBreakdown[generalName].count++;
        }

        // Provider breakdown (solo para salidas) - solo para transacciones del período actual
        if (isInPeriod && !isCarryover && transaction.type === 'salida' && transaction.providerId) {
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

        // Monthly breakdown - solo para transacciones del período actual
        if (isInPeriod && !isCarryover) {
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
        }
      });

      // Calculate derived stats
      // IMPORTANTE: Los gastos pendientes NO deben reducir el arrastre
      // El arrastre (carryoverIncome) es saldo positivo disponible
      // Los gastos pendientes (carryoverBalance) son obligaciones futuras, no reducen el saldo actual
      stats.totalBalance = stats.currentPeriodBalance + stats.carryoverIncome;
      
      console.log('💰 Cálculo de balance corregido:', {
        currentPeriodBalance: stats.currentPeriodBalance,
        carryoverIncome: stats.carryoverIncome,
        carryoverBalance: stats.carryoverBalance,
        totalBalance: stats.totalBalance,
        note: 'Gastos pendientes NO reducen el balance total'
      });
      stats.averageEntrada = stats.entradasCount > 0 ? stats.totalEntradas / stats.entradasCount : 0;
      stats.averageSalida = stats.salidasCount > 0 ? stats.totalSalidas / stats.salidasCount : 0;

      // Log final de estadísticas
      console.log('📊 Stats finales:', {
        totalEntradas: stats.totalEntradas,
        totalSalidas: stats.totalSalidas,
        totalPaid: stats.totalPaid,
        carryoverIncome: stats.carryoverIncome,
        currentPeriodBalance: stats.currentPeriodBalance,
        carryoverBalance: stats.carryoverBalance,
        totalBalance: stats.totalBalance,
        generalBreakdownCount: Object.keys(stats.generalBreakdown).length,
        conceptBreakdownCount: Object.keys(stats.conceptBreakdown).length,
        providerBreakdownCount: Object.keys(stats.providerBreakdown).length
      });

      return stats;
    } catch (error) {
      console.error('Error generating report stats:', error);
      throw new Error('Error al generar estadísticas del reporte');
    }
  },

  // Export to Excel
  async exportToExcel(transactions, stats, filters) {
    try {
      // Validar que stats tenga todas las propiedades necesarias
      if (!stats) {
        throw new Error('Stats object is undefined');
      }
      
      // Asegurar que todas las propiedades necesarias estén definidas
      stats.totalPaid = stats.totalPaid || 0;
      stats.totalEntradas = stats.totalEntradas || 0;
      stats.totalSalidas = stats.totalSalidas || 0;
      stats.totalBalance = stats.totalBalance || 0;
      stats.carryoverIncome = stats.carryoverIncome || 0;
      stats.carryoverBalance = stats.carryoverBalance || 0;
      stats.currentPeriodBalance = stats.currentPeriodBalance || (stats.totalEntradas - stats.totalSalidas);
      
      console.log('📊 Validando stats en exportToExcel:', {
        totalPaid: stats.totalPaid,
        totalEntradas: stats.totalEntradas,
        totalSalidas: stats.totalSalidas,
        totalBalance: stats.totalBalance,
        carryoverIncome: stats.carryoverIncome,
        carryoverBalance: stats.carryoverBalance,
        currentPeriodBalance: stats.currentPeriodBalance,
        paymentStatus: stats.paymentStatus
      });
      
      // Log específico para gastos pendientes
      console.log('🔍 Detalles de gastos pendientes:', {
        carryoverBalance: stats.carryoverBalance,
        pendientesCarryover: stats.paymentStatus?.pendiente?.carryover,
        pendientesAmount: stats.paymentStatus?.pendiente?.amount,
        pendientesTotal: (stats.paymentStatus?.pendiente?.carryover || 0) + (stats.paymentStatus?.pendiente?.amount || 0)
      });

      const workbook = XLSX.utils.book_new();

      // Get reference data for lookups
      const [concepts, providers, descriptions, generals] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll(),
        generalService.getAll()
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

      const generalMap = {};
      generals.forEach(general => {
        generalMap[general.id] = general.name;
      });

      // Transactions sheet - con columnas separadas y ordenadas correctamente
      const transactionsData = transactions
        .map(transaction => {
          const isIncome = transaction.type === 'entrada';
          const totalPaid = transaction.totalPaid || 0;
          const balance = transaction.balance || (transaction.type === 'salida' ? transaction.amount - totalPaid : 0);
          
          return {
            'Fecha': new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date)
              .toLocaleDateString('es-ES'),
            'Tipo': transaction.type === 'entrada' ? 'Entrada' : 'Salida',
            'General': generalMap[transaction.generalId] || 'Sin categoría general',
            'Concepto': conceptMap[transaction.conceptId] || 'Sin concepto',
            'Proveedor': providerMap[transaction.providerId] || 'N/A',
            'Ingreso': isIncome ? transaction.amount : '',
            'Gasto': !isIncome ? transaction.amount : '',
            'Total Pagado': !isIncome ? totalPaid : '',
            'Saldo': !isIncome ? balance : '',
            '_sortOrder': isIncome ? 0 : 1 // Para ordenar entradas primero
          };
        })
        .sort((a, b) => {
          // Primero por tipo (entradas primero)
          if (a._sortOrder !== b._sortOrder) {
            return a._sortOrder - b._sortOrder;
          }
          // Luego por General
          return a.General.localeCompare(b.General);
        })
        .map(transaction => {
          // Remover el campo auxiliar de ordenamiento
          const { _sortOrder, ...cleanTransaction } = transaction;
          return cleanTransaction;
        });

      // Agregar filas de totales al final
      transactionsData.push(
        {}, // Fila vacía para separar
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'TOTALES:',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': '',
          'Saldo': ''
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Total Ingresos:',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': '',
          'Saldo': `$${stats.totalEntradas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Total Gastos:',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': '',
          'Saldo': `$${Math.abs(stats.totalSalidas).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Ingresos del mes anterior:',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': '',
          'Saldo': `$${(stats.carryoverIncome || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Gastos pendientes:',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': '',
          'Saldo': (() => {
            // Calcular total de gastos pendientes (carryover + período actual)
            const pendientesCarryover = stats.paymentStatus?.pendiente?.carryover || 0;
            const pendientesAmount = stats.paymentStatus?.pendiente?.amount || 0;
            const totalPendientes = pendientesCarryover + pendientesAmount;
            console.log('💰 Calculando gastos pendientes para Excel:', { pendientesCarryover, pendientesAmount, totalPendientes });
            return `-$${Math.abs(totalPendientes).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
          })()
        },
        {}, // Fila vacía para separar
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'BALANCE FINAL:',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': '',
          'Saldo': `${stats.totalBalance >= 0 ? '+' : ''}$${Math.abs(stats.totalBalance).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        }
      );

      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');

      // Summary sheet
      const summaryData = [
        ['Estadística', 'Valor'],
        ['Total de Transacciones', stats.totalTransactions],
        ['Total Entradas', `${stats.totalEntradas.toLocaleString('es-MX')}`],
        ['Total Salidas', `${stats.totalSalidas.toLocaleString('es-MX')}`],
        ['Balance del Período', `${stats.currentPeriodBalance ? stats.currentPeriodBalance.toLocaleString('es-MX') : (stats.totalEntradas - stats.totalSalidas).toLocaleString('es-MX')}`],
        [''],
        ['Arrastre del Mes Anterior', ''],
        ['Ingresos del mes anterior', `${(stats.carryoverIncome || 0).toLocaleString('es-MX')}`],
        ['Gastos pendientes', `${Math.abs(stats.carryoverBalance || 0).toLocaleString('es-MX')}`],
        ['Total Arrastre', `${((stats.carryoverIncome || 0) + (stats.carryoverBalance || 0)).toLocaleString('es-MX')}`],
        [''],
        ['Balance Total Final', `${stats.totalBalance.toLocaleString('es-MX')}`],
        [''],
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

      // General breakdown sheet - reemplaza la hoja de conceptos
      const generalData = Object.entries(stats.generalBreakdown).map(([general, data]) => ({
        'General': general,
        'Entradas': `${data.entradas.toLocaleString('es-MX')}`,
        'Salidas': `${data.salidas.toLocaleString('es-MX')}`,
        'Total': `${data.total.toLocaleString('es-MX')}`,
        'Cantidad': data.count
      })).sort((a, b) => a.General.localeCompare(b.General)); // Ordenar por General

      const generalSheet = XLSX.utils.json_to_sheet(generalData);
      XLSX.utils.book_append_sheet(workbook, generalSheet, 'Por General');

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
  },

  // Procesar el arrastre mensual de saldos (manual)
  async processMonthlyCarryover(user) {
    try {
      return await carryoverService.processMonthlyCarryover(user);
    } catch (error) {
      console.error('Error processing monthly carryover:', error);
      throw new Error('Error al procesar el arrastre mensual');
    }
  },

  // Verificar y calcular arrastre automáticamente si es necesario
  async checkAndCalculateCarryoverIfNeeded() {
    try {
      return await carryoverService.checkAndCalculateCarryoverIfNeeded();
    } catch (error) {
      console.error('Error checking carryover:', error);
      // No lanzar error para no romper la carga de reportes
      return {
        error: true,
        message: `Error al verificar arrastre: ${error.message}`
      };
    }
  },

  // Obtener información del arrastre para un mes específico
  async getCarryoverInfo(year, month) {
    try {
      return await carryoverService.getCarryoverForMonth(year, month);
    } catch (error) {
      console.error('Error getting carryover info:', error);
      throw new Error('Error al obtener información del arrastre');
    }
  },

  // Obtener el estado del arrastre (si ya fue ejecutado, etc.)
  async getCarryoverStatus(year, month) {
    try {
      return await carryoverService.getCarryoverStatus(year, month);
    } catch (error) {
      console.error('Error getting carryover status:', error);
      return {
        data: null,
        executed: false,
        canExecute: false
      };
    }
  }
};