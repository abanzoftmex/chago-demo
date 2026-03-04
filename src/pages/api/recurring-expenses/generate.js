import { recurringExpenseService } from "../../../lib/services/recurringExpenseService";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase/firebaseConfig";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { authorization } = req.headers;
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Iterate all tenants
    const tenantsSnap = await getDocs(collection(db, 'tenants'));
    const systemUser = { uid: 'system', email: 'system@cron' };
    let totalGenerated = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      try {
        await recurringExpenseService.migrateExistingExpenses(tenantId);
        const generated = await recurringExpenseService.generatePendingTransactions(tenantId, systemUser);
        totalGenerated += generated.length;
      } catch (tenantError) {
        console.error(`Error for tenant ${tenantId}:`, tenantError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Generated ${totalGenerated} pending transactions`,
      totalGenerated
    });

  } catch (error) {
    console.error('Error generating recurring transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recurring transactions',
      error: error.message
    });
  }
}