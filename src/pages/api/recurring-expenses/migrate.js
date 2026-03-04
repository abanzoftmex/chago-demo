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

    console.log('🚀 Starting migration of recurring expenses...');

    const tenantsSnap = await getDocs(collection(db, 'tenants'));
    let totalMigrated = 0;

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      try {
        const count = await recurringExpenseService.migrateExistingExpenses(tenantId);
        totalMigrated += count;
        console.log(`✅ Tenant ${tenantId}: migrated ${count} expenses.`);
      } catch (tenantError) {
        console.error(`❌ Error for tenant ${tenantId}:`, tenantError.message);
      }
    }

    console.log(`🎉 Migration completed! Migrated ${totalMigrated} recurring expenses.`);

    res.status(200).json({
      success: true,
      message: `Migration completed successfully. Migrated ${totalMigrated} recurring expenses.`,
      totalMigrated
    });

  } catch (error) {
    console.error('❌ Error during migration:', error);
    res.status(500).json({
      success: false,
      message: 'Error during migration',
      error: error.message
    });
  }
}
