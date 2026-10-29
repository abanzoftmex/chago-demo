/**
 * Preparación común de las pruebas de integración que ejecutan los handlers
 * REALES de la API contra el emulador de Firestore, sin levantar Next.
 *
 * Importar este archivo ES la preparación: corta el proceso si no hay emulador,
 * apunta el Admin SDK al proyecto `demo-chago` con credenciales falsas y
 * registra el resolvedor que Next hace solo (imports ESM sin extensión).
 * Por eso se importa ANTES de cargar nada de `src/`.
 *
 * `pos-catalogo.test.mjs` trae esta misma preparación en línea; no se tocó para
 * no mover una prueba que ya funciona.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// ── Guardas: esto SOLO corre contra el emulador ─────────────────────────────
// El .env.local de este repo trae credenciales de producción. Nada de aquí las
// lee (no hay Next), pero se cierra la puerta de todos modos.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('Esta prueba solo corre contra el emulador. Usa: npm run test:contrato');
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
// Sin emulador de Storage, esto manda los adjuntos a un puerto cerrado de esta
// máquina en vez de a Google.
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:1';

export const RAIZ = path.resolve(import.meta.dirname, '../../..');
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

/** Carga un módulo de `src/` por su ruta relativa a `src/`. */
export const cargar = (ruta) => import(pathToFileURL(path.join(RAIZ, 'src', ruta)).href);

const { default: admin } = await cargar('lib/firebase/firebaseAdmin.js');
const opciones = admin.app().options;
assert.equal(
    opciones.projectId ?? opciones.credential?.projectId,
    'demo-chago',
    'el Admin SDK debe apuntar al proyecto de emulador',
);

export { admin };
export const db = admin.firestore();

/** Llama a un handler de API como lo haría Next, y devuelve { status, body }. */
export async function llamar(handler, { headers = {}, body, query = {} } = {}) {
    let status = 200;
    let payload;
    const res = {
        setHeader() {},
        status(c) { status = c; return res; },
        json(p) { payload = p; return res; },
    };
    await handler({ method: 'POST', headers, query, body }, res);
    return { status, body: payload };
}
