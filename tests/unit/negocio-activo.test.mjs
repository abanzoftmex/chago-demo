import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    claveNegocioActivo,
    elegirNegocio,
    leerNegocioGuardado,
    guardarNegocio,
    esCambioDeNegocioAjeno,
} from '../../src/lib/negocioActivo.js';

const NEGOCIOS = [{ id: 'alfa' }, { id: 'beta' }, { id: 'gamma' }];

test('entra al último negocio que usó en este navegador, si todavía le sirve', () => {
    assert.equal(elegirNegocio(NEGOCIOS, { guardado: 'beta', propio: 'alfa' }), 'beta');
});

test('si el que recordaba ya no es suyo, entra al de casa', () => {
    // Se lo quitaron, o alguien escribió otro id a mano en localStorage: no concede nada.
    assert.equal(elegirNegocio(NEGOCIOS, { guardado: 'otro-negocio', propio: 'gamma' }), 'gamma');
});

test('sin nada recordado entra al de casa', () => {
    assert.equal(elegirNegocio(NEGOCIOS, { propio: 'beta' }), 'beta');
});

test('si ni el recordado ni el de casa le sirven, entra al primero: nunca se queda sin ninguno', () => {
    assert.equal(elegirNegocio(NEGOCIOS, { guardado: 'x', propio: 'y' }), 'alfa');
});

test('sin negocios no elige nada (el llamador no cambia nada)', () => {
    assert.equal(elegirNegocio([], { guardado: 'alfa', propio: 'alfa' }), null);
    assert.equal(elegirNegocio(null), null);
    assert.equal(elegirNegocio(undefined, {}), null);
});

test('una lista con basura no rompe la elección', () => {
    assert.equal(elegirNegocio([null, {}, { id: undefined }, { id: 'alfa' }], { propio: 'alfa' }), 'alfa');
    assert.equal(elegirNegocio([{ id: 'alfa' }], { guardado: '', propio: '   ' }), 'alfa');
});

test('el negocio recordado es POR CUENTA: quien use el equipo después no lo hereda', () => {
    assert.notEqual(claveNegocioActivo('ana'), claveNegocioActivo('beto'));

    const almacen = new Map();
    const falso = { getItem: (k) => almacen.get(k) ?? null, setItem: (k, v) => almacen.set(k, v) };
    guardarNegocio(falso, 'ana', 'beta');
    assert.equal(leerNegocioGuardado(falso, 'ana'), 'beta');
    assert.equal(leerNegocioGuardado(falso, 'beto'), null);
});

test('localStorage bloqueado o ausente nunca lanza: simplemente no recuerda', () => {
    const roto = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
    assert.equal(leerNegocioGuardado(roto, 'ana'), null);
    assert.equal(guardarNegocio(roto, 'ana', 'beta'), false);
    assert.equal(leerNegocioGuardado(undefined, 'ana'), null);
    assert.equal(guardarNegocio(null, 'ana', 'beta'), false);
});

test('otra pestaña de la MISMA cuenta que cambia de negocio obliga a recargar', () => {
    const clave = claveNegocioActivo('ana');
    assert.equal(esCambioDeNegocioAjeno({ key: clave, oldValue: 'alfa', newValue: 'beta' }, 'ana'), true);
});

test('lo demás no recarga: otra cuenta, otra clave, el mismo valor o borrar la clave', () => {
    const clave = claveNegocioActivo('ana');
    assert.equal(esCambioDeNegocioAjeno({ key: claveNegocioActivo('beto'), oldValue: 'a', newValue: 'b' }, 'ana'), false);
    assert.equal(esCambioDeNegocioAjeno({ key: 'otra-cosa', oldValue: 'a', newValue: 'b' }, 'ana'), false);
    assert.equal(esCambioDeNegocioAjeno({ key: clave, oldValue: 'alfa', newValue: 'alfa' }, 'ana'), false);
    assert.equal(esCambioDeNegocioAjeno({ key: clave, oldValue: 'alfa', newValue: null }, 'ana'), false);
    assert.equal(esCambioDeNegocioAjeno(null, 'ana'), false);
});
