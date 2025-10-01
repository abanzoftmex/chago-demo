import { transactionService } from "../../../lib/services/transactionService";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log(`🔍 DEBUG: Analizando transacciones de septiembre 2025`);

    // Obtener todas las transacciones de septiembre 2025
    const startDate = new Date(2025, 8, 1); // Septiembre = mes 8 (0-based)
    const endDate = new Date(2025, 8, 30, 23, 59, 59); // 30 de septiembre
    
    console.log(`Rango: ${startDate.toISOString()} - ${endDate.toISOString()}`);
    
    const transactions = await transactionService.getByDateRange(startDate, endDate);
    
    // Analizar por tipo y estado
    let totalIngresos = 0;
    let totalGastosPagados = 0;
    let totalGastosPendientes = 0;
    let totalGastosOtros = 0;
    
    const breakdown = {
      ingresos: { count: 0, amount: 0, transactions: [] },
      gastos_pagados: { count: 0, amount: 0, transactions: [] },
      gastos_pendientes: { count: 0, amount: 0, transactions: [] },
      gastos_otros: { count: 0, amount: 0, transactions: [] }
    };
    
    transactions.forEach(transaction => {
      const amount = transaction.amount || 0;
      const transactionInfo = {
        id: transaction.id,
        date: (transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date)).toISOString().split('T')[0],
        amount: amount,
        status: transaction.status,
        description: transaction.description?.substring(0, 50),
        type: transaction.type
      };
      
      if (transaction.type === 'entrada') {
        totalIngresos += amount;
        breakdown.ingresos.count++;
        breakdown.ingresos.amount += amount;
        breakdown.ingresos.transactions.push(transactionInfo);
      } else if (transaction.type === 'salida') {
        if (transaction.status === 'pagado') {
          totalGastosPagados += amount;
          breakdown.gastos_pagados.count++;
          breakdown.gastos_pagados.amount += amount;
          breakdown.gastos_pagados.transactions.push(transactionInfo);
        } else if (transaction.status === 'pendiente') {
          totalGastosPendientes += amount;
          breakdown.gastos_pendientes.count++;
          breakdown.gastos_pendientes.amount += amount;
          breakdown.gastos_pendientes.transactions.push(transactionInfo);
        } else {
          totalGastosOtros += amount;
          breakdown.gastos_otros.count++;
          breakdown.gastos_otros.amount += amount;
          breakdown.gastos_otros.transactions.push(transactionInfo);
        }
      }
    });

    // Comparar con lo que muestra la interfaz
    const interfaceData = {
      pagados: { count: 407, amount: 3941799.09 },
      pendientes: { count: 2, amount: 72978.72 }
    };

    const debugInfo = {
      periodo: "Septiembre 2025",
      rango_fechas: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
      total_transacciones: transactions.length,
      
      calculo_cronjob: {
        total_ingresos: totalIngresos,
        total_gastos_pagados: totalGastosPagados,
        total_gastos_pendientes: totalGastosPendientes,
        total_gastos_otros: totalGastosOtros,
        total_gastos_todos: totalGastosPagados + totalGastosPendientes + totalGastosOtros
      },
      
      interfaz_reportes: interfaceData,
      
      diferencias: {
        pagados_diff: totalGastosPagados - interfaceData.pagados.amount,
        pendientes_diff: totalGastosPendientes - interfaceData.pendientes.amount,
        count_pagados_diff: breakdown.gastos_pagados.count - interfaceData.pagados.count,
        count_pendientes_diff: breakdown.gastos_pendientes.count - interfaceData.pendientes.count
      },
      
      breakdown_detallado: {
        ingresos: {
          count: breakdown.ingresos.count,
          amount: breakdown.ingresos.amount
        },
        gastos_pagados: {
          count: breakdown.gastos_pagados.count,
          amount: breakdown.gastos_pagados.amount
        },
        gastos_pendientes: {
          count: breakdown.gastos_pendientes.count,
          amount: breakdown.gastos_pendientes.amount
        },
        gastos_otros: {
          count: breakdown.gastos_otros.count,
          amount: breakdown.gastos_otros.amount,
          estados: [...new Set(breakdown.gastos_otros.transactions.map(t => t.status))]
        }
      },

      // Solo mostrar algunas transacciones para no saturar
      sample_transactions: {
        primeros_5_pagados: breakdown.gastos_pagados.transactions.slice(0, 5),
        todos_los_pendientes: breakdown.gastos_pendientes.transactions,
        todos_los_otros: breakdown.gastos_otros.transactions
      }
    };

    res.status(200).json(debugInfo);

  } catch (error) {
    console.error('[DEBUG] Error analizando transacciones de septiembre:', error);
    res.status(500).json({
      success: false,
      message: 'Error analizando transacciones de septiembre',
      error: error.message
    });
  }
}
