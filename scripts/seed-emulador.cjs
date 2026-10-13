/**
 * Siembra los emuladores con dos tenants de ensayo, sus roles y una persona que
 * entra a los dos.
 *
 * Sirve para recorrer la aplicación con `firestore.rules` PUESTAS antes de
 * desplegarlas. `npm run test:rules` comprueba las reglas contra escrituras
 * sintéticas; esto comprueba lo otro: que cada pantalla real siga funcionando.
 *
 * Solo habla con los emuladores — nunca con producción. Si las variables de
 * emulador no están puestas, aborta.
 *
 *   npm run seed:emulador     (con los emuladores ya levantados)
 *
 * Las cuentas (contraseña `ensayo123`):
 *
 *   admin@ensayo.mx       admin en el negocio 1
 *   contador@ensayo.mx    contador en el negocio 1
 *   viewer@ensayo.mx      visor en el negocio 1
 *   admin2@ensayo.mx      admin en el negocio 2 (solo ahí)
 *   directivo@ensayo.mx   ACCESO COMPARTIDO: admin en el negocio 1 y visor en el 2
 *                         (para ver el selector «Mis negocios» y el cambio de negocio)
 */

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const admin = require("firebase-admin");

// El projectId tiene que coincidir con el que use `next dev`, o el emulador
// guardaría los datos en otro proyecto y la aplicación no los vería.
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "chago-demo";
admin.initializeApp({ projectId });

const db = admin.firestore();
const auth = admin.auth();

const TENANT_1 = "tenant-ensayo";
const TENANT_2 = "tenant-ensayo-2";
const PASSWORD = "ensayo123";

const USUARIOS = [
  { email: "admin@ensayo.mx", displayName: "Ana Admin", role: "admin", tenant: TENANT_1 },
  { email: "contador@ensayo.mx", displayName: "Carlos Contador", role: "contador", tenant: TENANT_1 },
  { email: "viewer@ensayo.mx", displayName: "Vera Viewer", role: "viewer", tenant: TENANT_1 },
  { email: "admin2@ensayo.mx", displayName: "Beto Admin", role: "admin", tenant: TENANT_2 },
];

async function upsertUser({ email, displayName }) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return await auth.createUser({ email, password: PASSWORD, displayName });
  }
}

/** Catálogo mínimo para poder capturar y una transacción de cada tipo, para que Reportes y las listas no salgan vacías. */
async function sembrarDatos(tenantId, creadorUid, now) {
  const batch = db.batch();
  const catalogo = [
    ["gEntradas", "cVentas", "sMostrador", "entrada", "Ingresos", "Ventas", "Mostrador"],
    ["gSalidas", "cGastos", "sLuz", "salida", "Gastos", "Servicios", "Luz"],
  ];
  for (const [gId, cId, sId, tipo, gNombre, cNombre, sNombre] of catalogo) {
    batch.set(db.collection(`tenants/${tenantId}/generals`).doc(gId), {
      name: gNombre, type: tipo, isActive: true, createdAt: now,
    });
    batch.set(db.collection(`tenants/${tenantId}/concepts`).doc(cId), {
      name: cNombre, type: tipo, generalId: gId, isActive: true, createdAt: now,
    });
    batch.set(db.collection(`tenants/${tenantId}/subconcepts`).doc(sId), {
      name: sNombre, conceptId: cId, isActive: true, createdAt: now,
    });
  }
  batch.set(db.collection(`tenants/${tenantId}/proveedores`).doc("pDemo"), {
    name: "Proveedor de Ensayo", isActive: true, createdAt: now,
  });
  await batch.commit();

  for (const [tipo, gId, cId, sId, monto] of [
    ["entrada", "gEntradas", "cVentas", "sMostrador", 5000],
    ["salida", "gSalidas", "cGastos", "sLuz", 1200],
  ]) {
    await db.collection(`tenants/${tenantId}/transacciones`).add({
      type: tipo, generalId: gId, conceptId: cId, subconceptId: sId,
      description: `Movimiento de ensayo (${tipo})`,
      amount: monto, date: new Date(), providerId: "", division: "general",
      status: "pendiente", payments: [], totalPaid: 0, balance: monto,
      createdBy: creadorUid,
      createdAt: now, updatedAt: now,
    });
  }
}

(async () => {
  console.log(`Sembrando "${TENANT_1}" y "${TENANT_2}" en los emuladores...\n`);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const duenos = {};

  await db.collection("tenants").doc(TENANT_1).set({ nombreEmpresa: "Negocio de Ensayo", createdAt: now });
  await db.collection("tenants").doc(TENANT_2).set({ nombreEmpresa: "Segundo Negocio de Ensayo", createdAt: now });

  for (const u of USUARIOS) {
    const record = await upsertUser(u);
    console.log(`  ${u.role.padEnd(9)} ${u.email.padEnd(22)} ${u.tenant}  (uid ${record.uid})`);

    await db.collection(`tenants/${u.tenant}/members`).doc(record.uid).set({
      email: u.email, displayName: u.displayName, role: u.role, status: "active", createdAt: now,
    });
    await db.collection("users").doc(record.uid).set({
      uid: record.uid, tenantId: u.tenant, tenantIds: [u.tenant], email: u.email, displayName: u.displayName, createdAt: now,
    });
    if (u.role === "admin") {
      await db.collection("tenants").doc(u.tenant).update({ ownerUid: record.uid });
      duenos[u.tenant] = record.uid;
    }
  }

  // La persona de varios negocios: lo que haría la consola de superadmin al «Dar acceso».
  const directivo = await upsertUser({ email: "directivo@ensayo.mx", displayName: "Dora Directiva" });
  console.log(`  compart.  ${"directivo@ensayo.mx".padEnd(22)} ${TENANT_1} (admin) + ${TENANT_2} (viewer)  (uid ${directivo.uid})`);
  for (const [tenant, role] of [[TENANT_1, "admin"], [TENANT_2, "viewer"]]) {
    await db.collection(`tenants/${tenant}/members`).doc(directivo.uid).set({
      email: "directivo@ensayo.mx", displayName: "Dora Directiva", role, status: "active",
      joinedAt: now, vinculadoPor: "superadmin", vinculadoAt: now,
    });
  }
  await db.collection("users").doc(directivo.uid).set({
    uid: directivo.uid, tenantId: TENANT_1, tenantIds: [TENANT_1, TENANT_2], accesoCompartido: true,
    email: "directivo@ensayo.mx", displayName: "Dora Directiva", createdAt: now,
  });

  await sembrarDatos(TENANT_1, duenos[TENANT_1], now);
  await sembrarDatos(TENANT_2, duenos[TENANT_2], now);

  console.log(`\nListo. Contraseña de todos: ${PASSWORD}`);
  console.log(`Negocios: ${TENANT_1} · ${TENANT_2}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERROR sembrando:", e.message);
  process.exit(1);
});
