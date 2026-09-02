/**
 * Suite de reglas de Firestore contra el emulador.
 * Grupo 1: garantías de la integración POS (el motivo del punto 2).
 * Grupo 2: operación normal — que desplegar no rompa a los usuarios.
 * Grupo 3: lo que SÍ se rompe al desplegar (documentado como tal).
 */
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

const RULES = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const T = "tenant1";
const ADMIN = "uidAdmin", CONTA = "uidConta", VIEWER = "uidViewer", OUTSIDER = "uidOutsider";

let pass = 0, fail = 0;
const results = [];
async function t(group, name, fn) {
  try { await fn(); pass++; results.push([group, name, true, ""]); }
  catch (e) { fail++; results.push([group, name, false, e.message.split("\n")[0].slice(0, 100)]); }
}

const testEnv = await initializeTestEnvironment({
  projectId: "demo-chago",
  firestore: { rules: RULES, host: "127.0.0.1", port: 8080 },
});

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users", ADMIN), { tenantId: T });
  await setDoc(doc(db, "users", CONTA), { tenantId: T });
  await setDoc(doc(db, "users", VIEWER), { tenantId: T });
  await setDoc(doc(db, "users", OUTSIDER), { tenantId: "otroTenant" });
  await setDoc(doc(db, "tenants", T), { ownerUid: ADMIN, name: "Negocio" });
  await setDoc(doc(db, `tenants/${T}/members`, ADMIN), { status: "active", role: "admin" });
  await setDoc(doc(db, `tenants/${T}/members`, CONTA), { status: "active", role: "contador" });
  await setDoc(doc(db, `tenants/${T}/members`, VIEWER), { status: "active", role: "viewer" });

  const locked = { locked: true, origen: "pos_sync" };
  // Cada tipo tiene su propio General: los árboles no se mezclan.

  await setDoc(doc(db, `tenants/${T}/generals`, "gLock"), { name: "Punto de venta · N · Ventas", type: "entrada", ...locked });
  await setDoc(doc(db, `tenants/${T}/generals`, "pos_general_compras"), { name: "Punto de venta · N · Compras", type: "salida", ...locked });
  await setDoc(doc(db, `tenants/${T}/concepts`, "cLock"), { name: "Ventas POS", generalId: "gLock", type: "entrada", ...locked });
  await setDoc(doc(db, `tenants/${T}/subconcepts`, "sLock"), { name: "Efectivo", conceptId: "cLock", ...locked });
  await setDoc(doc(db, `tenants/${T}/transacciones`, "txLock"), { amount: 100, conceptId: "cLock", ...locked });
  // Rama de compras.
  await setDoc(doc(db, `tenants/${T}/concepts`, "cCompras"), { name: "Compras POS", generalId: "pos_general_compras", type: "salida", ...locked });
  await setDoc(doc(db, `tenants/${T}/subconcepts`, "pos_prod_665f"), { name: "Coca 600", conceptId: "cCompras", posProductId: "665f", posProductName: "Coca 600", ...locked });
  await setDoc(doc(db, `tenants/${T}/transacciones`, "txCompra"), { type: "salida", amount: 250, conceptId: "cCompras", posKind: "compra", status: "pagado", ...locked });
  await setDoc(doc(db, `tenants/${T}/concepts`, "cFree"), { name: "Gastos", generalId: "gLock" });
  await setDoc(doc(db, `tenants/${T}/transacciones`, "txFree"), { amount: 50, conceptId: "cFree" });
  // Catálogo "de siempre": documentos que nunca tuvieron el campo `locked`.
  await setDoc(doc(db, `tenants/${T}/transacciones`, "txEdit"), { amount: 5, conceptId: "cFree" });
  await setDoc(doc(db, `tenants/${T}/concepts`, "cSinCampo"), { name: "Viejo", generalId: "gLock" });
  await setDoc(doc(db, `tenants/${T}/concepts`, "cMover"), { name: "Mover", generalId: "otro" });
  await setDoc(doc(db, `tenants/${T}/generals`, "gSinCampo"), { name: "General viejo", type: "salida" });
  await setDoc(doc(db, `tenants/${T}/subconcepts`, "sSinCampo"), { name: "Sub viejo", conceptId: "cFree" });
});

const asAdmin = testEnv.authenticatedContext(ADMIN).firestore();
const asConta = testEnv.authenticatedContext(CONTA).firestore();
const asViewer = testEnv.authenticatedContext(VIEWER).firestore();
const asOutsider = testEnv.authenticatedContext(OUTSIDER).firestore();
const anon = testEnv.unauthenticatedContext().firestore();

// ── Grupo 1: garantías de la integración POS ────────────────────────────
const G1 = "POS";
await t(G1, "admin NO puede borrar el concepto bloqueado", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/concepts`, "cLock"))));
await t(G1, "admin NO puede recolgar el concepto (cambiar generalId)", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/concepts`, "cLock"), { generalId: "otro" })));
await t(G1, "admin SÍ puede renombrar el concepto bloqueado", () => assertSucceeds(updateDoc(doc(asAdmin, `tenants/${T}/concepts`, "cLock"), { name: "Ventas del POS" })));
await t(G1, "admin NO puede borrar el General bloqueado", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/generals`, "gLock"))));
await t(G1, "admin SÍ puede renombrar el General bloqueado", () => assertSucceeds(updateDoc(doc(asAdmin, `tenants/${T}/generals`, "gLock"), { name: "POS" })));
await t(G1, "admin NO puede mover el subconcepto (cambiar conceptId)", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/subconcepts`, "sLock"), { conceptId: "cFree" })));
await t(G1, "admin NO puede borrar la transacción del POS", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/transacciones`, "txLock"))));
await t(G1, "admin NO puede editar el monto de la transacción del POS", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/transacciones`, "txLock"), { amount: 1, updatedBy: ADMIN, updatedAt: serverTimestamp() })));

// ── Rama de compras ─────────────────────────────────────────────────────
// El `type` de cada General sostiene su rama: si se pudiera cambiar desde el
// cliente, los árboles volverían a mezclarse.
await t(G1, "admin NO puede cambiar el tipo del General de ventas", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/generals`, "gLock"), { type: "salida" })));
await t(G1, "admin NO puede cambiar el tipo del General de compras", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/generals`, "pos_general_compras"), { type: "entrada" })));
await t(G1, "admin NO puede borrar el General de compras", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/generals`, "pos_general_compras"))));
await t(G1, "admin SÍ puede renombrar el General de compras", () => assertSucceeds(updateDoc(doc(asAdmin, `tenants/${T}/generals`, "pos_general_compras"), { name: "Compras del POS" })));
await t(G1, "admin NO puede borrar el concepto de compras", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/concepts`, "cCompras"))));
await t(G1, "admin NO puede recolgar el concepto de compras", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/concepts`, "cCompras"), { generalId: "otro" })));
await t(G1, "admin NO puede cambiar el tipo del concepto de compras", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/concepts`, "cCompras"), { type: "entrada" })));
await t(G1, "admin SÍ puede renombrar el concepto de compras", () => assertSucceeds(updateDoc(doc(asAdmin, `tenants/${T}/concepts`, "cCompras"), { name: "Compras del POS" })));
// `posProductId` es la identidad que evita duplicar subconceptos por producto.
await t(G1, "admin NO puede cambiar el posProductId del subconcepto", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/subconcepts`, "pos_prod_665f"), { posProductId: "otro" })));
await t(G1, "admin NO puede mover el subconcepto del producto", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/subconcepts`, "pos_prod_665f"), { conceptId: "cLock" })));
await t(G1, "admin NO puede borrar el subconcepto del producto", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/subconcepts`, "pos_prod_665f"))));
await t(G1, "admin SÍ puede renombrar el subconcepto del producto", () => assertSucceeds(updateDoc(doc(asAdmin, `tenants/${T}/subconcepts`, "pos_prod_665f"), { name: "Coca 600 ml" })));
await t(G1, "admin NO puede borrar la compra", () => assertFails(deleteDoc(doc(asAdmin, `tenants/${T}/transacciones`, "txCompra"))));
await t(G1, "admin NO puede editar el monto de la compra", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/transacciones`, "txCompra"), { amount: 1, updatedBy: ADMIN, updatedAt: serverTimestamp() })));
// Pasarla a 'pendiente' la resucitaría como saldo de arrastre mes a mes.
await t(G1, "admin NO puede pasar la compra a 'pendiente'", () => assertFails(updateDoc(doc(asAdmin, `tenants/${T}/transacciones`, "txCompra"), { status: "pendiente", updatedBy: ADMIN, updatedAt: serverTimestamp() })));
// Bloquear la rama no debe bloquear la colección entera.
await t(G1, "contador SÍ puede crear un subconcepto suyo bajo el concepto de compras", () => assertSucceeds(addDoc(collection(asConta, `tenants/${T}/subconcepts`), { name: "Fletes", conceptId: "cCompras" })));

// ── Grupo 2: operación normal ───────────────────────────────────────────
const G2 = "Normal";
await t(G2, "viewer lee transacciones", () => assertSucceeds(getDocs(collection(asViewer, `tenants/${T}/transacciones`))));
await t(G2, "viewer NO crea transacciones", () => assertFails(addDoc(collection(asViewer, `tenants/${T}/transacciones`), { amount: 1, createdBy: VIEWER, createdAt: serverTimestamp() })));
await t(G2, "contador crea transacción (con createdBy/createdAt)", () => assertSucceeds(addDoc(collection(asConta, `tenants/${T}/transacciones`), { amount: 10, createdBy: CONTA, createdAt: serverTimestamp() })));
await t(G2, "contador NO crea transacción sin createdAt del servidor", () => assertFails(addDoc(collection(asConta, `tenants/${T}/transacciones`), { amount: 10, createdBy: CONTA, createdAt: new Date() })));
// Los dos campos que el servicio tiene que poner desde la sesion de Firebase:
// `updatePaymentStatus` llega hasta aqui sin usuario, asi que sacarlos de un
// parametro dejaria esas escrituras denegadas.
await t(G2, "contador NO crea transacción sin createdBy", () => assertFails(addDoc(collection(asConta, `tenants/${T}/transacciones`), { amount: 10, createdAt: serverTimestamp() })));
await t(G2, "contador NO edita transacción sin updatedBy", () => assertFails(updateDoc(doc(asConta, `tenants/${T}/transacciones`, "txEdit"), { amount: 77, updatedAt: serverTimestamp() })));
await t(G2, "admin borra transacción libre", () => assertSucceeds(deleteDoc(doc(asAdmin, `tenants/${T}/transacciones`, "txFree"))));
await t(G2, "contador edita concepto libre", () => assertSucceeds(updateDoc(doc(asConta, `tenants/${T}/concepts`, "cFree"), { name: "Gastos varios" })));
await t(G2, "contador crea concepto", () => assertSucceeds(addDoc(collection(asConta, `tenants/${T}/concepts`), { name: "Nuevo", generalId: "gLock" })));
await t(G2, "viewer NO borra conceptos", () => assertFails(deleteDoc(doc(asViewer, `tenants/${T}/concepts`, "cFree"))));
// Documentos SIN el campo `locked` — o sea, todo lo que existía antes de la
// integración. Si `resource.data.locked` se lee a pelo, la regla revienta.
await t(G2, "contador edita transacción sin campo `locked`", () => assertSucceeds(updateDoc(doc(asConta, `tenants/${T}/transacciones`, "txEdit"), { amount: 99, updatedBy: CONTA, updatedAt: serverTimestamp() })));
await t(G2, "admin borra concepto sin campo `locked`", () => assertSucceeds(deleteDoc(doc(asAdmin, `tenants/${T}/concepts`, "cSinCampo"))));
await t(G2, "admin borra general sin campo `locked`", () => assertSucceeds(deleteDoc(doc(asAdmin, `tenants/${T}/generals`, "gSinCampo"))));
await t(G2, "admin borra subconcepto sin campo `locked`", () => assertSucceeds(deleteDoc(doc(asAdmin, `tenants/${T}/subconcepts`, "sSinCampo"))));
await t(G2, "contador recuelga un concepto suyo sin campo `locked`", () => assertSucceeds(updateDoc(doc(asConta, `tenants/${T}/concepts`, "cMover"), { generalId: "gLock" })));
await t(G2, "ajeno al tenant NO lee sus transacciones", () => assertFails(getDocs(collection(asOutsider, `tenants/${T}/transacciones`))));
await t(G2, "anónimo NO lee nada del tenant", () => assertFails(getDocs(collection(anon, `tenants/${T}/transacciones`))));
await t(G2, "anónimo NO lee el documento del tenant", () => assertFails(getDoc(doc(anon, "tenants", T))));
await t(G2, "miembro lee su propio tenant", () => assertSucceeds(getDoc(doc(asViewer, "tenants", T))));
await t(G2, "usuario lee su propio doc de users", () => assertSucceeds(getDoc(doc(asAdmin, "users", ADMIN))));

// ── Grupo 3: lo que se rompe al desplegar ───────────────────────────────
const G3 = "ROMPE";
await t(G3, "superadmin (sin Firebase Auth) NO puede listar /tenants", () => assertFails(getDocs(collection(anon, "tenants"))));
await t(G3, "ni siquiera un admin autenticado puede listar /tenants", () => assertFails(getDocs(collection(asAdmin, "tenants"))));
await t(G3, "admin NO puede listar /users", () => assertFails(getDocs(collection(asAdmin, "users"))));
await t(G3, "admin NO puede escribir el doc de otro usuario", () => assertFails(setDoc(doc(asAdmin, "users", CONTA), { role: "viewer" }, { merge: true })));
await t(G3, "nadie puede borrar un doc de /users", () => assertFails(deleteDoc(doc(asAdmin, "users", CONTA))));

await testEnv.cleanup();

let group = "";
for (const [g, name, ok, err] of results) {
  if (g !== group) { console.log(`\n── ${g} ──`); group = g; }
  console.log(`  ${ok ? "ok  " : "FALLA"} ${name}${ok ? "" : `  → ${err}`}`);
}
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail === 0 ? 0 : 1);
