/**
 * Cron diario de recurrentes (vercel.json: 0 6 * * *).
 *
 * Habla con Firestore por Admin SDK. Antes lo hacía con el SDK del NAVEGADOR,
 * o sea sin identidad: funcionaba solo porque las reglas publicadas están
 * abiertas, y habría dejado de generar —en silencio— el día que se
 * desplegaran las del repo.
 */

import { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import {
  listTenantIds,
  generatePendingTransactions,
  migrateExistingExpenses,
} from "../../../lib/server/recurringServer";

export default async function handler(req, res) {
  // Vercel cron jobs send GET requests, but we also support POST for manual testing
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed. Use GET or POST.' });
  }

  try {
    // Verify the request is coming from a trusted source (optional in development)
    const { authorization } = req.headers;
    const cronSecret = process.env.CRON_SECRET;
    
    // Only validate authorization if CRON_SECRET is set
    if (cronSecret && (!authorization || authorization !== `Bearer ${cronSecret}`)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Log if running without security (for development)
    if (!cronSecret) {
      console.log('[CRON] Running without CRON_SECRET - development mode');
    }

    const today = new Date();

    if (!assertAdminInitialized(res)) return;

    const systemUser = { uid: 'system-cron', email: 'system@cron' };
    let totalGenerated = 0;

    for (const tenantId of await listTenantIds()) {
      try {
        await migrateExistingExpenses(tenantId);
        const generated = await generatePendingTransactions(tenantId, systemUser);
        totalGenerated += generated.length;
        console.log(`[CRON] Tenant ${tenantId}: generated ${generated.length} transactions`);
      } catch (tenantError) {
        console.error(`[CRON] Error for tenant ${tenantId}:`, tenantError.message);
      }
    }

    console.log(`[CRON] Total generated ${totalGenerated} recurring transactions on ${today.toISOString()}`);

    res.status(200).json({
      success: true,
      message: `Generated ${totalGenerated} recurring transactions`,
      totalGenerated,
      date: today.toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Error generating recurring transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recurring transactions',
      error: error.message
    });
  }
}

// Example cron job setup (add to your deployment platform):
// 
// For Vercel, add to vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/generate-recurring",
//       "schedule": "0 0 1 * *"
//     }
//   ]
// }
//
// For other platforms, set up a cron job to call:
// curl -X POST https://your-domain.com/api/cron/generate-recurring \
//   -H "Authorization: Bearer your-secret-key"