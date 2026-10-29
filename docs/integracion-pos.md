# Integración con punto de venta

Dos sistemas mandan ventas y compras a chago-demo: **punto-de-venta** (el básico) y **POS Deluxe**. chago-demo no distingue quién le habla: autentica por el token del negocio, no por el sistema. Las rutas y el código están en `src/pages/api/integrations/` y `src/lib/server/` (`posIntegrationService`, `posCatalog`, `posTransactionWriter`).

## Qué recibe

Todas son `POST` con `Authorization: Bearer <token>` y `chagoTenantId` en el cuerpo.

| Ruta | Qué hace |
|---|---|
| `/api/integrations/activate` | Crea o repara la rama de catálogo de Ventas. Idempotente. |
| `/api/integrations/pos-transactions` | Venta cobrada → Entrada. Con pago dividido, una transacción por método. |
| `/api/integrations/pos-purchases` | Surtido con costo → Salida. Cantidad hasta 4 decimales. |
| `/api/integrations/pos-transactions/[id]/void` | Anula una venta o compra (nunca borra). |

Idempotencia por `externalId` dentro del tenant. Un `externalId` de venta no puede usarse como compra, ni al revés (409).

## Token

Lo emite chago-demo desde Superadmin → tenant → Punto de venta. Solo se guarda su hash. **Hay un solo token vivo por negocio:** regenerarlo invalida el anterior al instante, y el sistema que lo usaba recibe 401.

## Catálogo

```
Punto de venta · {negocio} · Ventas   > Ventas POS   > Efectivo | Tarjeta Débito | Tarjeta Crédito | Transferencia
Punto de venta · {negocio} · Compras  > Compras POS  > un subconcepto por producto (pos_prod_{productId})
```

Todo nace `locked` con `origen:'pos_sync'`. El cliente solo puede renombrarlo. El `productId` es el que manda el sistema de origen: si dos sistemas usan ids distintos para el mismo producto, aparecen dos subconceptos con el mismo nombre.

`activate` **no renombra** un General que ya existe, salvo el nombre del formato anterior (`Punto de venta · {negocio}` sin sufijo). Un nombre que el cliente eligió, o que puso el otro sistema, se respeta.

## Sistema de origen

`activate` acepta `sistemaOrigen` (`punto-de-venta` o `pos-deluxe`). Es opcional: un emisor que no lo manda funciona igual que siempre.

- `tenants/{id}.posIntegration.sistemaOrigen` dice qué sistema alimenta el vínculo. Si cambia, se conservan `origenAnterior` y `cambioDeOrigenEl`. Se ve en la tarjeta de Superadmin.
- Cada transacción **nueva** lleva `posSystem` con el sistema vigente al llegar. Las anteriores, y las de un tenant cuyo emisor aún no lo manda, no lo llevan: no se inventa.

## Un solo sistema a la vez

`pos-transactions` y `pos-purchases` aceptan `sistemaOrigen` en el cuerpo. pos-deluxe siempre lo manda; punto-de-venta todavía no.

| Sistema vigente del negocio | Envío que dice `punto-de-venta` | Envío que dice `pos-deluxe` | Envío sin `sistemaOrigen` |
|---|---|---|---|
| ninguno (todo negocio anterior) | se acepta | se acepta | se acepta |
| `punto-de-venta` | se acepta | **409** | se acepta |
| `pos-deluxe` | **409** | se acepta | **409** |

El rechazo es `409` con `codigo: "ORIGEN_NO_VIGENTE"` y no escribe nada. Así, cuando un negocio pasa a deluxe, un envío tardío del básico no puede duplicar una venta aunque el corte se haga en otro orden. Volver al básico es volver a guardar su vínculo (su `activate` deja el sistema en `punto-de-venta`). Anular (`/void`) no se restringe: una entrada vieja se puede seguir anulando.

## Cambiar un negocio de un sistema a otro

1. **No revocar.** Revocar borra los ids del catálogo; al volver a vincular con otro nombre se parte el historial en dos Generales y lo viejo queda bloqueado en el General anterior.
2. **Reutilizar el mismo token.** Regenerarlo deja al sistema viejo en 401 y atora lo que tuviera pendiente.
3. Dejar sin pendientes la cola del sistema viejo, apagar su vínculo y solo entonces encender el del nuevo. Con los dos enviando a la vez, una venta se registra dos veces.
4. Activar desde el nuevo sistema (con `sistemaOrigen`). El catálogo, y con él los ids, se conserva.

El historial ya registrado no se toca. No hay forma de desbloquear una entrada del POS desde chago-demo.

## Pruebas

- `npm run test:contrato` ejecuta los handlers reales contra el emulador con los payloads de los dos sistemas (`tests/integracion/fixtures/contrato-*.json`). Los casos `todo` describen defectos conocidos.
- Cada emisor tiene su prueba de deriva (`tests/chago-contrato.*`), que falla si su código deja de producir exactamente su fixture. Buscan este repo junto al suyo, o en `CHAGO_DEMO_DIR`.
