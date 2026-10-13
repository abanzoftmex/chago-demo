/**
 * Accesos compartidos: una persona, varios negocios (servidor).
 *
 *   npm run test:acceso
 *
 * Ejecuta los HANDLERS REALES de las rutas de API contra los emuladores de
 * Firestore y Auth: alta y baja desde la consola de superadmin, la lista de
 * negocios de la persona y los guardias de las rutas de administración de un
 * negocio. Incluye los dos huecos que existían ANTES de esta función (el atajo del
 * "único miembro" y borrar cuentas de otros negocios), porque la protección de las
 * cuentas compartidas se apoya en cerrarlos.
 *
 * Solo habla con los emuladores. Aborta si no están.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';

import { registrarCargador } from './cargador.mjs';

// ── Guardas ─────────────────────────────────────────────────────────────────
for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[v]) {
        console.error(`Falta ${v}: esto solo corre contra los emuladores. Usa: npm run test:acceso`);
        process.exit(1);
    }
}
for (const k of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_CONFIG']) delete process.env[k];

const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
});
Object.assign(process.env, {
    FIREBASE_PROJECT_ID: 'demo-chago',
    FIREBASE_CLIENT_EMAIL: 'prueba@demo-chago.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: privateKey,
    TENANT_SETUP_PASSWORD: 'clave-de-prueba',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:1',
});

const RAIZ = path.resolve(import.meta.dirname, '../..');
const cargar = registrarCargador(RAIZ, import.meta.url);

const { default: admin } = await cargar('lib/firebase/firebaseAdmin.js');
const { default: compartido } = await cargar('pages/api/admin/shared-access.js');
const { default: misNegocios } = await cargar('pages/api/me/tenants.js');
const { default: gestionar } = await cargar('pages/api/admin/manage-user.js');
const { default: actualizar } = await cargar('pages/api/admin/update-user-tenant.js');
const { default: crear } = await cargar('pages/api/admin/create-user-tenant.js');
const { createSetupSessionCookie } = await cargar('lib/server/setupSession.js');

assert.equal(admin.app().options.projectId ?? admin.app().options.credential?.projectId, 'demo-chago');
const db = admin.firestore();
const auth = admin.auth();

// ── Utilidades ──────────────────────────────────────────────────────────────

async function llamar(handler, { method = 'POST', headers = {}, body, query = {} } = {}) {
    let status = 200;
    let payload;
    const res = {
        setHeader() {},
        status(c) { status = c; return res; },
        json(p) { payload = p; return res; },
    };
    await handler({ method, headers, body, query }, res);
    return { status, body: payload };
}

const CLAVE = 'ensayo-123';
async function token(email) {
    const r = await fetch(
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=cualquiera`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: CLAVE, returnSecureToken: true }) },
    );
    const j = await r.json();
    assert.ok(j.idToken, `no se pudo entrar como ${email}: ${JSON.stringify(j)}`);
    return j.idToken;
}

const cookie = () => ({ cookie: createSetupSessionCookie('clave-de-prueba').split(';')[0] });
const bearer = async (email) => ({ authorization: `Bearer ${await token(email)}` });

const A = 'negocio-alfa';
const B = 'negocio-beta';
const C = 'negocio-gamma';
const NOMBRES = { [A]: 'Alfa SA', [B]: 'Beta SA', [C]: 'Gamma SA' };

/** Una persona del propio negocio: cuenta, `users` y membresía. */
async function persona(uid, email, tenantId, role) {
    await auth.createUser({ uid, email, password: CLAVE, displayName: uid });
    await db.collection('users').doc(uid).set({ email, displayName: uid, tenantId, tenantIds: [tenantId] });
    await db.collection(`tenants/${tenantId}/members`).doc(uid).set({ email, displayName: uid, role, status: 'active' });
}

const cuentaExiste = async (uid) => auth.getUser(uid).then(() => true, () => false);
const miembro = async (tenantId, uid) => (await db.collection(`tenants/${tenantId}/members`).doc(uid).get());
const usuario = async (uid) => (await db.collection('users').doc(uid).get()).data();

before(async () => {
    for (const [id, nombre] of Object.entries(NOMBRES)) await db.collection('tenants').doc(id).set({ nombreEmpresa: nombre });
    await persona('ana', 'ana@alfa.test', A, 'admin');       // admin de Alfa
    await persona('aldo', 'aldo@alfa.test', A, 'admin');     // segundo admin de Alfa
    await persona('sam', 'sam@alfa.test', A, 'contador');    // staff de Alfa
    await persona('beto', 'beto@beta.test', B, 'admin');     // único miembro de Beta
    await persona('carla', 'carla@gamma.test', C, 'admin');  // único miembro de Gamma
    await auth.createUser({ uid: 'zoe', email: 'zoe@suelta.test', password: CLAVE }); // cuenta sin ningún negocio
});

after(async () => { await admin.app().delete().catch(() => {}); });

// ── Consola de superadmin ───────────────────────────────────────────────────

test('sin la cookie de sesión de configuración no se da, quita ni lista nada', async () => {
    for (const method of ['GET', 'POST', 'DELETE']) {
        const r = await llamar(compartido, { method, headers: {}, body: { tenantId: A }, query: { tenantId: A } });
        assert.equal(r.status, 401, method);
    }
    // Ni siquiera un administrador del negocio, con su token, entra por aquí.
    const r = await llamar(compartido, { method: 'POST', headers: await bearer('ana@alfa.test'), body: { tenantId: A, email: 'x@y.test', password: CLAVE } });
    assert.equal(r.status, 401);
});

test('validaciones del alta: correo, rol, contraseña y negocio', async () => {
    const dar = (body) => llamar(compartido, { headers: cookie(), body: { tenantId: A, ...body } });
    assert.equal((await dar({ email: 'no-es-correo', password: CLAVE })).status, 400);
    assert.equal((await dar({ email: 'dora@nube.test', password: CLAVE, role: 'dios' })).status, 400);
    assert.equal((await dar({ email: 'dora@nube.test' })).body.codigo, 'CLAVE_REQUERIDA');
    assert.equal((await dar({ email: 'dora@nube.test', password: '123' })).body.codigo, 'CLAVE_CORTA');
    assert.equal((await llamar(compartido, { headers: cookie(), body: { tenantId: 'no-existe', email: 'dora@nube.test', password: CLAVE } })).status, 404);
    assert.equal(await auth.getUserByEmail('dora@nube.test').then(() => true, () => false), false, 'ninguna de esas creó la cuenta');
});

test('alta: una persona nueva queda con acceso compartido y su negocio de casa', async () => {
    const r = await llamar(compartido, { headers: cookie(), body: { tenantId: A, email: 'Dora@Nube.test', password: CLAVE, displayName: 'Dora Directiva', role: 'admin' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.cuentaNueva, true);

    const uid = r.body.userId;
    const m = (await miembro(A, uid)).data();
    assert.equal(m.role, 'admin');
    assert.equal(m.status, 'active');
    assert.equal(m.vinculadoPor, 'superadmin');

    const u = await usuario(uid);
    assert.equal(u.accesoCompartido, true);
    assert.equal(u.tenantId, A, 'su negocio de casa es el primero que se le dio');
    assert.equal(u.email, 'dora@nube.test', 'el correo se normaliza');
});

test('alta: a una cuenta que ya existe no se le pide contraseña y su negocio de casa no cambia', async () => {
    const dora = await auth.getUserByEmail('dora@nube.test');
    const r = await llamar(compartido, { headers: cookie(), body: { tenantId: B, email: 'dora@nube.test', role: 'viewer' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.cuentaNueva, false);
    assert.equal(r.body.otrosNegocios, 1);

    assert.equal((await miembro(B, dora.uid)).data().role, 'viewer', 'en Beta solo mira');
    assert.equal((await miembro(A, dora.uid)).data().role, 'admin', 'en Alfa sigue siendo admin');
    assert.equal((await usuario(dora.uid)).tenantId, A, 'sigue entrando por Alfa');
});

test('alta repetida: se rechaza con motivo y no duplica nada', async () => {
    const r = await llamar(compartido, { headers: cookie(), body: { tenantId: B, email: 'dora@nube.test', role: 'admin' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'YA_TIENE_ACCESO');

    const propio = await llamar(compartido, { headers: cookie(), body: { tenantId: A, email: 'sam@alfa.test', role: 'admin' } });
    assert.equal(propio.body.codigo, 'YA_ES_MIEMBRO', 'a alguien del propio negocio no se le "da" un acceso compartido');
});

test('la lista de accesos del negocio muestra solo los compartidos y a cuántos negocios llegan', async () => {
    const r = await llamar(compartido, { method: 'GET', headers: cookie(), query: { tenantId: B } });
    assert.equal(r.status, 200);
    assert.equal(r.body.accesos.length, 1, 'Beto es del propio negocio: no aparece');
    assert.equal(r.body.accesos[0].email, 'dora@nube.test');
    assert.equal(r.body.accesos[0].otrosNegocios, 1);
});

test('el alta queda en la bitácora del negocio, firmada por Abanzoft', async () => {
    const logs = await db.collection(`tenants/${A}/logs`).get();
    const textos = logs.docs.map((d) => d.data().details);
    assert.ok(textos.some((t) => /Abanzoft dio acceso compartido a Dora/.test(t)), JSON.stringify(textos));
});

// ── La persona entra y elige negocio ────────────────────────────────────────

test('/api/me/tenants: la persona ve sus negocios con el rol de cada uno', async () => {
    const r = await llamar(misNegocios, { method: 'GET', headers: await bearer('dora@nube.test') });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body.tenants.map((t) => [t.nombre, t.role, t.compartido]), [['Alfa SA', 'admin', true], ['Beta SA', 'viewer', true]]);
    assert.equal(r.body.home, A);
});

test('/api/me/tenants: una persona de un solo negocio ve solo el suyo, y sin token no hay nada', async () => {
    const r = await llamar(misNegocios, { method: 'GET', headers: await bearer('ana@alfa.test') });
    assert.deepEqual(r.body.tenants.map((t) => [t.nombre, t.compartido]), [['Alfa SA', false]]);

    assert.equal((await llamar(misNegocios, { method: 'GET', headers: {} })).status, 401);
    assert.equal((await llamar(misNegocios, { method: 'GET', headers: { authorization: 'Bearer basura' } })).status, 401);
    assert.deepEqual((await llamar(misNegocios, { method: 'GET', headers: await bearer('zoe@suelta.test') })).body.tenants, []);
});

// ── Lo que un administrador de negocio NO puede hacer con una cuenta compartida ──

const comoAdmin = async (email, tenantId, extra) => ({
    body: { currentUserToken: await token(email), tenantId, ...extra },
});

test('el admin del negocio no puede deshabilitar, borrar ni editar un acceso compartido', async () => {
    const dora = await auth.getUserByEmail('dora@nube.test');

    for (const [handler, method, extra] of [
        [gestionar, 'POST', { userId: dora.uid, action: 'disable' }],
        [gestionar, 'DELETE', { userId: dora.uid }],
        [actualizar, 'PUT', { userId: dora.uid, role: 'viewer' }],
        [actualizar, 'PUT', { userId: dora.uid, password: 'otra-clave' }],
    ]) {
        const r = await llamar(handler, { method, ...(await comoAdmin('ana@alfa.test', A, extra)) });
        assert.equal(r.status, 403, `${method} ${JSON.stringify(extra)} → ${JSON.stringify(r.body)}`);
        assert.equal(r.body.codigo, 'ACCESO_COMPARTIDO');
    }

    assert.equal((await auth.getUser(dora.uid)).disabled, false, 'la cuenta sigue habilitada');
    assert.equal((await miembro(A, dora.uid)).exists, true);
    assert.equal((await miembro(B, dora.uid)).exists, true);
});

test('una cuenta de un negocio que además tiene un acceso compartido: se puede cambiar su rol, no la cuenta', async () => {
    // Sam es staff de Alfa; Abanzoft le da además acceso a Beta.
    await llamar(compartido, { headers: cookie(), body: { tenantId: B, email: 'sam@alfa.test', role: 'viewer' } });

    // Aldo (admin de Alfa) cambia el rol de Sam EN ALFA: es cosa del negocio.
    const rol = await llamar(actualizar, { method: 'PUT', ...(await comoAdmin('aldo@alfa.test', A, { userId: 'sam', role: 'viewer' })) });
    assert.equal(rol.status, 200, JSON.stringify(rol.body));
    assert.equal((await miembro(A, 'sam')).data().role, 'viewer');

    // Pero no su contraseña, su correo ni si la cuenta está habilitada: son de la cuenta.
    const clave = await llamar(actualizar, { method: 'PUT', ...(await comoAdmin('aldo@alfa.test', A, { userId: 'sam', password: 'otra-clave' })) });
    assert.equal(clave.status, 403);
    const deshabilitar = await llamar(gestionar, { method: 'POST', ...(await comoAdmin('aldo@alfa.test', A, { userId: 'sam', action: 'disable' })) });
    assert.equal(deshabilitar.status, 403);
    assert.equal((await auth.getUser('sam')).disabled, false);

    // Reenviar el formulario sin cambiar nada de la cuenta no cuenta como cambiarla.
    const igual = await llamar(actualizar, { method: 'PUT', ...(await comoAdmin('aldo@alfa.test', A, { userId: 'sam', role: 'contador', email: 'sam@alfa.test', displayName: 'sam' })) });
    assert.equal(igual.status, 200, JSON.stringify(igual.body));
});

test('borrar de un negocio a quien entra a otros quita SOLO ese negocio y conserva su cuenta', async () => {
    const r = await llamar(gestionar, { method: 'DELETE', ...(await comoAdmin('aldo@alfa.test', A, { userId: 'sam' })) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.cuentaConservada, true);

    assert.equal(await cuentaExiste('sam'), true, 'su cuenta de Firebase sigue');
    assert.equal((await miembro(A, 'sam')).exists, false, 'ya no es de Alfa');
    assert.equal((await miembro(B, 'sam')).exists, true, 'su acceso a Beta sigue');

    const u = await usuario('sam');
    assert.equal(u.tenantId, B, 'su negocio de casa pasó al que le queda');
    assert.equal(u.accesoCompartido, true);
});

test('el negocio SÍ sigue gestionando a su gente normal: deshabilitar, habilitar y borrar', async () => {
    await persona('tere', 'tere@alfa.test', A, 'viewer');

    const off = await llamar(gestionar, { method: 'POST', ...(await comoAdmin('ana@alfa.test', A, { userId: 'tere', action: 'disable' })) });
    assert.equal(off.status, 200, JSON.stringify(off.body));
    assert.equal((await auth.getUser('tere')).disabled, true);

    const on = await llamar(gestionar, { method: 'POST', ...(await comoAdmin('ana@alfa.test', A, { userId: 'tere', action: 'enable' })) });
    assert.equal(on.status, 200);

    const del = await llamar(gestionar, { method: 'DELETE', ...(await comoAdmin('ana@alfa.test', A, { userId: 'tere' })) });
    assert.equal(del.status, 200);
    assert.equal(await cuentaExiste('tere'), false, 'una cuenta de un solo negocio se borra completa, como siempre');
    assert.equal((await db.collection('users').doc('tere').get()).exists, false);
});

test('un negocio ya no puede sumar a su lista una cuenta que entra a OTRO negocio', async () => {
    const r = await llamar(crear, { body: { currentUserToken: await token('ana@alfa.test'), tenantId: A, email: 'beto@beta.test', role: 'viewer' } });
    assert.equal(r.status, 409, JSON.stringify(r.body));
    assert.equal(r.body.codigo, 'CUENTA_EN_OTRO_NEGOCIO');
    assert.equal((await miembro(A, 'beto')).exists, false);
});

test('el alta normal de un usuario nuevo del negocio sigue funcionando', async () => {
    const r = await llamar(crear, { body: { currentUserToken: await token('ana@alfa.test'), tenantId: A, email: 'nuevo@alfa.test', password: CLAVE, role: 'contador', displayName: 'Nuevo' } });
    assert.ok([200, 201].includes(r.status), JSON.stringify(r));
    const cuenta = await auth.getUserByEmail('nuevo@alfa.test');
    assert.equal((await miembro(A, cuenta.uid)).data().role, 'contador');
});

test('una cuenta que ya no tiene ningún negocio sí se puede volver a dar de alta en uno', async () => {
    const r = await llamar(crear, { body: { currentUserToken: await token('ana@alfa.test'), tenantId: A, email: 'zoe@suelta.test', role: 'viewer' } });
    assert.ok([200, 201].includes(r.status), JSON.stringify(r));
    assert.equal((await miembro(A, 'zoe')).exists, true);
});

// ── Los dos huecos que existían antes ───────────────────────────────────────

test('ya no hay atajo para los negocios de un solo miembro: una cuenta ajena no gestiona a su dueño', async () => {
    // Gamma tiene un solo miembro (Carla). Antes bastaba una cuenta autenticada CUALQUIERA.
    const intruso = await llamar(gestionar, { method: 'DELETE', ...(await comoAdmin('beto@beta.test', C, { userId: 'carla' })) });
    assert.equal(intruso.status, 403, JSON.stringify(intruso.body));
    const sinNegocio = await llamar(gestionar, { method: 'POST', ...(await comoAdmin('zoe@suelta.test', C, { userId: 'carla', action: 'disable' })) });
    assert.equal(sinNegocio.status, 403);

    assert.equal(await cuentaExiste('carla'), true);
    assert.equal((await auth.getUser('carla')).disabled, false);
    assert.equal((await miembro(C, 'carla')).exists, true);
});

test('un administrador no puede tocar la cuenta de alguien que NO es de su negocio', async () => {
    // Carla es admin de Gamma y manda su propio tenantId con el uid de Beto, de Beta.
    const r = await llamar(gestionar, { method: 'DELETE', ...(await comoAdmin('carla@gamma.test', C, { userId: 'beto' })) });
    assert.equal(r.status, 404, JSON.stringify(r.body));
    assert.equal(await cuentaExiste('beto'), true, 'antes esto borraba la cuenta de Beto');
});

// ── Quitar el acceso ────────────────────────────────────────────────────────

test('quitar un acceso que no es compartido (un usuario del propio negocio) se rechaza', async () => {
    const r = await llamar(compartido, { method: 'DELETE', headers: cookie(), body: { tenantId: A, userId: 'ana' } });
    assert.equal(r.status, 409);
    assert.equal(r.body.codigo, 'NO_ES_COMPARTIDO');
    assert.equal(await cuentaExiste('ana'), true);
});

test('quitar un acceso si le quedan otros: se va solo ese negocio y su negocio de casa se reasigna', async () => {
    const dora = await auth.getUserByEmail('dora@nube.test');
    // Su casa es Alfa; se le quita Alfa y le queda Beta.
    const r = await llamar(compartido, { method: 'DELETE', headers: cookie(), body: { tenantId: A, userId: dora.uid } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.cuentaEliminada, false);

    assert.equal((await miembro(A, dora.uid)).exists, false);
    assert.equal((await miembro(B, dora.uid)).data().role, 'viewer');
    const u = await usuario(dora.uid);
    assert.equal(u.tenantId, B, 'ahora entra por Beta');
    assert.equal(u.accesoCompartido, true);
    assert.equal(await cuentaExiste(dora.uid), true);
});

test('quitar el ÚLTIMO acceso no deja una cuenta suelta: pide darla de baja', async () => {
    const dora = await auth.getUserByEmail('dora@nube.test');

    const sin = await llamar(compartido, { method: 'DELETE', headers: cookie(), body: { tenantId: B, userId: dora.uid } });
    assert.equal(sin.status, 409);
    assert.equal(sin.body.codigo, 'ULTIMO_NEGOCIO');
    assert.equal(sin.body.requiereBaja, true);
    assert.equal((await miembro(B, dora.uid)).exists, true, 'no se quitó nada');

    const con = await llamar(compartido, { method: 'DELETE', headers: cookie(), body: { tenantId: B, userId: dora.uid, eliminarCuenta: true } });
    assert.equal(con.status, 200, JSON.stringify(con.body));
    assert.equal(con.body.cuentaEliminada, true);
    assert.equal(await cuentaExiste(dora.uid), false);
    assert.equal((await db.collection('users').doc(dora.uid).get()).exists, false);
});

test('la baja también queda en la bitácora', async () => {
    const logs = await db.collection(`tenants/${A}/logs`).get();
    assert.ok(logs.docs.some((d) => /Abanzoft quitó el acceso compartido de Dora/.test(d.data().details)));
});
