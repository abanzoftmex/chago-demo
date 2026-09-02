/**
 * Arrastre mensual calculado desde el SERVIDOR, con Admin SDK.
 *
 * Lo usa el cron mensual, que antes llamaba al servicio del navegador: sin
 * identidad de Firebase, sus lecturas y escrituras quedarían denegadas en
 * cuanto se desplieguen las reglas.
 *
 * Y por tenant, como el resto. El arrastre vivía en una colección raíz
 * `monthly_carryover` con clave `YYYY-MM` a secas: un único documento para
 * todos, que además se suma al balance total del reporte y sale impreso en el
 * PDF. Ahora cada tenant tiene el suyo.
 *
 * El cálculo es el mismo que hace el servicio del navegador: ingresos del mes
 * anterior, menos gastos YA PAGADOS, más lo que viniera arrastrado de antes.
 * Un saldo negativo no se arrastra.
 */

import admin from "../firebase/firebaseAdmin";

const db = () => admin.firestore();

const carryoverPath = (tenantId) => `tenants/${tenantId}/monthly_carryover`;
const docId = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

export async function getCarryoverForMonth(year, month, tenantId) {
  const snap = await db().collection(carryoverPath(tenantId)).doc(docId(year, month)).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Calcula el arrastre que entra a `month/year` y lo guarda.
 *
 * Devuelve el documento escrito. Repetirlo el mismo mes lo recalcula y
 * sobrescribe: no acumula.
 */
export async function calculateAndSaveCarryover(year, month, tenantId) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const startDate = new Date(prevYear, prevMonth - 1, 1);
  const endDate = new Date(prevYear, prevMonth, 0, 23, 59, 59);

  const snap = await db()
    .collection(`tenants/${tenantId}/transacciones`)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  let totalIngresos = 0;
  let totalGastosPagados = 0;

  for (const doc of snap.docs) {
    const t = doc.data();
    // Una transacción anulada no cuenta: dejó de ser un ingreso o un gasto en
    // el momento en que se anuló. Mismo criterio que `transactionService`.
    if (t.voided === true) continue;

    if (t.type === "entrada") {
      totalIngresos += t.amount || 0;
    } else if (t.type === "salida" && t.status === "pagado") {
      // Solo los gastos ya pagados: un pendiente no ha salido de la caja.
      totalGastosPagados += t.amount || 0;
    }
  }

  const previo = await getCarryoverForMonth(prevYear, prevMonth, tenantId);
  const arrastePrevio = previo?.saldoArrastre > 0 ? previo.saldoArrastre : 0;

  const saldoArrastre = totalIngresos + arrastePrevio - totalGastosPagados;

  const carryoverData = {
    year,
    month,
    previousYear: prevYear,
    previousMonth: prevMonth,
    totalIngresos,
    arrastePrevio,
    totalGastosPagados,
    saldoArrastre: saldoArrastre > 0 ? saldoArrastre : 0,
    calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
    transactionsCount: snap.size,
  };

  await db().collection(carryoverPath(tenantId)).doc(docId(year, month)).set(carryoverData);
  return carryoverData;
}
