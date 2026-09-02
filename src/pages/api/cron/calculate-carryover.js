/**
 * Cron mensual del arrastre (vercel.json: 0 6 1 * *).
 *
 * Recorre TODOS los tenants y calcula, para cada uno, el saldo que arrastra
 * del mes anterior.
 *
 * Dos cosas cambiaron respecto a la version anterior:
 *
 *   · Admin SDK. Antes llamaba al servicio del navegador, sin identidad de
 *     Firebase: en cuanto se desplieguen las reglas del repo, sus lecturas y
 *     escrituras quedarian denegadas y el arrastre dejaria de calcularse en
 *     silencio, que es lo peor que puede hacer un cron.
 *   · Por tenant. El arrastre vivia en una coleccion raiz con clave `YYYY-MM`
 *     a secas: un unico documento compartido por todos los tenants, sumandose
 *     al balance total del reporte de cada uno.
 */

import { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { listTenantIds } from "../../../lib/server/recurringServer";
import { calculateAndSaveCarryover, getCarryoverForMonth } from "../../../lib/server/carryoverServer";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ message: "Method not allowed. Use GET or POST." });
  }

  if (!assertAdminInitialized(res)) return;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    console.log(`[CRON] Arrastre de ${month}/${year} — ${today.toISOString()}`);

    const resultados = [];
    let calculados = 0;
    let yaExistian = 0;

    for (const tenantId of await listTenantIds()) {
      try {
        const existente = await getCarryoverForMonth(year, month, tenantId);
        if (existente) {
          yaExistian++;
          resultados.push({ tenantId, saldoArrastre: existente.saldoArrastre, alreadyExists: true });
          continue;
        }

        const data = await calculateAndSaveCarryover(year, month, tenantId);
        calculados++;
        resultados.push({ tenantId, saldoArrastre: data.saldoArrastre, alreadyExists: false });
      } catch (tenantError) {
        // Un tenant que falle no puede dejar sin arrastre a los demas.
        console.error(`[CRON] Error en el tenant ${tenantId}:`, tenantError.message);
        resultados.push({ tenantId, error: tenantError.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Arrastre de ${month}/${year}: ${calculados} calculados, ${yaExistian} ya existían`,
      year,
      month,
      calculados,
      yaExistian,
      resultados,
      date: today.toISOString(),
    });
  } catch (error) {
    console.error("[CRON] Error calculando el arrastre:", error);
    return res.status(500).json({
      success: false,
      message: "Error calculating carryover",
      error: error.message,
      date: new Date().toISOString(),
    });
  }
}
