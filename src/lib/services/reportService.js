import { transactionService } from './transactionService';
import { providerService } from './providerService';
import { conceptService } from './conceptService';
import { descriptionService } from './descriptionService';
import { generalService } from './generalService';
import { subconceptService } from './subconceptService';
import { carryoverService } from './carryoverService';
import { createEnhancedPDFReport } from './pdfTemplates';
import { formatDivision } from '../constants/divisions';
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
            subconceptId: filters.subconceptId,
            division: filters.division
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
          // Solo gastos pendientes
          if (transaction.type !== 'salida' || transaction.status !== 'pendiente') {
            return false;
          }

          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
          const transactionYear = transactionDate.getFullYear();
          const transactionMonth = transactionDate.getMonth();

          // Verificar que la fecha esté dentro del rango
          const isInDateRange = (transactionYear < reportYear) ||
            (transactionYear === reportYear && transactionMonth <= reportMonth);

          if (!isInDateRange) return false;

          // Aplicar filtros adicionales a las transacciones de arrastre (solo si se especificaron)
          if (filters.providerId && transaction.providerId !== filters.providerId) {
            return false;
          }

          if (filters.generalId && transaction.generalId !== filters.generalId) {
            return false;
          }

          if (filters.conceptId && transaction.conceptId !== filters.conceptId) {
            return false;
          }

          if (filters.subconceptId && transaction.subconceptId !== filters.subconceptId) {
            return false;
          }

          // Filtro de división: solo aplicar si se especificó Y la transacción tiene división
          if (filters.division) {
            // Si el filtro está activo, solo incluir transacciones que coincidan con esa división
            if (transaction.division !== filters.division) {
              return false;
            }
          }

          return true;
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
          subconceptId: filters.subconceptId,
          division: filters.division
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
        totalTransactions: 0, // Se calculará después como entradasCount + salidasCount
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
        // Estado de pago para INGRESOS
        paymentStatusEntradas: {
          pendiente: { count: 0, amount: 0, balance: 0, carryover: 0 },
          parcial: { count: 0, amount: 0, balance: 0, carryover: 0 },
          pagado: { count: 0, amount: 0, balance: 0, carryover: 0 },
          pendienteAnterior: { count: 0, amount: 0, carryover: 0 }
        },
        // Estado de pago para GASTOS
        paymentStatusSalidas: {
          pendiente: { count: 0, amount: 0, balance: 0, carryover: 0 },
          parcial: { count: 0, amount: 0, balance: 0, carryover: 0 },
          pagado: { count: 0, amount: 0, balance: 0, carryover: 0 },
          pendienteAnterior: { count: 0, amount: 0, carryover: 0 }
        },
        conceptBreakdown: {},
        generalBreakdown: {},
        subconceptBreakdown: {},
        divisionBreakdown: {},
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
      const [concepts, providers, descriptions, generals, subconcepts] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        descriptionService.getAll(),
        generalService.getAll(),
        subconceptService.getAll()
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

      const subconceptMap = {};
      subconcepts.forEach(subconcept => {
        subconceptMap[subconcept.id] = subconcept.name;
      });

      // Crear mapa de jerarquía completa para subconceptos
      const subconceptHierarchyMap = {};
      subconcepts.forEach(subconcept => {
        const concept = concepts.find(c => c.id === subconcept.conceptId);
        if (concept) {
          const general = generals.find(g => g.id === concept.generalId);
          const generalName = general ? general.name : 'Sin General';
          const conceptName = concept.name;
          const subconceptName = subconcept.name;
          
          subconceptHierarchyMap[subconcept.id] = {
            full: `${generalName} > ${conceptName} > ${subconceptName}`,
            general: generalName,
            concept: conceptName,
            subconcept: subconceptName
          };
        } else {
          subconceptHierarchyMap[subconcept.id] = {
            full: subconcept.name,
            general: '',
            concept: '',
            subconcept: subconcept.name
          };
        }
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
        const subconceptName = subconceptMap[transaction.subconceptId] || 'Sin subconcepto';
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

          // Payment status para INGRESOS
          const totalPaid = transaction.totalPaid || 0;
          const status = transaction.status || 'pendiente';

          if (stats.paymentStatusEntradas[status]) {
            stats.paymentStatusEntradas[status].count++;
            
            if (status === 'pagado') {
              // Recibido completamente: amount = total de la transacción, balance = 0
              stats.paymentStatusEntradas[status].amount += amount;
              stats.paymentStatusEntradas[status].balance += 0;
            } else if (status === 'parcial') {
              // Recibido parcialmente: amount = lo recibido hasta ahora, balance = lo que falta
              stats.paymentStatusEntradas[status].amount += totalPaid;
              stats.paymentStatusEntradas[status].balance += (transaction.balance || 0);
            } else if (status === 'pendiente') {
              // Sin recibir: amount = 0 (nada recibido), balance = total de la transacción
              stats.paymentStatusEntradas[status].amount += 0;
              stats.paymentStatusEntradas[status].balance += (transaction.balance || amount);
            }
          }

          // Arrastre de ingresos pendientes de meses anteriores
          const isCarryoverEntrada = transaction.status === 'pendiente' &&
            transaction.type === 'entrada' &&
            hasDateFilter &&
            transactionDate < startDate;

          if (isCarryoverEntrada && status === 'pendiente') {
            stats.paymentStatusEntradas.pendienteAnterior.count++;
            stats.paymentStatusEntradas.pendienteAnterior.carryover += transaction.balance || amount;
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

          // Payment status para GASTOS (salidas)
          // Calcular el status REAL basado en pagos, no en el campo status
          let status;
          if (totalPaid === 0) {
            status = 'pendiente';  // No hay pagos
          } else if (totalPaid > 0 && (transaction.balance > 0)) {
            status = 'parcial';  // Hay pagos pero falta
          } else {
            status = 'pagado';  // Completamente pagado
          }
          
          console.log(`🔍 DEBUG Transaction:`, {
            id: transaction.id.substring(0, 8),
            statusOriginal: transaction.status,
            statusCalculado: status,
            totalPaid: transaction.totalPaid,
            amount: transaction.amount,
            balance: transaction.balance
          });

          if (isCarryover && status === 'pendiente') {
            // Gastos pendientes de meses anteriores van a categoría especial
            stats.paymentStatusSalidas.pendienteAnterior.count++;
            stats.paymentStatusSalidas.pendienteAnterior.carryover += transaction.balance || amount;
          } else if (stats.paymentStatusSalidas[status]) {
            // Gastos del período actual (incluye pendientes del período)
            stats.paymentStatusSalidas[status].count++;
            
            // Para todas las categorías:
            // - amount = lo que se ha pagado (totalPaid)
            // - balance = lo que falta por pagar (transaction.balance)
            if (status === 'pagado') {
              // Pagado completamente: amount = total de la transacción, balance = 0
              stats.paymentStatusSalidas[status].amount += amount;
              stats.paymentStatusSalidas[status].balance += 0;
            } else if (status === 'parcial') {
              // Parcial: amount = lo pagado hasta ahora, balance = lo que falta
              stats.paymentStatusSalidas[status].amount += totalPaid;
              stats.paymentStatusSalidas[status].balance += (transaction.balance || 0);
            } else if (status === 'pendiente') {
              // Pendiente: amount = monto total pendiente, balance = mismo valor (nada pagado aún)
              stats.paymentStatusSalidas[status].amount += (transaction.balance || amount);
              stats.paymentStatusSalidas[status].balance += (transaction.balance || amount);
            }
          }
        }

        // Concept breakdown - solo para transacciones del período actual
        if (isInPeriod && !isCarryover) {
          if (!stats.conceptBreakdown[conceptName]) {
            stats.conceptBreakdown[conceptName] = {
              entradas: 0,
              salidas: 0,
              total: 0,
              count: 0,
              paid: 0,
              pending: 0
            };
          }

          const totalPaid = transaction.totalPaid || 0;
          const balance = transaction.balance || 0;

          if (transaction.type === 'entrada') {
            stats.conceptBreakdown[conceptName].entradas += amount;
          } else {
            stats.conceptBreakdown[conceptName].salidas += amount;
          }
          stats.conceptBreakdown[conceptName].total += amount;
          stats.conceptBreakdown[conceptName].count++;
          stats.conceptBreakdown[conceptName].paid += totalPaid;
          stats.conceptBreakdown[conceptName].pending += balance;
        }

        // General breakdown - solo para transacciones del período actual
        if (isInPeriod && !isCarryover) {
          if (!stats.generalBreakdown[generalName]) {
            stats.generalBreakdown[generalName] = {
              entradas: 0,
              salidas: 0,
              total: 0,
              count: 0,
              paid: 0,
              pending: 0
            };
          }

          const totalPaid = transaction.totalPaid || 0;
          const balance = transaction.balance || 0;

          if (transaction.type === 'entrada') {
            stats.generalBreakdown[generalName].entradas += amount;
          } else {
            stats.generalBreakdown[generalName].salidas += amount;
          }
          stats.generalBreakdown[generalName].total += amount;
          stats.generalBreakdown[generalName].count++;
          stats.generalBreakdown[generalName].paid += totalPaid;
          stats.generalBreakdown[generalName].pending += balance;
        }

        // Subconcept breakdown - solo para transacciones del período actual
        if (isInPeriod && !isCarryover && transaction.subconceptId) {
          if (!stats.subconceptBreakdown[subconceptName]) {
            stats.subconceptBreakdown[subconceptName] = {
              entradas: 0,
              salidas: 0,
              total: 0,
              count: 0,
              paid: 0,
              pending: 0
            };
          }

          const totalPaid = transaction.totalPaid || 0;
          const balance = transaction.balance || 0;

          if (transaction.type === 'entrada') {
            stats.subconceptBreakdown[subconceptName].entradas += amount;
          } else {
            stats.subconceptBreakdown[subconceptName].salidas += amount;
          }
          stats.subconceptBreakdown[subconceptName].total += amount;
          stats.subconceptBreakdown[subconceptName].count++;
          stats.subconceptBreakdown[subconceptName].paid += totalPaid;
          stats.subconceptBreakdown[subconceptName].pending += balance;
        }

        // Division breakdown (solo para salidas) - solo para transacciones del período actual
        if (isInPeriod && !isCarryover && transaction.type === 'salida' && transaction.division) {
          const divisionName = formatDivision(transaction.division);

          if (!stats.divisionBreakdown[divisionName]) {
            stats.divisionBreakdown[divisionName] = {
              amount: 0,
              count: 0,
              pendingAmount: 0
            };
          }

          stats.divisionBreakdown[divisionName].amount += amount;
          stats.divisionBreakdown[divisionName].count++;
          stats.divisionBreakdown[divisionName].pendingAmount += transaction.balance || 0;
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

      // Calcular totalTransactions correctamente como suma de entradas y salidas
      stats.totalTransactions = stats.entradasCount + stats.salidasCount;

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

      // Generar Weekly Breakdown si hay filtro de fechas
      if (hasDateFilter && filters.startDate && filters.endDate) {
        stats.weeklyBreakdown = await this.generateWeeklyBreakdown(
          transactions,
          filters.startDate,
          filters.endDate,
          subconceptHierarchyMap
        );
      }

      return stats;
    } catch (error) {
      console.error('Error generating report stats:', error);
      throw new Error('Error al generar estadísticas del reporte');
    }
  },

  // Generar desglose semanal por subconceptos
  async generateWeeklyBreakdown(transactions, startDate, endDate, subconceptHierarchyMap) {
    try {
      // Parsear fechas
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Obtener el primer y último día del mes
      const firstDay = new Date(start.getFullYear(), start.getMonth(), 1);
      const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0);

      // Calcular semanas del mes según ISO 8601 (lunes a domingo)
      const weeks = [];
      
      // Encontrar el primer lunes del mes (o antes si el mes no empieza en lunes)
      let currentWeekStart = new Date(firstDay);
      const dayOfWeek = currentWeekStart.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
      
      // Ajustar al lunes de esa semana ISO
      // Si es domingo (0), retroceder 6 días; si es lunes (1), no retroceder; etc.
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);

      // Generar semanas ISO 8601 que intersecten con el mes
      while (currentWeekStart <= lastDay) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Domingo
        
        // Solo incluir semanas que tengan al menos un día dentro del mes
        if (weekEnd >= firstDay) {
          // Mostrar fechas ISO completas (aunque crucen meses) para claridad contable
          // Pero usar fechas ajustadas para filtrar transacciones
          const filterStart = currentWeekStart < firstDay ? firstDay : currentWeekStart;
          const filterEnd = weekEnd > lastDay ? lastDay : weekEnd;
          
          // Calcular el número de semana ISO 8601
          const weekNumber = this.getWeekNumber(currentWeekStart);

          weeks.push({
            weekNumber: weekNumber,
            // Mostrar fechas completas ISO (pueden incluir días de otros meses)
            startDate: currentWeekStart.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
            endDate: weekEnd.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }),
            // Usar timestamps ajustados para filtrar transacciones solo del mes
            startTimestamp: filterStart.getTime(),
            endTimestamp: filterEnd.getTime()
          });
        }

        // Avanzar al siguiente lunes
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      }

      // Inicializar estructura de datos
      const salidas = {};
      const entradas = {};

      // Procesar cada transacción
      transactions.forEach(transaction => {
        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const transactionTime = transactionDate.getTime();

        // Encontrar en qué semana cae esta transacción
        const weekIndex = weeks.findIndex(week => 
          transactionTime >= week.startTimestamp && transactionTime <= week.endTimestamp
        );

        if (weekIndex === -1) return; // Transacción fuera del rango de semanas

        // Obtener la jerarquía completa del subconcepto
        const hierarchy = subconceptHierarchyMap[transaction.subconceptId];
        const subconceptKey = hierarchy ? hierarchy.full : 'Sin Subconcepto';
        const amount = parseFloat(transaction.amount) || 0;

        if (transaction.type === 'salida') {
          // Inicializar si no existe
          if (!salidas[subconceptKey]) {
            salidas[subconceptKey] = { total: 0 };
            weeks.forEach((_, index) => {
              salidas[subconceptKey][`week${index + 1}`] = 0;
            });
          }

          // Agregar monto a la semana correspondiente
          salidas[subconceptKey][`week${weekIndex + 1}`] += amount;
          salidas[subconceptKey].total += amount;

        } else if (transaction.type === 'entrada') {
          // Inicializar si no existe
          if (!entradas[subconceptKey]) {
            entradas[subconceptKey] = { total: 0 };
            weeks.forEach((_, index) => {
              entradas[subconceptKey][`week${index + 1}`] = 0;
            });
          }

          // Agregar monto a la semana correspondiente
          entradas[subconceptKey][`week${weekIndex + 1}`] += amount;
          entradas[subconceptKey].total += amount;
        }
      });

      console.log('📅 Weekly Breakdown generado:', {
        weeks: weeks.length,
        salidas: Object.keys(salidas).length,
        entradas: Object.keys(entradas).length
      });

      return {
        weeks,
        salidas,
        entradas
      };
    } catch (error) {
      console.error('Error generando weekly breakdown:', error);
      return {
        weeks: [],
        salidas: {},
        entradas: {}
      };
    }
  },

  // Obtener el número de semana del año
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
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

      // Filtrar transacciones para Excel: NO incluir gastos pendientes de meses anteriores
      let filteredTransactions = transactions;
      if (filters.startDate && filters.endDate) {
        const reportEndDate = new Date(filters.endDate);
        const reportYear = reportEndDate.getFullYear();
        const reportMonth = reportEndDate.getMonth(); // 0-based

        filteredTransactions = transactions.filter(transaction => {
          // Incluir todas las entradas
          if (transaction.type === 'entrada') {
            return true;
          }

          // Para salidas, solo incluir las del período del reporte (no gastos pendientes de meses anteriores)
          if (transaction.type === 'salida') {
            const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
            const transactionYear = transactionDate.getFullYear();
            const transactionMonth = transactionDate.getMonth();

            // Solo incluir gastos del mismo año y mes del reporte
            return transactionYear === reportYear && transactionMonth === reportMonth;
          }

          return true;
        });

        console.log('📊 Filtrado de transacciones para Excel:', {
          reportMonth: `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`,
          totalTransactions: transactions.length,
          filteredTransactions: filteredTransactions.length,
          excluded: transactions.length - filteredTransactions.length,
          note: 'Excluidos gastos pendientes de meses anteriores del Excel'
        });
      }

      // Transactions sheet - con columnas separadas y ordenadas correctamente
      const transactionsData = filteredTransactions
        .map(transaction => {
          const isIncome = transaction.type === 'entrada';
          const totalPaid = transaction.totalPaid || 0;

          return {
            'Fecha': new Date(transaction.date?.toDate ? transaction.date.toDate() : transaction.date)
              .toLocaleDateString('es-ES'),
            'Tipo': transaction.type === 'entrada' ? 'Entrada' : 'Salida',
            'General': generalMap[transaction.generalId] || 'Sin categoría general',
            'Concepto': conceptMap[transaction.conceptId] || 'Sin concepto',
            'Proveedor': providerMap[transaction.providerId] || 'N/A',
            'División': !isIncome ? formatDivision(transaction.division) : 'N/A',
            'Ingreso': isIncome ? transaction.amount : '',
            'Gasto': !isIncome ? transaction.amount : '',
            'Total Pagado': !isIncome ? totalPaid : '',
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

      // Agregar filas de totales al final (sin gastos pendientes)
      // Calcular balance sin gastos pendientes: solo entradas del período + arrastre de ingresos - gastos del período
      const balanceSinPendientes = stats.totalEntradas + (stats.carryoverIncome || 0) - Math.abs(stats.totalSalidas);

      transactionsData.push(
        {}, // Fila vacía para separar
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'TOTALES:',
          'División': '',
          'Ingreso': '',
          'Gasto': '',
          'Total Pagado': ''
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Total Ingresos:',
          'División': '',
          'Ingreso': '',
          'Gasto': `$${stats.totalEntradas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          'Total Pagado': ''
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Total Gastos:',
          'División': '',
          'Ingreso': '',
          'Gasto': `$${Math.abs(stats.totalSalidas).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          'Total Pagado': ''
        },
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'Ingresos del mes anterior:',
          'División': '',
          'Ingreso': '',
          'Gasto': `$${(stats.carryoverIncome || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          'Total Pagado': ''
        },
        {}, // Fila vacía para separar
        {
          'Fecha': '',
          'Tipo': '',
          'General': '',
          'Concepto': '',
          'Proveedor': 'BALANCE FINAL:',
          'División': '',
          'Ingreso': '',
          'Gasto': `${balanceSinPendientes >= 0 ? '+' : ''}$${Math.abs(balanceSinPendientes).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
          'Total Pagado': ''
        }
      );

      const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData);
      XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transacciones');

      // Summary sheet (sin gastos pendientes)
      const summaryData = [
        ['Estadística', 'Valor'],
        ['Total de Transacciones', stats.totalTransactions],
        ['Total Entradas', `${stats.totalEntradas.toLocaleString('es-MX')}`],
        ['Total Salidas', `${stats.totalSalidas.toLocaleString('es-MX')}`],
        ['Balance del Período', `${stats.currentPeriodBalance ? stats.currentPeriodBalance.toLocaleString('es-MX') : (stats.totalEntradas - stats.totalSalidas).toLocaleString('es-MX')}`],
        [''],
        ['Arrastre del Mes Anterior', ''],
        ['Ingresos del mes anterior', `${(stats.carryoverIncome || 0).toLocaleString('es-MX')}`],
        [''],
        ['Balance Total Final', `${balanceSinPendientes.toLocaleString('es-MX')}`],
        [''],
        ['Promedio Entradas', `${stats.averageEntrada.toLocaleString('es-MX')}`],
        ['Promedio Salidas', `${stats.averageSalida.toLocaleString('es-MX')}`]
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

      // Division breakdown sheet - nueva hoja para gastos por división
      const divisionBreakdown = {};

      // Calcular totales por división usando las transacciones filtradas
      filteredTransactions.forEach(transaction => {
        // Solo procesar gastos (salidas) que tengan división
        if (transaction.type === 'salida' && transaction.division) {
          const divisionLabel = formatDivision(transaction.division);

          if (!divisionBreakdown[divisionLabel]) {
            divisionBreakdown[divisionLabel] = {
              gastos: 0,
              cantidad: 0
            };
          }

          divisionBreakdown[divisionLabel].gastos += transaction.amount;
          divisionBreakdown[divisionLabel].cantidad++;
        }
      });

      // Calcular total de gastos para porcentajes
      const totalGastosPorDivision = Object.values(divisionBreakdown)
        .reduce((sum, division) => sum + division.gastos, 0);

      const divisionData = Object.entries(divisionBreakdown).map(([division, data]) => ({
        'División': division,
        'Total Gastos': `$${data.gastos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        'Cantidad de Transacciones': data.cantidad,
        'Porcentaje del Total': `${((data.gastos / totalGastosPorDivision) * 100).toFixed(2)}%`
      })).sort((a, b) => {
        // Ordenar por monto de gastos (mayor a menor)
        const amountA = parseFloat(a['Total Gastos'].replace(/[$,]/g, ''));
        const amountB = parseFloat(b['Total Gastos'].replace(/[$,]/g, ''));
        return amountB - amountA;
      });

      // Agregar fila de total
      if (divisionData.length > 0) {
        divisionData.push(
          {}, // Fila vacía
          {
            'División': 'TOTAL GENERAL:',
            'Total Gastos': `$${totalGastosPorDivision.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
            'Cantidad de Transacciones': Object.values(divisionBreakdown).reduce((sum, d) => sum + d.cantidad, 0),
            'Porcentaje del Total': '100.00%'
          }
        );
      }

      const divisionSheet = XLSX.utils.json_to_sheet(divisionData);
      XLSX.utils.book_append_sheet(workbook, divisionSheet, 'Por División');

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
        providerService,
        generalService,
        subconceptService
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