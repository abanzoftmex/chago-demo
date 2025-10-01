import { transactionService } from "../../../lib/services/transactionService";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ 
        message: 'Se requieren parámetros year y month',
        example: '/api/debug/recurring-analysis?year=2025&month=9'
      });
    }

    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    console.log(`🔍 DEBUG: Analizando transacciones recurrentes de ${monthInt}/${yearInt}`);

    // Obtener todas las transacciones del mes (correctamente)
    const startDate = new Date(yearInt, monthInt - 1, 1);
    const endDate = new Date(yearInt, monthInt, 0, 23, 59, 59); // Último día del mes
    
    console.log(`Rango: ${startDate.toISOString()} - ${endDate.toISOString()}`);
    
    const allTransactions = await transactionService.getByDateRange(startDate, endDate);
    
    // Separar por tipo de transacción
    const recurring = allTransactions.filter(t => t.isRecurring === true);
    const nonRecurring = allTransactions.filter(t => !t.isRecurring);
    const withRecurringId = allTransactions.filter(t => t.recurringExpenseId);
    
    // Analizar estados
    const statusBreakdown = {
      recurring: {},
      nonRecurring: {},
      all: {}
    };
    
    [recurring, nonRecurring, allTransactions].forEach((group, index) => {
      const key = ['recurring', 'nonRecurring', 'all'][index];
      group.forEach(t => {
        const status = t.status || 'sin_estado';
        if (!statusBreakdown[key][status]) {
          statusBreakdown[key][status] = { count: 0, amount: 0 };
        }
        statusBreakdown[key][status].count++;
        statusBreakdown[key][status].amount += t.amount || 0;
      });
    });

    // Analizar transacciones pagadas recurrentes vs no recurrentes
    const paidRecurring = recurring.filter(t => t.status === 'pagado');
    const paidNonRecurring = nonRecurring.filter(t => t.status === 'pagado');
    
    const paidRecurringAmount = paidRecurring.reduce((sum, t) => sum + (t.amount || 0), 0);
    const paidNonRecurringAmount = paidNonRecurring.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Buscar transacciones que podrían estar siendo excluidas
    const suspiciousTransactions = allTransactions.filter(t => {
      // Transacciones que podrían estar causando la discrepancia
      return t.isRecurring === true || 
             t.recurringExpenseId || 
             !t.status || 
             t.status === 'confirmado' ||
             t.status === 'generado';
    });

    const debugInfo = {
      periodo: `${monthInt}/${yearInt}`,
      rango_fechas: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
      
      resumen: {
        total_transacciones: allTransactions.length,
        transacciones_recurrentes: recurring.length,
        transacciones_no_recurrentes: nonRecurring.length,
        con_recurringExpenseId: withRecurringId.length
      },
      
      estados_por_tipo: statusBreakdown,
      
      transacciones_pagadas: {
        recurrentes: {
          count: paidRecurring.length,
          amount: paidRecurringAmount
        },
        no_recurrentes: {
          count: paidNonRecurring.length,
          amount: paidNonRecurringAmount
        },
        total: {
          count: paidRecurring.length + paidNonRecurring.length,
          amount: paidRecurringAmount + paidNonRecurringAmount
        }
      },
      
      posibles_excluidas: {
        count: suspiciousTransactions.length,
        amount: suspiciousTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        sample: suspiciousTransactions.slice(0, 10).map(t => ({
          id: t.id,
          date: (t.date?.toDate ? t.date.toDate() : new Date(t.date)).toISOString().split('T')[0],
          amount: t.amount,
          status: t.status,
          isRecurring: t.isRecurring,
          recurringExpenseId: t.recurringExpenseId ? 'SI' : 'NO',
          description: t.description?.substring(0, 50)
        }))
      },
      
      diferencia_identificada: {
        total_pagadas_bd: paidRecurringAmount + paidNonRecurringAmount,
        total_reportes_interfaz: 3941799.09,
        diferencia: (paidRecurringAmount + paidNonRecurringAmount) - 3941799.09,
        posible_causa: suspiciousTransactions.length > 0 ? 'Transacciones recurrentes o con estados especiales' : 'Otra causa'
      }
    };

    res.status(200).json(debugInfo);

  } catch (error) {
    console.error('[DEBUG] Error analizando transacciones recurrentes:', error);
    res.status(500).json({
      success: false,
      message: 'Error analizando transacciones recurrentes',
      error: error.message
    });
  }
}
