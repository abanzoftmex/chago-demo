import { transactionService } from "../../../lib/services/transactionService";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { upToYear, upToMonth } = req.query;
    
    if (!upToYear || !upToMonth) {
      return res.status(400).json({ 
        message: 'Se requieren parámetros upToYear y upToMonth',
        example: '/api/debug/pending-transactions?upToYear=2025&upToMonth=10'
      });
    }

    const yearInt = parseInt(upToYear);
    const monthInt = parseInt(upToMonth);

    console.log(`🔍 DEBUG: Obteniendo gastos pendientes hasta ${monthInt}/${yearInt}`);

    // Obtener todas las transacciones pendientes
    const allTransactions = await transactionService.getAll({
      type: 'salida',
      status: 'pendiente'
    });

    const reportEndDate = new Date(yearInt, monthInt - 1, 31); // Último día del mes
    
    // Filtrar por mes como hace el sistema
    const filteredPending = allTransactions.filter(transaction => {
      const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
      const transactionYear = transactionDate.getFullYear();
      const transactionMonth = transactionDate.getMonth() + 1; // 1-based
      
      return (transactionYear < yearInt) || 
             (transactionYear === yearInt && transactionMonth <= monthInt);
    });

    // Agrupar por mes
    const byMonth = {};
    let totalAmount = 0;

    filteredPending.forEach(transaction => {
      const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
      const monthKey = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          count: 0,
          amount: 0,
          transactions: []
        };
      }
      
      const amount = transaction.amount || 0;
      byMonth[monthKey].count++;
      byMonth[monthKey].amount += amount;
      byMonth[monthKey].transactions.push({
        id: transaction.id,
        date: transactionDate.toISOString().split('T')[0],
        amount: amount,
        description: transaction.description?.substring(0, 50),
        balance: transaction.balance || amount
      });
      
      totalAmount += amount;
    });

    const debugInfo = {
      filtro_aplicado: {
        hasta_año: yearInt,
        hasta_mes: monthInt,
        fecha_limite: reportEndDate.toISOString().split('T')[0]
      },
      resumen: {
        total_pendientes_sistema: allTransactions.length,
        total_filtrados: filteredPending.length,
        total_amount: totalAmount,
        meses_con_pendientes: Object.keys(byMonth).length
      },
      por_mes: byMonth,
      todas_las_pendientes: allTransactions.map(t => {
        const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
        return {
          id: t.id,
          date: tDate.toISOString().split('T')[0],
          amount: t.amount,
          description: t.description?.substring(0, 50),
          incluida_en_filtro: (tDate.getFullYear() < yearInt) || 
                              (tDate.getFullYear() === yearInt && (tDate.getMonth() + 1) <= monthInt)
        };
      })
    };

    res.status(200).json(debugInfo);

  } catch (error) {
    console.error('[DEBUG] Error obteniendo transacciones pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo transacciones pendientes',
      error: error.message
    });
  }
}
