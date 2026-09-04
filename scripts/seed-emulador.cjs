/**
 * Siembra los emuladores con un tenant de ensayo y sus tres roles.
 *
 * Sirve para recorrer la aplicación con `firestore.rules` PUESTAS antes de
 * desplegarlas. `npm run test:rules` comprueba las reglas contra escrituras
 * sintéticas; esto comprueba lo otro: que cada pantalla real siga funcionando.
 *
 * Solo habla con los emuladores — nunca con producción. Si las variables de
 * emulador no están puestas, aborta.
 *
 *   npm run seed:emulador     (con los emuladores ya levantados)
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

const TENANT_ID = "tenant-ensayo";
const PASSWORD = "ensayo123";
const USUARIOS = [
  { email: "admin@ensayo.mx", displayName: "Ana Admin", role: "admin" },
  { email: "contador@ensayo.mx", displayName: "Carlos Contador", role: "contador" },
  { email: "viewer@ensayo.mx", displayName: "Vera Viewer", role: "viewer" },
];

async function upsertUser({ email, displayName }) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return await auth.createUser({ email, password: PASSWORD, displayName });
  }
}

(async () => {
  console.log(`Sembrando el tenant "${TENANT_ID}" en los emuladores...\n`);

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  batch.set(db.collection("tenants").doc(TENANT_ID), {
    nombreEmpresa: "Negocio de Ensayo",
    createdAt: now,
  });

  for (const u of USUARIOS) {
    const record = await upsertUser(u);
    console.log(`  ${u.role.padEnd(9)} ${u.email}  (uid ${record.uid})`);

    batch.set(db.collection(`tenants/${TENANT_ID}/members`).doc(record.uid), {
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: "active",
      createdAt: now,
    });

    batch.set(db.collection("users").doc(record.uid), {
      uid: record.uid,
      tenantId: TENANT_ID,
      email: u.email,
      displayName: u.displayName,
      createdAt: now,
    });

    if (u.role === "admin") {
      batch.update(db.collection("tenants").doc(TENANT_ID), { ownerUid: record.uid });
    }
  }

  // Catálogo mínimo para poder capturar: un árbol de entradas y otro de salidas.
  const catalogo = [
    ["gEntradas", "concepts", "cVentas", "subconcepts", "sMostrador", "entrada", "Ingresos", "Ventas", "Mostrador"],
    ["gSalidas", "concepts", "cGastos", "subconcepts", "sLuz", "salida", "Gastos", "Servicios", "Luz"],
  ];
  for (const [gId, , cId, , sId, tipo, gNombre, cNombre, sNombre] of catalogo) {
    batch.set(db.collection(`tenants/${TENANT_ID}/generals`).doc(gId), {
      name: gNombre, type: tipo, isActive: true, createdAt: now,
    });
    batch.set(db.collection(`tenants/${TENANT_ID}/concepts`).doc(cId), {
      name: cNombre, type: tipo, generalId: gId, isActive: true, createdAt: now,
    });
    batch.set(db.collection(`tenants/${TENANT_ID}/subconcepts`).doc(sId), {
      name: sNombre, conceptId: cId, isActive: true, createdAt: now,
    });
  }

  batch.set(db.collection(`tenants/${TENANT_ID}/proveedores`).doc("pDemo"), {
    name: "Proveedor de Ensayo", isActive: true, createdAt: now,
  });

  await batch.commit();

  // Una transacción de cada tipo, para que Reportes y las listas no salgan vacías.
  const adminRecord = await auth.getUserByEmail("admin@ensayo.mx");
  for (const [tipo, gId, cId, sId, monto] of [
    ["entrada", "gEntradas", "cVentas", "sMostrador", 5000],
    ["salida", "gSalidas", "cGastos", "sLuz", 1200],
  ]) {
    await db.collection(`tenants/${TENANT_ID}/transacciones`).add({
      type: tipo, generalId: gId, conceptId: cId, subconceptId: sId,
      description: `Movimiento de ensayo (${tipo})`,
      amount: monto, date: new Date(), providerId: "", division: "general",
      status: "pendiente", payments: [], totalPaid: 0, balance: monto,
      createdBy: adminRecord.uid,
      createdAt: now, updatedAt: now,
    });
  }

  console.log(`\nListo. Contraseña de todos: ${PASSWORD}`);
  console.log(`Tenant: ${TENANT_ID}`);
  process.exit(0);
})().catch((e) => {
  console.error("ERROR sembrando:", e.message);
  process.exit(1);
});
