/**
 * Ensayo de los SERVICIOS REALES del navegador con `firestore.rules` PUESTAS.
 *
 *   npm run test:servicios
 *
 * `npm run test:rules` prueba las reglas con escrituras que imitan lo que mandan
 * los servicios. Esto prueba lo otro: que cada servicio —tal como está escrito
 * hoy— siga funcionando bajo esas reglas, entrando como admin, contador y viewer
 * por el emulador de Auth. Es lo que hay que ver en verde antes de cerrar las
 * reglas de producción, que hoy están abiertas.
 *
 * Solo habla con los emuladores. Aborta si no están.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { registrarCargador } from './cargador.mjs';

// ── Guardas ─────────────────────────────────────────────────────────────────
for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[v]) {
        console.error(`Falta ${v}: esto solo corre contra los emuladores. Usa: npm run test:servicios`);
        process.exit(1);
    }
}
for (const k of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_CONFIG']) delete process.env[k];

// El SDK de cliente se configura con variables NEXT_PUBLIC_*; cualquier valor sirve contra el emulador.
Object.assign(process.env, {
    NEXT_PUBLIC_FIREBASE_API_KEY: 'clave-de-emulador',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-chago.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-chago',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-chago.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '1',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:1:web:1',
});

const RAIZ = path.resolve(import.meta.dirname, '../..');
const cargar = registrarCargador(RAIZ, import.meta.url);

const { default: adminSdk } = await import('firebase-admin');
const { signInWithEmailAndPassword, signOut, connectAuthEmulator } = await import('firebase/auth');
const { connectFirestoreEmulator, getDocs, collection, getDoc, doc } = await import('firebase/firestore');

const { auth, db } = await cargar('lib/firebase/firebaseConfig.js');
// El repo solo conecta los emuladores desde el navegador (`window`); aquí se hace a mano, antes de cualquier uso.
const [hostFs, puertoFs] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
connectFirestoreEmulator(db, hostFs, Number(puertoFs));
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });

const { transactionService } = await cargar('lib/services/transactionService.js');
const { paymentService } = await cargar('lib/services/paymentService.js');
const { generalService } = await cargar('lib/services/generalService.js');
const { conceptService } = await cargar('lib/services/conceptService.js');
const { subconceptService } = await cargar('lib/services/subconceptService.js');
const { providerService } = await cargar('lib/services/providerService.js');
const { descriptionService } = await cargar('lib/services/descriptionService.js');
const { recurringExpenseService } = await cargar('lib/services/recurringExpenseService.js');
const { settingsService } = await cargar('lib/services/settingsService.js');
const tenantSvc = await cargar('lib/services/tenantService.js');
const roleSvc = await cargar('lib/services/roleServiceMultiTenant.js');
const { resolverNegocioActivo } = await cargar('lib/services/negociosService.js');
const { default: rutaMisNegocios } = await cargar('pages/api/me/tenants.js');
const { claveNegocioActivo } = await cargar('lib/negocioActivo.js');

// ── Siembra (Admin SDK contra el emulador: no pasa por las reglas) ───────────
const T = 'tenant-ensayo';
const T2 = 'tenant-ensayo-2'; // donde el directivo es solo visor
const T3 = 'tenant-ensayo-3'; // al que el directivo NO pertenece
const PASSWORD = 'ensayo-123';
const ROLES_DE_TENANT = ['admin', 'contador', 'viewer'];
const USUARIOS = {
    admin: { uid: 'u-admin', email: 'admin@ensayo.test' },
    contador: { uid: 'u-contador', email: 'contador@ensayo.test' },
    viewer: { uid: 'u-viewer', email: 'viewer@ensayo.test' },
    ajeno: { uid: 'u-ajeno', email: 'ajeno@ensayo.test' }, // existe en Auth pero no es miembro de ningún tenant
    // Una persona de varios negocios: admin en T, visor en T2, nada en T3.
    directivo: { uid: 'u-directivo', email: 'directivo@ensayo.test' },
};

adminSdk.initializeApp({ projectId: 'demo-chago' });
const adm = adminSdk.firestore();

before(async () => {
    await adm.collection('tenants').doc(T).set({ nombreEmpresa: 'Empresa de Ensayo', ownerUid: USUARIOS.admin.uid });
    for (const [rol, u] of Object.entries(USUARIOS)) {
        await adminSdk.auth().createUser({ uid: u.uid, email: u.email, password: PASSWORD });
        const esMiembro = ROLES_DE_TENANT.includes(rol);
        const tieneCasa = esMiembro || rol === 'directivo';
        await adm.collection('users').doc(u.uid).set({
            email: u.email,
            tenantId: tieneCasa ? T : null,
            ...(rol === 'directivo' && { accesoCompartido: true }),
        });
        if (esMiembro) {
            await adm.collection(`tenants/${T}/members`).doc(u.uid).set({ role: rol, status: 'active', email: u.email });
        }
    }

    // El directivo: admin en T y visor en T2 (accesos que dio Abanzoft). T3 es de otros.
    const d = USUARIOS.directivo;
    await adm.collection(`tenants/${T}/members`).doc(d.uid).set({ role: 'admin', status: 'active', email: d.email, vinculadoPor: 'superadmin' });
    for (const id of [T2, T3]) {
        await adm.collection('tenants').doc(id).set({ nombreEmpresa: `Empresa ${id}`, ownerUid: USUARIOS.admin.uid });
        // Con `date` y `createdAt`: `transactionService.getAll` ordena por esos campos y Firestore excluye lo que no los trae.
        await adm.collection(`tenants/${id}/transacciones`).add({ type: 'salida', amount: 10, date: new Date(), createdAt: new Date(), description: `Dato de ${id}`, createdBy: 'sistema' });
    }
    await adm.collection(`tenants/${T2}/members`).doc(d.uid).set({ role: 'viewer', status: 'active', email: d.email, vinculadoPor: 'superadmin' });
});

// Sin esto el SDK de cliente deja conexiones abiertas y el proceso no termina nunca.
after(async () => {
    const { terminate } = await import('firebase/firestore');
    const { deleteApp, getApp } = await import('firebase/app');
    await signOut(auth).catch(() => {});
    await terminate(db).catch(() => {});
    await deleteApp(getApp()).catch(() => {});
    await adminSdk.app().delete().catch(() => {});
});

/** Entra como ese rol y devuelve el objeto `user` que las pantallas le pasan a los servicios. */
async function entrar(rol) {
    await signOut(auth).catch(() => {});
    const { user } = await signInWithEmailAndPassword(auth, USUARIOS[rol].email, PASSWORD);
    return { uid: user.uid, email: user.email, displayName: rol, role: rol === 'viewer' ? 'viewer' : rol };
}

/**
 * `true` si la operación fue rechazada.
 *
 * No se busca "permission-denied" en el mensaje: los servicios envuelven el error
 * de Firestore en uno suyo en español. Por eso quien llama TAMBIÉN comprueba, con
 * `conteo()`, que la base quedó igual — que es lo que de verdad importa.
 */
async function denegado(promesa) {
    try { await promesa; return false; } catch { return true; }
}

/** Lo que hay de verdad en la base, leído con el Admin SDK (no pasa por las reglas). */
async function conteo(tenant = T) {
    const n = async (col) => (await adm.collection(`tenants/${tenant}/${col}`).get()).size;
    return { transacciones: await n('transacciones'), payments: await n('payments'), proveedores: await n('proveedores'), concepts: await n('concepts') };
}

const estado = {}; // ids que se van pasando entre pruebas

// ── INICIO DE SESIÓN ────────────────────────────────────────────────────────
// Lo primero que hace la aplicación al entrar cualquier usuario (AuthContextMultiTenant.loadUserRole).
// Si esto se negara, nadie podría usar el sistema: es la ruta más importante de todas.

for (const rol of ['admin', 'contador', 'viewer']) {
    test(`inicio de sesión de ${rol}: carga su tenant, su rol y los permisos`, async () => {
        const { uid } = await entrar(rol);

        const tenantId = await tenantSvc.getUserTenantId(uid);
        assert.equal(tenantId, T, 'users/{uid}.tenantId');

        assert.equal(await tenantSvc.getUserTenantRole(tenantId, uid), rol, 'members/{uid}.role');

        const info = await tenantSvc.getTenantInfo(tenantId);
        assert.equal(info.success, true, 'el documento del tenant');
        assert.equal(info.tenant.nombreEmpresa, 'Empresa de Ensayo');

        await roleSvc.loadRolePermissionsFromFirestore(); // lee la colección raíz `roles`
    });
}

// ── ADMIN ───────────────────────────────────────────────────────────────────

test('admin: crea el catálogo completo (general, concepto, subconcepto, proveedor, descripción)', async () => {
    estado.admin = await entrar('admin');
    const g = await generalService.create({ name: 'Operación', type: 'salida' }, T);
    const c = await conceptService.create({ name: 'Renta', type: 'salida', generalId: g.id }, T);
    const s = await subconceptService.create({ name: 'Local', conceptId: c.id }, T);
    const p = await providerService.create({ name: 'Inmobiliaria SA' }, T);
    const d = await descriptionService.create({ name: 'Renta mensual', conceptId: c.id }, T);
    Object.assign(estado, { generalId: g.id, conceptId: c.id, subconceptId: s.id, providerId: p.id, descriptionId: d.id });
    for (const id of [g.id, c.id, s.id, p.id, d.id]) assert.ok(id);
});

test('admin: crea, edita y consulta una transacción', async () => {
    const tx = await transactionService.create({
        type: 'salida', amount: 1000, date: new Date(), description: 'Renta de octubre',
        generalId: estado.generalId, conceptId: estado.conceptId, subconceptId: estado.subconceptId,
        providerId: estado.providerId, division: 'general',
    }, estado.admin, T);
    estado.txId = tx.id;
    assert.ok(tx.id);

    await transactionService.update(tx.id, { description: 'Renta de octubre (corregida)' }, estado.admin, T);
    const leida = await transactionService.getById(tx.id, T);
    assert.equal(leida.description, 'Renta de octubre (corregida)');
});

test('admin: un pago baja el saldo de la transacción (y no falla en silencio)', async () => {
    /*
      `paymentService.create` captura el error si no puede actualizar la
      transacción y solo lo registra: una regla que lo negara dejaría el pago
      creado y la deuda intacta, sin que nadie lo viera. Por eso se verifica el
      resultado, no que la llamada no lance.
    */
    const pago = await paymentService.create({
        transactionId: estado.txId, amount: 400, paymentDate: new Date(), paymentMethod: 'Efectivo',
    }, [], T);
    estado.pagoId = pago.id;
    assert.ok(pago.id);

    const tx = await transactionService.getById(estado.txId, T);
    assert.equal(tx.totalPaid, 400, 'el saldo debe reflejar el pago');
    assert.equal(tx.status, 'parcial');
    assert.equal(tx.balance, 600);
});

test('admin: edita un pago y el saldo se recalcula', async () => {
    await paymentService.update(estado.pagoId, { amount: 1000 }, [], T);
    const tx = await transactionService.getById(estado.txId, T);
    assert.equal(tx.totalPaid, 1000);
    assert.equal(tx.status, 'pagado');
});

test('admin: crea, edita y borra un gasto recurrente', async () => {
    const r = await recurringExpenseService.create({
        description: 'Luz', amount: 300, frequency: 'monthly', startDate: new Date(), dayOfMonth: 5,
        generalId: estado.generalId, conceptId: estado.conceptId, subconceptId: estado.subconceptId,
    }, T);
    assert.ok(r.id);
    await recurringExpenseService.update(r.id, { amount: 350 }, T);
    await recurringExpenseService.delete(r.id, T);
});

test('admin: guarda y lee los correos de notificación', async () => {
    await settingsService.saveEmails({ adminEmails: ['admin@ensayo.test'], accountantEmails: [] }, T);
    const { adminEmails } = await settingsService.getEmails(T);
    assert.deepEqual(adminEmails, ['admin@ensayo.test']);
});

test('admin: lee la bitácora y borra una transacción', async () => {
    const logs = await getDocs(collection(db, `tenants/${T}/logs`));
    assert.ok(logs.size > 0, 'los servicios dejaron constancia en la bitácora');

    const otra = await transactionService.create({
        type: 'salida', amount: 50, date: new Date(), description: 'Borrable',
        generalId: estado.generalId, conceptId: estado.conceptId, subconceptId: estado.subconceptId, division: 'general',
    }, estado.admin, T);
    await transactionService.delete(otra.id, estado.admin, 'prueba', T);
    assert.equal((await getDoc(doc(db, `tenants/${T}/transacciones/${otra.id}`))).exists(), false);
});

// ── CONTADOR ────────────────────────────────────────────────────────────────

test('contador: captura una transacción, la edita y le registra un pago', async () => {
    estado.contador = await entrar('contador');
    const tx = await transactionService.create({
        type: 'salida', amount: 200, date: new Date(), description: 'Papelería',
        generalId: estado.generalId, conceptId: estado.conceptId, subconceptId: estado.subconceptId, division: 'general',
    }, estado.contador, T);
    estado.txContador = tx.id;
    await transactionService.update(tx.id, { description: 'Papelería oficina' }, estado.contador, T);

    await paymentService.create({ transactionId: tx.id, amount: 200, paymentDate: new Date(), paymentMethod: 'Transferencia' }, [], T);
    const leida = await transactionService.getById(tx.id, T);
    assert.equal(leida.totalPaid, 200, 'el contador también baja el saldo con su pago');
    assert.equal(leida.status, 'pagado');
});

test('contador: puede crear y editar catálogos y recurrentes', async () => {
    const p = await providerService.create({ name: 'Papelería del Centro' }, T);
    await providerService.update(p.id, { name: 'Papelería Central' }, T);
    const c = await conceptService.create({ name: 'Papelería', type: 'salida', generalId: estado.generalId }, T);
    await conceptService.update(c.id, { name: 'Papelería y útiles' }, T);
    assert.ok(p.id && c.id);
});

test('contador: NO borra transacciones, NO guarda correos y NO lee la bitácora', async () => {
    const antes = await conteo();
    assert.equal(await denegado(deleteDirecto(`tenants/${T}/transacciones/${estado.txContador}`)), true, 'borrar transacción');
    assert.equal(await denegado(settingsService.saveEmails({ adminEmails: ['x@x.mx'], accountantEmails: [] }, T)), true, 'guardar correos');
    assert.equal(await denegado(getDocs(collection(db, `tenants/${T}/logs`))), true, 'leer bitácora');

    assert.deepEqual(await conteo(), antes, 'no se borró nada');
    const correos = (await adm.doc(`tenants/${T}/settings/emails`).get()).data();
    assert.ok(!JSON.stringify(correos).includes('x@x.mx'), 'los correos del admin no se tocaron');
});

// ── VIEWER ──────────────────────────────────────────────────────────────────

test('viewer: lee transacciones, catálogos y correos', async () => {
    estado.viewer = await entrar('viewer');
    const lista = await transactionService.getAll({}, T);
    assert.ok(lista.length >= 2, `debería ver las transacciones del tenant (vio ${lista.length})`);
    assert.ok((await generalService.getAll(T)).length >= 1);
    assert.ok((await providerService.getAll(T)).length >= 1);
    await settingsService.getEmails(T);
});

test('viewer: NO puede capturar, editar ni pagar nada', async () => {
    const base = { type: 'salida', amount: 10, date: new Date(), description: 'No debe entrar', generalId: estado.generalId, conceptId: estado.conceptId, subconceptId: estado.subconceptId, division: 'general' };
    const antes = await conteo();
    const descripcionAntes = (await adm.doc(`tenants/${T}/transacciones/${estado.txId}`).get()).data().description;

    assert.equal(await denegado(transactionService.create(base, estado.viewer, T)), true, 'crear transacción');
    assert.equal(await denegado(transactionService.update(estado.txId, { description: 'x' }, estado.viewer, T)), true, 'editar transacción');
    assert.equal(await denegado(paymentService.create({ transactionId: estado.txId, amount: 1, paymentDate: new Date(), paymentMethod: 'Efectivo' }, [], T)), true, 'crear pago');
    assert.equal(await denegado(providerService.create({ name: 'No' }, T)), true, 'crear proveedor');
    assert.equal(await denegado(conceptService.create({ name: 'No', type: 'salida', generalId: estado.generalId }, T)), true, 'crear concepto');

    assert.deepEqual(await conteo(), antes, 'el viewer no escribió nada');
    assert.equal((await adm.doc(`tenants/${T}/transacciones/${estado.txId}`).get()).data().description, descripcionAntes, 'ni editó la transacción');
});

// ── UNA PERSONA, VARIOS NEGOCIOS ────────────────────────────────────────────
// Lo que hace posible el salto de un negocio a otro tras iniciar sesión: la
// membresía es POR NEGOCIO, así que el rol y el permiso cambian con el negocio y
// nada se filtra al que no es suyo. Las reglas no necesitan saber nada de esto.

test('varios negocios: entra por su negocio de casa y su rol es el de CADA negocio', async () => {
    const { uid } = await entrar('directivo');

    assert.equal(await tenantSvc.getUserTenantId(uid), T, 'su negocio de casa');
    assert.equal(await tenantSvc.getUserTenantRole(T, uid), 'admin');
    assert.equal(await tenantSvc.getUserTenantRole(T2, uid), 'viewer');
    assert.equal((await tenantSvc.getTenantInfo(T2)).success, true, 'puede cargar los datos del segundo negocio');

    // Y del tercero no es: no hay rol que leer.
    assert.equal(await denegado(tenantSvc.getUserTenantRole(T3, uid)), true);
});

test('varios negocios: administra el suyo, solo consulta el otro y no ve el tercero', async () => {
    estado.directivo = await entrar('directivo');
    const base = { type: 'salida', amount: 25, date: new Date(), description: 'Desde el directivo', generalId: estado.generalId, conceptId: estado.conceptId, subconceptId: estado.subconceptId, division: 'general' };

    // En T es administrador: escribe.
    const propia = await transactionService.create(base, estado.directivo, T);
    assert.ok(propia.id);

    // En T2 es visor: lee lo del negocio, pero no escribe.
    assert.ok((await transactionService.getAll({}, T2)).length >= 1, 've las transacciones de T2');
    const antes = await conteo(T2);
    assert.equal(await denegado(transactionService.create({ ...base, description: 'No debe entrar' }, estado.directivo, T2)), true);
    assert.deepEqual(await conteo(T2), antes, 'no escribió nada en T2');

    // En T3 no es nada: ni lee.
    assert.equal(await denegado(getDocs(collection(db, `tenants/${T3}/transacciones`))), true, 'leer T3');
    assert.equal(await denegado(getDoc(doc(db, `tenants/${T3}`))), true, 'el documento de T3');
});

/**
 * Corre `resolverNegocioActivo` —la función REAL del navegador— con `/api/me/tenants`
 * atendido por el handler REAL (mismos emuladores, mismas reglas). Solo se sustituyen
 * `fetch` para las rutas `/api/*` y `window.localStorage`, que en Node no existen.
 */
async function resolverComoNavegador(rol, { guardado = null, fallaElServidor = false } = {}) {
    const usuario = await entrar(rol);
    const almacen = new Map(guardado ? [[claveNegocioActivo(usuario.uid), guardado]] : []);
    const fetchReal = globalThis.fetch;
    const llamadas = [];

    globalThis.fetch = async (url, opciones = {}) => {
        if (typeof url !== 'string' || !url.startsWith('/api/')) return fetchReal(url, opciones);
        llamadas.push(url);
        if (fallaElServidor) return { ok: false, status: 500, json: async () => ({}) };
        let status = 200;
        let cuerpo;
        const res = { setHeader() {}, status(c) { status = c; return res; }, json(p) { cuerpo = p; return res; } };
        const cabeceras = Object.fromEntries(Object.entries(opciones.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
        await rutaMisNegocios({ method: 'GET', headers: cabeceras, query: {} }, res);
        return { ok: status < 400, status, json: async () => cuerpo };
    };
    globalThis.window = { localStorage: { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v) } };

    try {
        const propio = await tenantSvc.getUserTenantId(usuario.uid);
        const resultado = await resolverNegocioActivo(auth.currentUser, propio);
        return { ...resultado, propio, llamadas };
    } finally {
        globalThis.fetch = fetchReal;
        delete globalThis.window;
    }
}

test('varios negocios: sin nada recordado entra al de casa y recibe la lista de los suyos', async () => {
    const r = await resolverComoNavegador('directivo');
    assert.equal(r.tenantId, T);
    assert.deepEqual(r.negocios.map((n) => [n.id, n.role]).sort(), [[T, 'admin'], [T2, 'viewer']]);
    assert.ok(!r.negocios.some((n) => n.id === T3), 'el tercero no aparece');
    assert.equal(r.negocios.find((n) => n.id === T2).nombre, `Empresa ${T2}`);
});

test('varios negocios: entra al último negocio que usó', async () => {
    const r = await resolverComoNavegador('directivo', { guardado: T2 });
    assert.equal(r.tenantId, T2);
});

test('varios negocios: un negocio recordado que NO es suyo se ignora (localStorage no concede nada)', async () => {
    const r = await resolverComoNavegador('directivo', { guardado: T3 });
    assert.equal(r.tenantId, T, 'vuelve al de casa');
    assert.ok(!r.negocios.some((n) => n.id === T3));
});

test('varios negocios: si el servidor falla entra al de casa en vez de quedarse fuera', async () => {
    const r = await resolverComoNavegador('directivo', { guardado: T2, fallaElServidor: true });
    assert.equal(r.tenantId, T);
    assert.equal(r.negocios, null);
});

test('una cuenta de un solo negocio NO cambia en nada: ni lista ni llamada extra al servidor', async () => {
    for (const rol of ['admin', 'contador', 'viewer']) {
        const r = await resolverComoNavegador(rol, { guardado: T2 });
        assert.equal(r.tenantId, T, `${rol} entra a su negocio, sin importar lo que haya en localStorage`);
        assert.equal(r.negocios, null, `${rol} no tiene selector`);
        assert.deepEqual(r.llamadas, [], `${rol} no hizo ninguna llamada a /api/me/tenants`);
    }
});

test('varios negocios: no puede cambiarse a sí mismo el negocio de casa ni darse acceso a otro', async () => {
    const { setDoc, updateDoc } = await import('firebase/firestore');
    estado.directivo = await entrar('directivo');

    // El negocio de casa lo escribe el servidor; las reglas se lo impiden al propio usuario.
    assert.equal(await denegado(updateDoc(doc(db, `users/${estado.directivo.uid}`), { tenantId: T3 })), true, 'cambiar users.tenantId');
    // Y darse una membresía a mano en un negocio que no es suyo tampoco.
    assert.equal(await denegado(setDoc(doc(db, `tenants/${T3}/members/${estado.directivo.uid}`), { role: 'admin', status: 'active' })), true, 'crearse una membresía');
    assert.equal((await adm.doc(`tenants/${T3}/members/${estado.directivo.uid}`).get()).exists, false);
});

// ── Ajeno al tenant ─────────────────────────────────────────────────────────

test('un usuario sin membresía no lee nada del tenant', async () => {
    await entrar('ajeno');
    assert.equal(await denegado(getDocs(collection(db, `tenants/${T}/transacciones`))), true, 'transacciones');
    assert.equal(await denegado(getDocs(collection(db, `tenants/${T}/payments`))), true, 'pagos');
    assert.equal(await denegado(getDoc(doc(db, `tenants/${T}`))), true, 'el documento del tenant');
});

test('sin sesión no se lee ni se escribe nada', async () => {
    await signOut(auth);
    assert.equal(await denegado(getDocs(collection(db, `tenants/${T}/transacciones`))), true);
    assert.equal(await denegado(getDocs(collection(db, 'users'))), true, 'ni siquiera la lista de usuarios');
});

// Borrado directo con el SDK (los servicios pueden bloquear antes por rol; aquí se prueba la REGLA).
async function deleteDirecto(ruta) {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, ruta));
}
