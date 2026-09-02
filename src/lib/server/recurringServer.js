/**
 * Generación de recurrentes, del lado SERVIDOR y con Admin SDK.
 *
 * Existe porque el cron diario (`api/cron/generate-recurring`) llegaba a
 * Firestore con el SDK del NAVEGADOR, es decir sin ninguna identidad: hoy
 * funciona solo porque las reglas publicadas están abiertas de par en par. En
 * cuanto se desplieguen las reglas del repo, ese cron dejaría de generar nada
 * —y en silencio, porque nadie mira su salida—. El Admin SDK no pasa por las
 * reglas, que es exactamente lo que un proceso de sistema necesita.
 *
 * La decisión de CUÁNDO generar no se duplica aquí: vive en `lib/recurring/
 * schedule` y la comparten este módulo y el del navegador. Lo único propio de
 * este archivo es hablar con Firestore.
 */

import admin from "../firebase/firebaseAdmin";
import { getMexicoDate, formatDateKey, shouldGenerateForDate, toDate } from "../recurring/schedule";

const db = () => admin.firestore();

/** Todos los tenants. Solo lo usa el cron, que recorre el sistema entero. */
export async function listTenantIds() {
  const snap = await db().collection("tenants").get();
  return snap.docs.map((d) => d.id);
}

async function listActiveRecurring(tenantId) {
  // Sin `orderBy`: el orden no importa para generar, y pedirlo obligaría a un
  // índice compuesto junto al filtro por isActive.
  const snap = await db()
    .collection(`tenants/${tenantId}/recurringExpenses`)
    .where("isActive", "==", true)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Deja constancia en la bitácora del tenant, con la misma forma que escribe
 * `logService` desde el navegador. Nunca lanza: perder el log no puede
 * impedir que la transacción se genere.
 */
async function logCreation(tenantId, transactionId, transactionData, user) {
  try {
    const userName = user?.displayName || user?.email || "Sistema";
    const tipo = transactionData?.type === "entrada" ? "ingreso" : "gasto";
    await db()
      .collection(`tenants/${tenantId}/logs`)
      .add({
        action: "create",
        entityType: "transaction",
        entityId: transactionId,
        entityData: transactionData,
        userId: user?.uid || "system",
        userName,
        tenantId,
        transactionType: transactionData?.type || "unknown",
        details: `${userName} generó un ${tipo} recurrente (${transactionId})`,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
  } catch (error) {
    console.error("[recurringServer] No se pudo escribir el log:", error.message);
  }
}

/**
 * Genera las transacciones recurrentes que tocan hoy para un tenant.
 *
 * Devuelve las creadas. Es seguro repetirlo el mismo día: `shouldGenerateForDate`
 * mira primero si la fecha ya está en `generatedDates`.
 */
export async function generatePendingTransactions(tenantId, user) {
  const activas = await listActiveRecurring(tenantId);
  const hoy = getMexicoDate();
  const hoyKey = formatDateKey(hoy);
  const generadas = [];

  for (const expense of activas) {
    const generatedDates = expense.generatedDates || expense.generatedMonths || [];
    const frequency = expense.frequency || "monthly";
    const startDate = toDate(expense.startDate);

    if (startDate && startDate > hoy) continue;
    if (!shouldGenerateForDate(hoy, frequency, generatedDates, startDate)) continue;

    const transactionData = {
      type: expense.type || "salida",
      generalId: expense.generalId,
      conceptId: expense.conceptId,
      subconceptId: expense.subconceptId,
      description: `${expense.description} (Recurrente)`,
      amount: expense.amount,
      date: hoy,
      providerId: expense.providerId,
      division: expense.division,
      isRecurring: true,
      recurringExpenseId: expense.id,
    };

    const ref = await db()
      .collection(`tenants/${tenantId}/transacciones`)
      .add({
        ...transactionData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pendiente",
        payments: [],
        totalPaid: 0,
        balance: transactionData.amount,
      });

    const updatedGeneratedDates = [...generatedDates, hoyKey];
    await db()
      .collection(`tenants/${tenantId}/recurringExpenses`)
      .doc(expense.id)
      .update({
        lastGenerated: admin.firestore.FieldValue.serverTimestamp(),
        generatedDates: updatedGeneratedDates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // `generatedMonths` se mantiene por compatibilidad con los mensuales
        // dados de alta antes de que existiera `generatedDates`.
        ...(frequency === "monthly" && { generatedMonths: updatedGeneratedDates }),
      });

    await logCreation(tenantId, ref.id, transactionData, user);
    generadas.push({ id: ref.id, ...transactionData });
  }

  return generadas;
}

/**
 * Rellena los campos que los recurrentes antiguos no traían. Idempotente:
 * solo toca los que les falta algo.
 */
export async function migrateExistingExpenses(tenantId) {
  const snap = await db().collection(`tenants/${tenantId}/recurringExpenses`).get();
  const pendientes = snap.docs.filter((d) => {
    const e = d.data();
    return !e.generatedMonths || !e.generatedDates || !e.frequency || !e.type;
  });

  for (const docSnap of pendientes) {
    const e = docSnap.data();
    const updateData = {
      generatedMonths: e.generatedMonths || [],
      generatedDates: e.generatedDates || [],
      frequency: e.frequency || "monthly",
      type: e.type || "salida",
    };

    // Si ya se generó alguna vez, se infiere esa fecha para no repetirla.
    if (e.lastGenerated && updateData.generatedMonths.length === 0) {
      const last = toDate(e.lastGenerated);
      updateData.generatedMonths.push(`${last.getFullYear()}-${String(last.getMonth()).padStart(2, "0")}`);
      updateData.generatedDates.push(formatDateKey(last));
    }

    await docSnap.ref.update(updateData);
  }

  return pendientes.length;
}
