/**
 * POST /api/recurring-expenses/migrate
 *
 * Rellena los campos que los recurrentes antiguos no traían (`frequency`,
 * `type`, `generatedDates`). Idempotente: solo toca los que les falta algo.
 *
 * Admin SDK, por lo mismo que `generate`: es un proceso de sistema, sin
 * identidad de Firebase que las reglas puedan autorizar.
 */

import { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { listTenantIds, migrateExistingExpenses } from "../../../lib/server/recurringServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!assertAdminInitialized(res)) return;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    let totalMigrated = 0;

    for (const tenantId of await listTenantIds()) {
      try {
        totalMigrated += await migrateExistingExpenses(tenantId);
      } catch (tenantError) {
        console.error(`Error for tenant ${tenantId}:`, tenantError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Migration completed successfully. Migrated ${totalMigrated} recurring expenses.`,
      totalMigrated,
    });
  } catch (error) {
    console.error("Error during migration:", error);
    return res.status(500).json({
      success: false,
      message: "Error during migration",
      error: error.message,
    });
  }
}
