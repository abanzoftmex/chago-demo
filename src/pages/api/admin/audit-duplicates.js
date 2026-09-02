/**
 * API Endpoint para ejecutar auditoría de duplicados
 *
 * GET /api/admin/audit-duplicates
 *
 * Lee la colección legacy `transactions` con Admin SDK. Antes usaba el SDK del
 * navegador y NO comprobaba nada: cualquiera podía pedirla, y solo las reglas
 * abiertas de producción la dejaban funcionar. Como el Admin SDK no pasa por
 * las reglas, sin una puerta propia esto se convertiría en la única forma de
 * leer esos datos sin autenticarse — así que lleva la misma cookie de sesión
 * de configuración que el resto de rutas de superadmin.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;
  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  try {
    const OCTOBER_31_2025 = new Date('2025-10-31T00:00:00');
    const NOVEMBER_7_2025 = new Date('2025-11-07T23:59:59');

    console.log('🔍 API: Iniciando auditoría de duplicados...');

    // Obtener todas las transacciones recurrentes del período
    const querySnapshot = await admin
      .firestore()
      .collection("transactions")
      .where("isRecurring", "==", true)
      .orderBy("date", "asc")
      .get();
    const transactions = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const transactionDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      
      if (transactionDate >= OCTOBER_31_2025 && transactionDate <= NOVEMBER_7_2025) {
        transactions.push({
          id: doc.id,
          ...data,
          date: transactionDate,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        });
      }
    });

    // Agrupar por recurringExpenseId
    const groupedByRecurringExpense = {};
    
    transactions.forEach(transaction => {
      const key = transaction.recurringExpenseId;
      if (!key) return;
      
      if (!groupedByRecurringExpense[key]) {
        groupedByRecurringExpense[key] = [];
      }
      groupedByRecurringExpense[key].push(transaction);
    });

    // Detectar duplicados
    const duplicates = [];
    const duplicateGroups = [];

    Object.entries(groupedByRecurringExpense).forEach(([recurringExpenseId, txns]) => {
      if (txns.length > 1) {
        const amounts = [...new Set(txns.map(t => t.amount))];
        
        if (amounts.length === 1) {
          duplicateGroups.push({
            recurringExpenseId,
            amount: amounts[0],
            count: txns.length,
            transactions: txns.map(t => ({
              id: t.id,
              date: t.date.toISOString(),
              createdAt: t.createdAt.toISOString(),
              amount: t.amount,
              description: t.description,
              status: t.status
            }))
          });
          
          txns.forEach(txn => duplicates.push(txn));
        }
      }
    });

    const totalAmountDuplicated = duplicates.reduce((sum, txn) => sum + txn.amount, 0);

    // Generar datos para CSV (formato simple)
    const csvData = duplicates.map(txn => ({
      transactionId: txn.id,
      recurringExpenseId: txn.recurringExpenseId || 'N/A',
      userId: txn.userId || 'N/A',
      amount: txn.amount,
      date: txn.date.toISOString().split('T')[0],
      createdAt: txn.createdAt.toISOString(),
      description: txn.description || '',
      status: txn.status || 'N/A'
    }));

    return res.status(200).json({
      success: true,
      summary: {
        totalTransactionsAnalyzed: transactions.length,
        duplicateGroupsFound: duplicateGroups.length,
        totalDuplicateTransactions: duplicates.length,
        totalAmountDuplicated: totalAmountDuplicated,
        dateRange: {
          from: OCTOBER_31_2025.toISOString().split('T')[0],
          to: NOVEMBER_7_2025.toISOString().split('T')[0]
        }
      },
      duplicateGroups,
      csvData,
      message: duplicates.length > 0 
        ? `Se encontraron ${duplicates.length} transacciones duplicadas en ${duplicateGroups.length} grupos`
        : 'No se encontraron duplicados en el período analizado'
    });

  } catch (error) {
    console.error('❌ Error en auditoría:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al ejecutar la auditoría',
      error: error.message
    });
  }
}
