/**
 * Integración POS ↔ chago-demo: qué pasa cuando el catálogo de un tenant vinculado desaparece.
 *
 *   npm run test:integracion
 *
 * Ejecuta los HANDLERS REALES de las rutas de API —no copias— contra el emulador
 * de Firestore, sin levantar Next. El caso real que motiva esto: un tenant se
 * limpió 4 minutos después de activar el vínculo; `posIntegration` conservó los
 * ids del catálogo, las ventas siguieron aceptándose con 201 y quedaron colgando
 * de un General que no existía.
 *
 * Los .js de `src/` son ESM sin extensión en los imports (lo que Next resuelve
 * solo). Un par de hooks de Node hacen lo mismo aquí.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// ── Guardas: esto SOLO corre contra el emulador ─────────────────────────────
// El .env.local de este repo trae credenciales de producción. Nada de aquí las
// lee (no hay Next), pero se cierra la puerta de todos modos.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('Esta prueba solo corre contra el emulador. Usa: npm run test:integracion');
    process.exit(1);
}
for (const k of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_CONFIG']) delete process.env[k];

const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env.FIREBASE_PROJECT_ID = 'demo-chago';
process.env.FIREBASE_CLIENT_EMAIL = 'prueba@demo-chago.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = privateKey;
process.env.TENANT_SETUP_PASSWORD = 'clave-de-prueba';
// El respaldo busca un bucket de Storage antes de caer a Firestore. Sin emulador
// de Storage, esto lo manda a un puerto cerrado de esta máquina en vez de a Google.
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:1';

const RAIZ = path.resolve(import.meta.dirname, '../..');
const SRC = pathToFileURL(path.join(RAIZ, 'src')).href;

register(
    'data:text/javascript,' + encodeURIComponent(`
        const SRC = ${JSON.stringify(SRC)};
        export async function resolve(specifier, context, next) {
            const relativo = specifier.startsWith('.') || specifier.startsWith('/');
            if (relativo && context.parentURL?.startsWith(SRC)) {
                try { return await next(specifier, context); } catch (e) {
                    if (e.code !== 'ERR_MODULE_NOT_FOUND' && e.code !== 'ERR_UNSUPPORTED_DIR_IMPORT') throw e;
                }
                for (const sufijo of ['.js', '/index.js']) {
                    try { return await next(specifier + sufijo, context); } catch {}
                }
            }
            return next(specifier, context);
        }
        export async function load(url, context, next) {
            if (url.startsWith(SRC) && url.endsWith('.js')) return next(url, { ...context, format: 'module' });
            return next(url, context);
        }
    `),
    import.meta.url,
);

const cargar = (ruta) => import(pathToFileURL(path.join(RAIZ, 'src', ruta)).href);
const { default: admin } = await cargar('lib/firebase/firebaseAdmin.js');
const { default: ventas, config: _c1 } = await cargar('pages/api/integrations/pos-transactions.js');
const { default: compras } = await cargar('pages/api/integrations/pos-purchases.js');
const { default: limpiar } = await cargar('pages/api/admin/tenant-backups/wipe.js');
const { createSetupSessionCookie } = await cargar('lib/server/setupSession.js');

const opciones = admin.app().options;
assert.equal(
    opciones.projectId ?? opciones.credential?.projectId,
    'demo-chago',
    'el Admin SDK debe apuntar al proyecto de emulador',
);
const db = admin.firestore();

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Llama a un handler de API como lo haría Next, y devuelve { status, body }. */
async function llamar(handler, { headers = {}, body } = {}) {
    let status = 200;
    let payload;
    const res = {
        setHeader() {},
        status(c) { status = c; return res; },
        json(p) { payload = p; return res; },
    };
    await handler({ method: 'POST', headers, query: {}, body }, res);
    return { status, body: payload };
}

const TOKEN = 'token-de-prueba';
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const bearer = { authorization: `Bearer ${TOKEN}` };
const METODOS = ['Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia'];

/** Un tenant vinculado con su catálogo de ventas íntegro, como lo deja `/activate`. */
async function sembrarTenant(id, { catalogo = true, vinculado = true, nombre = 'Prueba SA' } = {}) {
    const ref = db.collection('tenants').doc(id);
    const ids = {
        generalId: `gen-${id}`,
        conceptId: `con-${id}`,
        subconceptIds: Object.fromEntries(METODOS.map((m) => [m, `sub-${id}-${m.replace(/\s/g, '')}`])),
    };
    await ref.set({
        nombreEmpresa: nombre,
        ...(vinculado && { posIntegration: { enabled: true, tokenHash: hash(TOKEN), ...ids } }),
    });
    await ref.collection('members').doc('u1').set({ role: 'admin', email: 'admin@prueba.test' });
    if (catalogo) await crearCatalogo(id, ids);
    return ids;
}

async function crearCatalogo(id, ids) {
    const base = { isActive: true, locked: true, origen: 'pos_sync' };
    const ref = db.collection('tenants').doc(id);
    await ref.collection('generals').doc(ids.generalId).set({ name: 'Punto de venta · Prueba · Ventas', type: 'entrada', ...base });
    await ref.collection('concepts').doc(ids.conceptId).set({ name: 'Ventas POS', type: 'entrada', generalId: ids.generalId, ...base });
    for (const m of METODOS) {
        await ref.collection('subconcepts').doc(ids.subconceptIds[m]).set({ name: m, conceptId: ids.conceptId, ...base });
    }
}

async function borrarCatalogo(id) {
    for (const col of ['generals', 'concepts', 'subconcepts']) {
        const snap = await db.collection(`tenants/${id}/${col}`).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
    }
}

const contar = async (id, col) => (await db.collection(`tenants/${id}/${col}`).get()).size;

const venta = (tenant, externalId, payments = [{ method: 'Efectivo', amount: 100 }]) => ({
    chagoTenantId: tenant,
    externalId,
    amount: payments.reduce((s, p) => s + p.amount, 0),
    paymentMethod: payments[0].method,
    payments,
    folio: externalId.toUpperCase(),
    date: new Date().toISOString(),
    description: `Venta POS · ${externalId}`,
});

// ── Ventas ──────────────────────────────────────────────────────────────────

const A = 'tenant-ventas';
let idsA;
before(async () => { idsA = await sembrarTenant(A); });

test('una venta con el catálogo íntegro entra, colgada del subconcepto de su método', async () => {
    const r = await llamar(ventas, { headers: bearer, body: venta(A, 'v1') });
    assert.equal(r.status, 201, JSON.stringify(r.body));

    const tx = await db.collection(`tenants/${A}/transacciones`).doc(r.body.chagoTransactionId).get();
    assert.equal(tx.data().subconceptId, idsA.subconceptIds.Efectivo);
    assert.equal(tx.data().generalId, idsA.generalId);
    assert.equal(await contar(A, 'payments'), 1, 'y nace con su pago');
});

test('reenviar la misma venta no duplica nada (idempotencia)', async () => {
    const r = await llamar(ventas, { headers: bearer, body: venta(A, 'v1') });
    assert.equal(r.status, 200);
    assert.equal(r.body.alreadyExisted, true);
    assert.equal(await contar(A, 'transacciones'), 1);
});

test('con el catálogo borrado, una venta nueva se RECHAZA con 409 y no se escribe nada', async () => {
    await borrarCatalogo(A);
    const antes = await contar(A, 'transacciones');

    const r = await llamar(ventas, { headers: bearer, body: venta(A, 'v2') });

    assert.equal(r.status, 409, 'antes de este cambio devolvía 201 y la dejaba huérfana');
    assert.match(r.body.error, /vuelve a guardar el vínculo/);
    assert.equal(await contar(A, 'transacciones'), antes, 'ninguna transacción huérfana');
    assert.equal(await contar(A, 'payments'), 1, 'ni pago huérfano');
});

test('un reenvío de una venta que YA estaba recibida sigue contestando 200 aunque falte el catálogo', async () => {
    // La idempotencia gana: el POS que reintenta una venta que sí llegó debe poder darla por enviada.
    const r = await llamar(ventas, { headers: bearer, body: venta(A, 'v1') });
    assert.equal(r.status, 200);
    assert.equal(r.body.alreadyExisted, true);
});

test('al recrear el catálogo (como hace /activate) la venta que esperaba entra', async () => {
    await crearCatalogo(A, idsA);
    const r = await llamar(ventas, { headers: bearer, body: venta(A, 'v2') });
    assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('solo se exige lo que la venta usa: sin "Tarjeta Débito", Efectivo pasa y Débito no', async () => {
    await db.collection(`tenants/${A}/subconcepts`).doc(idsA.subconceptIds['Tarjeta Débito']).delete();

    const efectivo = await llamar(ventas, { headers: bearer, body: venta(A, 'v3') });
    assert.equal(efectivo.status, 201);

    const debito = await llamar(ventas, { headers: bearer, body: venta(A, 'v4', [{ method: 'Tarjeta Débito', amount: 80 }]) });
    assert.equal(debito.status, 409);

    // Un pago dividido que incluye el método faltante también se rechaza completo, sin escribir la mitad.
    const antes = await contar(A, 'transacciones');
    const dividido = await llamar(ventas, {
        headers: bearer,
        body: venta(A, 'v5', [{ method: 'Efectivo', amount: 50 }, { method: 'Tarjeta Débito', amount: 50 }]),
    });
    assert.equal(dividido.status, 409);
    assert.equal(await contar(A, 'transacciones'), antes, 'el pago dividido no deja una mitad escrita');
});

test('un token ajeno sigue dando 401 (la comprobación nueva no abre nada)', async () => {
    const r = await llamar(ventas, { headers: { authorization: 'Bearer otro' }, body: venta(A, 'v6') });
    assert.equal(r.status, 401);
});

// ── Limpiar datos ───────────────────────────────────────────────────────────

const B = 'tenant-limpieza';
const compra = (tenant, externalId) => ({
    chagoTenantId: tenant, externalId, productId: 'P1', productName: 'Tornillo',
    quantity: 2, unitCost: 50, date: new Date().toISOString(), businessName: 'Prueba',
});
const cookie = () => ({ cookie: createSetupSessionCookie('clave-de-prueba').split(';')[0] });

test('limpiar un tenant vinculado invalida el memo de compras y la compra siguiente reconstruye la rama', async () => {
    await sembrarTenant(B);

    // Una compra real deja lista la rama de compras y fija el memo.
    const primera = await llamar(compras, { headers: bearer, body: compra(B, 'c1') });
    assert.equal(primera.status, 201, JSON.stringify(primera.body));
    let integ = (await db.collection('tenants').doc(B).get()).data().posIntegration;
    assert.ok(integ.purchaseReadyAt, 'el memo quedó fijado');

    const r = await llamar(limpiar, { headers: cookie(), body: { tenantId: B, confirmName: 'Prueba SA' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.posLinked, true, 'la respuesta avisa que el tenant estaba vinculado');

    integ = (await db.collection('tenants').doc(B).get()).data().posIntegration;
    assert.equal(integ.purchaseReadyAt, null, 'el memo ya no miente');
    assert.equal(integ.enabled, true, 'el vínculo sigue activo');
    assert.equal(await contar(B, 'generals'), 0, 'el catálogo sí se borró');
    assert.equal(await contar(B, 'members'), 1, 'los usuarios se conservan');

    // Sin la invalidación, esta compra se aceptaba contra una rama que ya no existía.
    const siguiente = await llamar(compras, { headers: bearer, body: compra(B, 'c2') });
    assert.equal(siguiente.status, 201, JSON.stringify(siguiente.body));
    const general = await db.doc(`tenants/${B}/generals/pos_general_compras`).get();
    assert.equal(general.exists, true, 'la rama de compras se reconstruyó sola');
    const tx = await db.collection(`tenants/${B}/transacciones`).doc(siguiente.body.chagoTransactionId).get();
    assert.equal(tx.data().conceptId, 'pos_compras');
});

test('después de limpiar, una venta es rechazada hasta que se vuelva a guardar el vínculo', async () => {
    // Es exactamente el caso real: catálogo de ventas borrado, ids todavía en posIntegration.
    const r = await llamar(ventas, { headers: bearer, body: venta(B, 'v1') });
    assert.equal(r.status, 409);
});

test('limpiar un tenant sin vínculo no inventa un posIntegration ni avisa del POS', async () => {
    const C = 'tenant-sin-pos';
    await sembrarTenant(C, { vinculado: false, catalogo: false, nombre: 'Sin POS' });

    const r = await llamar(limpiar, { headers: cookie(), body: { tenantId: C, confirmName: 'Sin POS' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.posLinked, false);
    assert.equal((await db.collection('tenants').doc(C).get()).data().posIntegration, undefined);
});

test('sin la cookie de sesión de configuración, limpiar da 401 y no borra nada', async () => {
    const D = 'tenant-protegido';
    await sembrarTenant(D);
    const r = await llamar(limpiar, { headers: {}, body: { tenantId: D, confirmName: 'Prueba SA' } });
    assert.equal(r.status, 401);
    assert.equal(await contar(D, 'generals'), 1, 'el catálogo sigue ahí');
});
