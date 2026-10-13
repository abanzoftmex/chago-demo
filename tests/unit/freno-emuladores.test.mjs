import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/*
  El freno de `firebaseAdmin.js`: en el ensayo con emuladores (`NEXT_PUBLIC_USE_EMULATOR=true`)
  el Admin SDK NO debe inicializarse con las credenciales de `.env.local` —las de producción—
  si el servidor no apunta también a los emuladores. Cada caso corre en un proceso aparte
  porque el módulo se evalúa una sola vez.
*/

const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const SONDA = path.resolve(import.meta.dirname, '_sonda-admin.mjs');

function appsInicializadas(entorno) {
    const base = {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        FIREBASE_PROJECT_ID: 'proyecto-de-prueba',
        FIREBASE_CLIENT_EMAIL: 'prueba@proyecto-de-prueba.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: privateKey,
    };
    const r = spawnSync(process.execPath, [SONDA], { env: { ...base, ...entorno }, encoding: 'utf8' });
    const linea = r.stdout.trim().split('\n').pop();
    return { apps: JSON.parse(linea).apps, avisos: r.stderr };
}

test('producción y desarrollo normal: sin la variable del ensayo, el Admin SDK se inicializa como siempre', () => {
    assert.equal(appsInicializadas({}).apps, 1);
});

test('ensayo SIN emuladores de servidor: el Admin SDK no se inicializa y lo dice', () => {
    const r = appsInicializadas({ NEXT_PUBLIC_USE_EMULATOR: 'true' });
    assert.equal(r.apps, 0, 'con credenciales reales habría escrito en producción');
    assert.match(r.avisos, /NO se inicializa/);
});

test('ensayo con solo UNO de los dos emuladores: tampoco (Auth y Firestore, o ninguno)', () => {
    assert.equal(appsInicializadas({ NEXT_PUBLIC_USE_EMULATOR: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }).apps, 0);
    assert.equal(appsInicializadas({ NEXT_PUBLIC_USE_EMULATOR: 'true', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' }).apps, 0);
});

test('ensayo con los dos emuladores de servidor puestos: se inicializa', () => {
    const r = appsInicializadas({
        NEXT_PUBLIC_USE_EMULATOR: 'true',
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    });
    assert.equal(r.apps, 1);
});
