/**
 * Regulariza los pagos de las transacciones que llegaron del punto de venta
 * ANTES de que la integración creara el pago junto con la transacción.
 *
 * Esas transacciones nacieron con status 'pagado' pero sin ningún documento en
 * `tenants/{t}/payments`: la pantalla de pagos las mostraba con saldo pendiente
 * y el reporte de pagos reales no las veía.
 *
 * Por cada transacción con `origen:'pos_sync'`:
 *   · sin ningún pago             → crea `pos_<id>` por el monto total, con la
 *                                   fecha de la venta o compra. Si la
 *                                   transacción está anulada, el pago nace anulado.
 *   · con su `pos_<id>`           → nada, salvo que la transacción esté anulada
 *                                   y el pago no: entonces lo marca anulado.
 *   · con pagos capturados a mano → NO toca nada y la lista para revisarla: crear
 *                                   el pago del POS encima contaría doble.
 *
 * Por defecto solo LISTA. Escribe únicamente con --apply. Nunca borra ni
 * sobrescribe un pago (usa `create`), así que correrlo dos veces es seguro.
 *
 * Uso (desde la raíz del proyecto):
 *   node scripts/backfill-pos-payments.cjs                  # simulación
 *   node scripts/backfill-pos-payments.cjs --tenant=<id>    # un solo tenant
 *   node scripts/backfill-pos-payments.cjs --apply          # escribe
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const APPLY = process.argv.includes("--apply");
const TENANT_ARG = process.argv.find((a) => a.startsWith("--tenant="));
const ONLY_TENANT = TENANT_ARG ? TENANT_ARG.slice("--tenant=".length) : null;
const BATCH_LIMIT = 400; // Firestore admite 500 escrituras por lote

// Mismo formato que `src/lib/server/posTransactionWriter.js` (ese archivo es
// ESM de Next y no se puede requerir desde aquí). Si cambia allá, cambia aquí.
const posPaymentId = (transactionId) => `pos_${transactionId}`;
const posPaymentNotes = (posKind) =>
  posKind === "compra" ? "Pago registrado por el punto de venta" : "Cobro registrado por el punto de venta";

function initAdmin() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/^"|"$/g, "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL o FIREBASE_PRIVATE_KEY en .env.local");
  }
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  return { db: admin.firestore(), projectId };
}

const money = (n) =>
  `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const day = (d) => {
  const date = d?.toDate ? d.toDate() : new Date(d);
  return Number.isNaN(date.getTime()) ? "sin fecha " : date.toISOString().slice(0, 10);
};

async function planTenant(db, tenantId) {
  const txSnap = await db
    .collection(`tenants/${tenantId}/transacciones`)
    .where("origen", "==", "pos_sync")
    .get();
  if (txSnap.empty) return null;

  const paySnap = await db.collection(`tenants/${tenantId}/payments`).get();
  const paymentsByTx = new Map();
  paySnap.forEach((p) => {
    const key = p.data().transactionId;
    if (!paymentsByTx.has(key)) paymentsByTx.set(key, []);
    paymentsByTx.get(key).push(p);
  });

  const plan = { tenantId, total: txSnap.size, ok: 0, create: [], voidPayment: [], review: [] };
  txSnap.forEach((tx) => {
    const payments = paymentsByTx.get(tx.id) || [];
    const own = payments.find((p) => p.id === posPaymentId(tx.id));
    if (own) {
      if (tx.data().voided === true && own.data().voided !== true) plan.voidPayment.push(tx);
      else plan.ok++;
      return;
    }
    if (payments.length > 0) {
      plan.review.push({ tx, payments });
      return;
    }
    plan.create.push(tx);
  });
  return plan;
}

function printPlan(plan) {
  const line = (tx, extra = "") => {
    const d = tx.data();
    const kind = (d.posKind || "venta").padEnd(6);
    return `    ${day(d.date)}  ${money(d.amount).padStart(12)}  ${kind}  ${tx.id}  ${d.voided ? "[anulada] " : ""}${d.description || ""}${extra}`;
  };

  console.log(`\n── Tenant ${plan.tenantId} — ${plan.total} transacciones del POS, ${plan.ok} ya correctas`);
  if (plan.create.length) {
    const sum = plan.create.reduce((s, tx) => s + Number(tx.data().amount || 0), 0);
    console.log(`  + Crear pago (${plan.create.length}, ${money(sum)}):`);
    plan.create.forEach((tx) => console.log(line(tx)));
  }
  if (plan.voidPayment.length) {
    console.log(`  ✕ Marcar pago como anulado (${plan.voidPayment.length}):`);
    plan.voidPayment.forEach((tx) => console.log(line(tx)));
  }
  if (plan.review.length) {
    console.log(`  ? Revisar a mano — ya tienen pagos capturados en chago-demo, NO se tocan (${plan.review.length}):`);
    plan.review.forEach(({ tx, payments }) => {
      const paid = payments.reduce((s, p) => s + Number(p.data().amount || 0), 0);
      console.log(line(tx, `  → ${payments.length} pago(s) por ${money(paid)}`));
    });
  }
}

async function applyPlan(db, plan) {
  const now = admin.firestore.FieldValue.serverTimestamp();
  const paymentsCol = db.collection(`tenants/${plan.tenantId}/payments`);
  const ops = [];

  plan.create.forEach((tx) => {
    const d = tx.data();
    const voided = d.voided === true;
    ops.push((batch) =>
      batch.create(paymentsCol.doc(posPaymentId(tx.id)), {
        transactionId: tx.id,
        amount: Number(d.amount),
        date: d.date, // la fecha de la venta o compra en el POS, no la de hoy
        notes: posPaymentNotes(d.posKind),
        attachments: [],
        origen: "pos_sync",
        locked: true,
        voided,
        ...(voided
          ? { voidedAt: d.voidedAt || now, voidReason: d.voidReason || "Movimiento cancelado en punto de venta" }
          : {}),
        createdAt: now,
        backfilledAt: now, // marca de este script, por si hay que auditarlo o revertirlo
      })
    );
  });

  plan.voidPayment.forEach((tx) => {
    const d = tx.data();
    ops.push((batch) =>
      batch.update(paymentsCol.doc(posPaymentId(tx.id)), {
        voided: true,
        voidedAt: d.voidedAt || now,
        voidReason: d.voidReason || "Movimiento cancelado en punto de venta",
      })
    );
  });

  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
  return ops.length;
}

async function main() {
  const { db, projectId } = initAdmin();
  console.log(`Proyecto: ${projectId}`);
  console.log(APPLY ? "Modo: ESCRIBIR (--apply)" : "Modo: simulación — no se escribe nada");

  const tenantIds = ONLY_TENANT
    ? [ONLY_TENANT]
    : (await db.collection("tenants").listDocuments()).map((ref) => ref.id);

  const totals = { tenants: 0, create: 0, createAmount: 0, voidPayment: 0, review: 0, written: 0 };
  for (const tenantId of tenantIds) {
    const plan = await planTenant(db, tenantId);
    if (!plan) continue;
    totals.tenants++;
    totals.create += plan.create.length;
    totals.createAmount += plan.create.reduce((s, tx) => s + Number(tx.data().amount || 0), 0);
    totals.voidPayment += plan.voidPayment.length;
    totals.review += plan.review.length;
    printPlan(plan);
    if (APPLY) totals.written += await applyPlan(db, plan);
  }

  console.log("\n══ Resumen");
  console.log(`  Tenants con transacciones del POS: ${totals.tenants}`);
  console.log(`  Pagos a crear:                     ${totals.create} (${money(totals.createAmount)})`);
  console.log(`  Pagos a marcar anulados:           ${totals.voidPayment}`);
  console.log(`  A revisar a mano (no se tocan):    ${totals.review}`);
  console.log(
    APPLY
      ? `  Escrituras realizadas:             ${totals.written}`
      : "\n  No se escribió nada. Para aplicar: node scripts/backfill-pos-payments.cjs --apply"
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Error:", err);
    process.exit(1);
  });
