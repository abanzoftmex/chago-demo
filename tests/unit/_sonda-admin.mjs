// Sonda para `freno-emuladores.test.mjs`: carga el Admin SDK del repo en un proceso limpio e
// imprime cuántas apps quedaron inicializadas. No es una prueba por sí misma (el guion bajo
// la deja fuera de `node --test`), porque el módulo se evalúa una sola vez por proceso.
import path from 'node:path';
import { registrarCargador } from '../integracion/cargador.mjs';

const cargar = registrarCargador(path.resolve(import.meta.dirname, '../..'), import.meta.url);
const { default: admin } = await cargar('lib/firebase/firebaseAdmin.js');
console.log(JSON.stringify({ apps: admin.apps.length }));
