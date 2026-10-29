/**
 * Contrato POS ↔ chago-demo: lo que debe pasar sea cual sea el punto de venta
 * que hable (punto-de-venta o pos-deluxe).
 *
 *   npm run test:contrato
 *
 * chago-demo no distingue quién le habla: autentica por token del negocio y no
 * guarda qué sistema es. Esa promesa solo se sostiene si los dos emisores
 * producen lo que chago-demo espera y caen en el MISMO catálogo. Aquí se prueba
 * con los payloads de cada emisor (tests/integracion/fixtures/contrato-*.json),
 * que cada repo vigila con su propia prueba de deriva, ejecutando los handlers
 * reales contra el emulador.
 *
 * Los casos marcados `todo` describen lo que DEBERÍA pasar y hoy no pasa: no
 * rompen la corrida, y se quitan de `todo` cuando se corrige el defecto.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { cargar, llamar, db, RAIZ } from './ayuda/emulador.mjs';

const { default: activate } = await cargar('pages/api/integrations/activate.js');
const { default: ventas } = await cargar('pages/api/integrations/pos-transactions.js');
const { default: compras } = await cargar('pages/api/integrations/pos-purchases.js');
const { default: anular } = await cargar('pages/api/integrations/pos-transactions/[id]/void.js');
const { generatePosIntegrationToken, revokePosIntegration } = await cargar('lib/server/posIntegrationService.js');

// ── Utilidades ──────────────────────────────────────────────────────────────

const fixture = (emisor) =>
    JSON.parse(readFileSync(path.join(RAIZ, 'tests/integracion/fixtures', `contrato-${emisor}.json`), 'utf8'));
const PDV = fixture('punto-de-venta');
const DX = fixture('pos-deluxe');

// El marcador de los fixtures se cambia por un PDF mínimo válido en base64.
const PDF_MINIMO = Buffer.from('%PDF-1.4\n').toString('base64');

/** El payload de un fixture para un tenant concreto, con los cambios que pida el caso. */
function para(payload, tenantId, cambios = {}) {
    const copia = JSON.parse(JSON.stringify(payload).replaceAll('__TENANT__', tenantId));
    if (copia.ticketPdfBase64 === '__PDF__') copia.ticketPdfBase64 = PDF_MINIMO;
    return { ...copia, ...cambios };
}

const bearer = (token) => ({ authorization: `Bearer ${token}` });

/**
 * Un tenant vinculado por el camino REAL: se emite el token y se llama a
 * `/activate` con el payload del emisor, como hace Torre de Control.
 */
async function preparar(id, emisor = PDV) {
    await db.collection('tenants').doc(id).set({ nombreEmpresa: 'Prueba Contrato' });
    const token = await generatePosIntegrationToken(id);
    const headers = bearer(token);
    const r = await llamar(activate, { headers, body: para(emisor.activate, id) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return { id, token, headers, ids: r.body };
}

const tx = async (tenant, id) => (await db.collection(`tenants/${tenant}/transacciones`).doc(id).get()).data();
const pago = async (tenant, txId) => (await db.collection(`tenants/${tenant}/payments`).doc(`pos_${txId}`).get()).data();
const contar = async (tenant, col) => (await db.collection(`tenants/${tenant}/${col}`).get()).size;
const claves = (obj) => Object.keys(obj).sort();

// ── Ventas: los dos emisores caen en el mismo catálogo ──────────────────────

test('una venta en efectivo de cada emisor cae en el mismo General, concepto y subconcepto', async () => {
    const t = await preparar('c-venta');

    const a = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const b = await llamar(ventas, { headers: t.headers, body: para(DX.venta, t.id) });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(b.status, 201, JSON.stringify(b.body));

    const ta = await tx(t.id, a.body.chagoTransactionId);
    const tb = await tx(t.id, b.body.chagoTransactionId);
    for (const x of [ta, tb]) {
        assert.equal(x.generalId, t.ids.generalId);
        assert.equal(x.conceptId, t.ids.conceptId);
        assert.equal(x.subconceptId, t.ids.subconceptIds.Efectivo);
        assert.equal(x.type, 'entrada');
        assert.equal(x.posKind, 'venta');
        assert.equal(x.origen, 'pos_sync');
        assert.equal(x.locked, true);
        assert.equal(x.amount, 150);
        assert.equal(x.status, 'pagado');
    }
    assert.deepEqual(claves(ta), claves(tb), 'la transacción tiene los mismos campos venga de donde venga');
    assert.ok(await pago(t.id, a.body.chagoTransactionId), 'la de punto-de-venta nace con su pago');
    assert.ok(await pago(t.id, b.body.chagoTransactionId), 'la de pos-deluxe nace con su pago');
});

test('una venta con pago dividido se parte igual para los dos emisores: una transacción por método', async () => {
    const t = await preparar('c-dividida');

    for (const [nombre, emisor] of [['punto-de-venta', PDV], ['pos-deluxe', DX]]) {
        const r = await llamar(ventas, { headers: t.headers, body: para(emisor.ventaDividida, t.id) });
        assert.equal(r.status, 201, `${nombre}: ${JSON.stringify(r.body)}`);
        assert.equal(r.body.chagoTransactionIds.length, 2, nombre);

        const [p1, p2] = await Promise.all(r.body.chagoTransactionIds.map((id) => tx(t.id, id)));
        assert.equal(p1.subconceptId, t.ids.subconceptIds.Efectivo, nombre);
        assert.equal(p1.amount, 100, nombre);
        assert.equal(p2.subconceptId, t.ids.subconceptIds['Tarjeta Débito'], nombre);
        assert.equal(p2.amount, 50, nombre);
        assert.equal(p1.posSplitGroup, r.body.chagoTransactionId, `${nombre}: el grupo es la principal`);
        assert.equal(p2.posSplitGroup, p1.posSplitGroup, nombre);
        assert.equal(p1.posSplitParts, 2, nombre);
    }
    assert.equal(await contar(t.id, 'transacciones'), 4);
    assert.equal(await contar(t.id, 'payments'), 4);
});

test('una venta corregida en pos-deluxe (externalId con -r1) entra como venta nueva y la vieja se anula aparte', async () => {
    const t = await preparar('c-corregida');
    const original = await llamar(ventas, { headers: t.headers, body: para(DX.venta, t.id) });
    assert.equal(original.status, 201);

    // pos-deluxe corrige anulando la entrada vieja y asentando otra con otro externalId
    const anulada = await llamar(anular, {
        headers: t.headers, query: { id: original.body.chagoTransactionId },
        body: { chagoTenantId: t.id, reason: 'corregida' },
    });
    assert.equal(anulada.status, 200, JSON.stringify(anulada.body));
    const nueva = await llamar(ventas, { headers: t.headers, body: para(DX.ventaCorregida, t.id) });
    assert.equal(nueva.status, 201, JSON.stringify(nueva.body));
    assert.notEqual(nueva.body.chagoTransactionId, original.body.chagoTransactionId);

    assert.equal((await tx(t.id, original.body.chagoTransactionId)).voided, true);
    assert.equal((await tx(t.id, nueva.body.chagoTransactionId)).voided, false);
    assert.equal((await tx(t.id, nueva.body.chagoTransactionId)).amount, 120);
});

// Bug conocido de punto-de-venta (src/pages/api/sales/index.js:199): los pagos se
// normalizan contra `totalCharged` (total + propina) pero se manda `amount = total`.
// Con 2 o más líneas de pago y propina el desglose no cuadra, chago-demo contesta
// 400 y la venta se reintenta para siempre en el cron del básico.
test(
    'una venta dividida con propina de punto-de-venta debería aceptarse',
    { todo: 'punto-de-venta manda payments que suman total+propina contra amount=total (chagoSync.js)' },
    async () => {
        const t = await preparar('c-propina');
        const r = await llamar(ventas, { headers: t.headers, body: para(PDV.ventaDivididaConPropina, t.id) });
        assert.equal(r.status, 201, JSON.stringify(r.body));
    },
);

// ── Identificadores: ni colisionan entre emisores ni entre flujos ───────────

test('reenviar una venta es idempotente y los externalId de los dos emisores no se pisan', async () => {
    const t = await preparar('c-ids');
    const primera = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const repetida = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const otroEmisor = await llamar(ventas, { headers: t.headers, body: para(DX.venta, t.id) });

    assert.equal(primera.status, 201);
    assert.equal(repetida.status, 200);
    assert.equal(repetida.body.alreadyExisted, true);
    assert.equal(repetida.body.chagoTransactionId, primera.body.chagoTransactionId);
    assert.equal(otroEmisor.status, 201, 'el externalId de pos-deluxe no se confunde con el de punto-de-venta');
    assert.equal(await contar(t.id, 'transacciones'), 2);
});

test('un externalId de venta no puede reusarse como compra, ni al revés (409)', async () => {
    const t = await preparar('c-colision');
    const compra = await llamar(compras, { headers: t.headers, body: para(PDV.compra, t.id) });
    assert.equal(compra.status, 201, JSON.stringify(compra.body));
    await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });

    const compraConIdDeVenta = await llamar(compras, {
        headers: t.headers, body: para(PDV.compra, t.id, { externalId: PDV.venta.externalId }),
    });
    const ventaConIdDeCompra = await llamar(ventas, {
        headers: t.headers, body: para(PDV.venta, t.id, { externalId: PDV.compra.externalId }),
    });
    assert.equal(compraConIdDeVenta.status, 409);
    assert.equal(ventaConIdDeCompra.status, 409);
});

// ── Compras ─────────────────────────────────────────────────────────────────

test('las compras de los dos emisores cuelgan de la misma rama «Compras POS»', async () => {
    const t = await preparar('c-compras');
    const a = await llamar(compras, { headers: t.headers, body: para(PDV.compra, t.id) });
    const b = await llamar(compras, { headers: t.headers, body: para(DX.compra, t.id) });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(b.status, 201, JSON.stringify(b.body));

    const ta = await tx(t.id, a.body.chagoTransactionId);
    const tb = await tx(t.id, b.body.chagoTransactionId);
    for (const x of [ta, tb]) {
        assert.equal(x.generalId, 'pos_general_compras');
        assert.equal(x.conceptId, 'pos_compras');
        assert.equal(x.type, 'salida');
        assert.equal(x.posKind, 'compra');
        assert.equal(x.origen, 'pos_sync');
        assert.equal(x.locked, true);
    }
    assert.equal(ta.amount, 125);
    assert.equal(ta.quantity, 10);
    assert.equal(tb.amount, 120.5);
    assert.equal(tb.quantity, 2.5);
    assert.equal(tb.posUnit, 'kg');
    // La única diferencia de forma: punto-de-venta no manda unidad.
    assert.deepEqual(claves(tb).filter((k) => !claves(ta).includes(k)), ['posUnit']);
    assert.deepEqual(claves(ta).filter((k) => !claves(tb).includes(k)), []);
});

test('la compra de un producto migrado a pos-deluxe reusa el subconcepto que ya tenía en punto-de-venta', async () => {
    // `compraIdHeredado` es lo que pos-deluxe produce para un producto con
    // `products.legacy_external_id`: manda el ObjectId que el producto tenía en
    // punto-de-venta. El subconcepto de cada producto es `pos_prod_{productId}`,
    // así que mientras el id sea el mismo no se crea otro.
    assert.equal(DX.compraIdHeredado.productId, PDV.compra.productId, 'el fixture parte del mismo producto');

    const t = await preparar('c-continuidad');
    const antes = await llamar(compras, { headers: t.headers, body: para(PDV.compra, t.id) });
    assert.equal(antes.status, 201);

    const despues = await llamar(compras, { headers: t.headers, body: para(DX.compraIdHeredado, t.id) });
    assert.equal(despues.status, 201, JSON.stringify(despues.body));
    assert.equal(despues.body.subconceptId, antes.body.subconceptId);

    const porProducto = await db.collection(`tenants/${t.id}/subconcepts`)
        .where('posProductId', '==', PDV.compra.productId).get();
    assert.equal(porProducto.size, 1, 'un solo subconcepto para el producto');
    assert.equal((await tx(t.id, despues.body.chagoTransactionId)).amount, 50, '4 × 12.50');
});

test('con un id distinto, el mismo producto abre un segundo subconcepto con el mismo nombre', async () => {
    // Es lo que pasaría sin conservar el id: chago-demo identifica por id, no por nombre.
    const t = await preparar('c-duplicado');
    await llamar(compras, { headers: t.headers, body: para(PDV.compra, t.id) });
    const r = await llamar(compras, {
        headers: t.headers, body: para(DX.compra, t.id, { productName: PDV.compra.productName }),
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));

    const mismoNombre = await db.collection(`tenants/${t.id}/subconcepts`)
        .where('name', '==', PDV.compra.productName).get();
    assert.equal(mismoNombre.size, 2);
});

// ── Cambiar de emisor con el mismo token ────────────────────────────────────

test('activar desde el otro emisor con el mismo token y nombre conserva el catálogo y no crea nada nuevo', async () => {
    const t = await preparar('c-cambio', PDV);

    const r = await llamar(activate, { headers: t.headers, body: para(DX.activate, t.id) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, t.ids, 'mismos ids de General, concepto y subconceptos');
    assert.equal(await contar(t.id, 'generals'), 1);
    assert.equal(await contar(t.id, 'concepts'), 1);
    assert.equal(await contar(t.id, 'subconcepts'), 4);

    // El token NO se regeneró: el mismo sirve para ventas del emisor nuevo.
    const venta = await llamar(ventas, { headers: t.headers, body: para(DX.venta, t.id) });
    assert.equal(venta.status, 201, JSON.stringify(venta.body));
    assert.equal((await tx(t.id, venta.body.chagoTransactionId)).generalId, t.ids.generalId);
});

test('regenerar el token deja al emisor anterior en 401 al instante', async () => {
    const t = await preparar('c-token');
    const nuevo = await generatePosIntegrationToken(t.id);

    const viejo = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const vigente = await llamar(ventas, { headers: bearer(nuevo), body: para(PDV.venta, t.id) });
    assert.equal(viejo.status, 401, 'por eso la migración reusa el token en vez de regenerarlo');
    assert.equal(vigente.status, 201);
});

test('activar desde otro emisor con otro businessName no pisa el nombre que el cliente le puso al General', async () => {
    const t = await preparar('c-nombre');
    const ref = db.doc(`tenants/${t.id}/generals/${t.ids.generalId}`);
    await ref.update({ name: 'Ventas del mostrador' });

    const r = await llamar(activate, {
        headers: t.headers, body: para(DX.activate, t.id, { businessName: 'Otro Nombre' }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await ref.get()).data().name, 'Ventas del mostrador');
});

test('ni el nombre que le puso el sistema anterior: cada emisor manda su propio businessName', async () => {
    const t = await preparar('c-nombre-sistema');
    const ref = db.doc(`tenants/${t.id}/generals/${t.ids.generalId}`);
    const nombre = (await ref.get()).data().name;
    assert.equal(nombre, 'Punto de venta · Negocio Contrato · Ventas');

    const r = await llamar(activate, {
        headers: t.headers, body: para(DX.activate, t.id, { businessName: 'Otro Nombre' }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal((await ref.get()).data().name, nombre, 'el General no sigue al nombre que mande cada sistema');
});

// ── Sistema de origen: qué POS alimenta el vínculo ──────────────────────────

test('activate registra el sistema de origen y, al cambiar de emisor, conserva el anterior y la fecha', async () => {
    const t = await preparar('c-origen', PDV);
    const integracion = async () => (await db.collection('tenants').doc(t.id).get()).data().posIntegration;

    let integ = await integracion();
    assert.equal(integ.sistemaOrigen, 'punto-de-venta');
    assert.equal(integ.origenAnterior, undefined, 'el primer registro no inventa un anterior');

    // Volver a activar desde el mismo sistema no mueve nada.
    await llamar(activate, { headers: t.headers, body: para(PDV.activate, t.id) });
    integ = await integracion();
    assert.equal(integ.origenAnterior, undefined);
    assert.equal(integ.cambioDeOrigenEl, undefined);

    const r = await llamar(activate, { headers: t.headers, body: para(DX.activate, t.id) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    integ = await integracion();
    assert.equal(integ.sistemaOrigen, 'pos-deluxe');
    assert.equal(integ.origenAnterior, 'punto-de-venta');
    assert.ok(integ.cambioDeOrigenEl, 'queda la fecha del cambio');
    assert.equal(integ.generalId, t.ids.generalId, 'y el catálogo no se movió');
});

test('un sistemaOrigen desconocido se rechaza con 400 antes de escribir nada', async () => {
    const id = 'c-origen-malo';
    await db.collection('tenants').doc(id).set({ nombreEmpresa: 'Prueba Contrato' });
    const token = await generatePosIntegrationToken(id);

    const r = await llamar(activate, {
        headers: bearer(token), body: para(PDV.activate, id, { sistemaOrigen: 'otro-pos' }),
    });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /sistemaOrigen/);
    assert.equal(await contar(id, 'generals'), 0, 'ni un General a medias');
});

test('un emisor que aún no manda sistemaOrigen sigue funcionando igual y no se inventa nada', async () => {
    // Es el caso de todo tenant ya vinculado desde antes: nadie le ha vuelto a guardar el vínculo.
    const { sistemaOrigen: _omitido, ...sinOrigen } = PDV.activate;
    const t = await preparar('c-sin-origen', { activate: sinOrigen });

    const integ = (await db.collection('tenants').doc(t.id).get()).data().posIntegration;
    assert.equal(integ.sistemaOrigen, undefined);

    const v = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const c = await llamar(compras, { headers: t.headers, body: para(PDV.compra, t.id) });
    assert.equal(v.status, 201, JSON.stringify(v.body));
    assert.equal(c.status, 201, JSON.stringify(c.body));
    assert.equal((await tx(t.id, v.body.chagoTransactionId)).posSystem, undefined);
    assert.equal((await tx(t.id, c.body.chagoTransactionId)).posSystem, undefined);
});

test('cada transacción nueva lleva el sistema con el que estaba vinculado el tenant, y la anterior no cambia', async () => {
    const t = await preparar('c-sello', PDV);
    const antes = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const compraAntes = await llamar(compras, { headers: t.headers, body: para(PDV.compra, t.id) });

    await llamar(activate, { headers: t.headers, body: para(DX.activate, t.id) });
    const despues = await llamar(ventas, { headers: t.headers, body: para(DX.venta, t.id) });
    const dividida = await llamar(ventas, { headers: t.headers, body: para(DX.ventaDividida, t.id) });
    const compraDespues = await llamar(compras, { headers: t.headers, body: para(DX.compra, t.id) });

    assert.equal((await tx(t.id, antes.body.chagoTransactionId)).posSystem, 'punto-de-venta');
    assert.equal((await tx(t.id, compraAntes.body.chagoTransactionId)).posSystem, 'punto-de-venta');
    assert.equal((await tx(t.id, despues.body.chagoTransactionId)).posSystem, 'pos-deluxe');
    assert.equal((await tx(t.id, compraDespues.body.chagoTransactionId)).posSystem, 'pos-deluxe');
    for (const id of dividida.body.chagoTransactionIds) {
        assert.equal((await tx(t.id, id)).posSystem, 'pos-deluxe', 'cada parte de un pago dividido');
    }
});

test('activar sigue reparando un General con el nombre del formato anterior (sin sufijo)', async () => {
    const t = await preparar('c-legado');
    const ref = db.doc(`tenants/${t.id}/generals/${t.ids.generalId}`);
    await ref.update({ name: 'Punto de venta · Negocio Contrato' });

    const r = await llamar(activate, { headers: t.headers, body: para(PDV.activate, t.id) });
    assert.equal(r.status, 200);
    assert.equal((await ref.get()).data().name, 'Punto de venta · Negocio Contrato · Ventas');
});

// ── Anulaciones ─────────────────────────────────────────────────────────────

test('el token del negocio anula entradas de cualquier emisor, y un grupo dividido se anula completo', async () => {
    const t = await preparar('c-anula');
    const deBasico = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    const dividida = await llamar(ventas, { headers: t.headers, body: para(DX.ventaDividida, t.id) });
    const compra = await llamar(compras, { headers: t.headers, body: para(DX.compra, t.id) });

    const anularId = (id) => llamar(anular, {
        headers: t.headers, query: { id }, body: { chagoTenantId: t.id, reason: 'prueba' },
    });

    assert.equal((await anularId(deBasico.body.chagoTransactionId)).status, 200);
    // Se anula desde la parte 2, no desde la principal: cae el grupo entero.
    const parte2 = dividida.body.chagoTransactionIds[1];
    assert.equal((await anularId(parte2)).status, 200);
    assert.equal((await anularId(compra.body.chagoTransactionId)).status, 200);

    for (const id of [deBasico.body.chagoTransactionId, ...dividida.body.chagoTransactionIds, compra.body.chagoTransactionId]) {
        assert.equal((await tx(t.id, id)).voided, true, `transacción ${id}`);
        assert.equal((await pago(t.id, id)).voided, true, `pago de ${id}`);
    }

    const otraVez = await anularId(deBasico.body.chagoTransactionId);
    assert.equal(otraVez.status, 200);
    assert.equal(otraVez.body.alreadyVoided, true);
});

// ── Revocar y volver a vincular ─────────────────────────────────────────────

test('revocar y volver a activar con el MISMO nombre reencuentra el mismo catálogo', async () => {
    const t = await preparar('c-revoca-igual');
    await revokePosIntegration(t.id);
    const token = await generatePosIntegrationToken(t.id);

    const r = await llamar(activate, { headers: bearer(token), body: para(PDV.activate, t.id) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, t.ids);
    assert.equal(await contar(t.id, 'generals'), 1);
});

test('COMPORTAMIENTO ACTUAL: revocar y volver a activar con OTRO nombre parte el árbol en dos Generales', async () => {
    // No es lo deseable: por eso la migración no revoca. El historial queda
    // colgando del General viejo, bloqueado, y lo nuevo del General nuevo.
    const t = await preparar('c-revoca-otro');
    const antes = await llamar(ventas, { headers: t.headers, body: para(PDV.venta, t.id) });
    await revokePosIntegration(t.id);
    const token = await generatePosIntegrationToken(t.id);

    const r = await llamar(activate, {
        headers: bearer(token), body: para(DX.activate, t.id, { businessName: 'Nombre Distinto' }),
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.notEqual(r.body.generalId, t.ids.generalId, 'se creó un General nuevo');
    assert.equal(await contar(t.id, 'generals'), 2);

    assert.equal((await tx(t.id, antes.body.chagoTransactionId)).generalId, t.ids.generalId, 'lo viejo se queda en el General viejo');
    const despues = await llamar(ventas, {
        headers: bearer(token), body: para(DX.venta, t.id),
    });
    assert.equal(despues.status, 201, JSON.stringify(despues.body));
    assert.equal((await tx(t.id, despues.body.chagoTransactionId)).generalId, r.body.generalId, 'lo nuevo va al General nuevo');
});
