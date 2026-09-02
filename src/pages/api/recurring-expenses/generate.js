/**
 * POST /api/recurring-expenses/generate
 *
 * Dispara a mano la generación de recurrentes de todos los tenants — lo mismo
 * que hace el cron diario, para cuando hay que adelantarlo o reintentarlo.
 *
 * Usa Admin SDK (`lib/server/recurringServer`), no el SDK del navegador: es un
 * proceso de sistema y no tiene ninguna identidad de Firebase que las reglas
 * de Firestore puedan autorizar.
 */

import { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { listTenantIds, generatePendingTransactions, migrateExistingExpenses } from "../../../lib/server/recurringServer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!assertAdminInitialized(res)) return;

  // Antes bastaba con mandar cualquier cabecera que empezara por "Bearer ":
  // no se comparaba contra nada, así que cualquiera podía disparar la
  // generación de todos los tenants.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const systemUser = { uid: "system", email: "system@cron" };
    let totalGenerated = 0;

    for (const tenantId of await listTenantIds()) {
      try {
        await migrateExistingExpenses(tenantId);
        const generated = await generatePendingTransactions(tenantId, systemUser);
        totalGenerated += generated.length;
      } catch (tenantError) {
        // Un tenant que falle no puede dejar sin generar a los demás.
        console.error(`Error for tenant ${tenantId}:`, tenantError.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Generated ${totalGenerated} pending transactions`,
      totalGenerated,
    });
  } catch (error) {
    console.error("Error generating recurring transactions:", error);
    return res.status(500).json({
      success: false,
      message: "Error generating recurring transactions",
      error: error.message,
    });
  }
}
