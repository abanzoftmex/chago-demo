/**
 * El negocio en el que trabaja ahora una persona que entra a varios.
 *
 * Sin dependencias de React, de Firebase ni del navegador a propósito: así se
 * prueba con `node --test`, igual que el resto de la lógica que decide cosas.
 *
 * ── Qué decide y qué NO decide ──────────────────────────────────────────────
 *
 * Esto solo ELIGE entre los negocios que el servidor ya dijo que la persona
 * tiene (`/api/me/tenants`). No concede nada: si alguien escribe a mano otro id
 * en `localStorage`, `elegirNegocio` lo ignora porque no está en la lista, y
 * aunque lo usara, las reglas de Firestore y `requireTenantMember` miran la
 * membresía de ESE negocio en cada petición.
 *
 * ── Por qué en el navegador y no en `users.tenantId` ────────────────────────
 *
 * Las reglas impiden que una persona cambie su propio `users.tenantId`, y es lo
 * correcto: ese campo es su negocio "de casa" y lo escribe el servidor. El
 * negocio ACTIVO es una preferencia de este navegador, como en el punto de venta.
 */

const PREFIJO = "es:negocio-activo:";

/** La clave de `localStorage` es POR CUENTA: quien use el equipo después no hereda el negocio. */
export const claveNegocioActivo = (uid) => `${PREFIJO}${uid}`;

const esTexto = (valor) => typeof valor === "string" && valor.trim() !== "";

/**
 * De los negocios de la persona, a cuál entra.
 *
 *   1. el último que usó en este navegador, si todavía le sirve
 *   2. su negocio de casa (`users.tenantId`), si le sirve
 *   3. el primero de la lista, para que nunca se quede sin ninguno
 *
 * Devuelve `null` solo si no tiene negocios (el llamador entonces no cambia nada).
 */
export function elegirNegocio(negocios, { guardado = null, propio = null } = {}) {
  const ids = (negocios || []).map((n) => String(n?.id)).filter((id) => id && id !== "undefined");
  if (esTexto(guardado) && ids.includes(String(guardado))) return String(guardado);
  if (esTexto(propio) && ids.includes(String(propio))) return String(propio);
  return ids[0] ?? null;
}

/** Lo que recordó este navegador, o `null`. Nunca lanza: `localStorage` puede no existir o estar bloqueado. */
export function leerNegocioGuardado(almacen, uid) {
  try {
    const valor = almacen?.getItem?.(claveNegocioActivo(uid));
    return esTexto(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** `true` solo si de verdad se guardó: sin almacenamiento (o bloqueado) devuelve `false`. */
export function guardarNegocio(almacen, uid, tenantId) {
  try {
    if (typeof almacen?.setItem !== "function") return false;
    almacen.setItem(claveNegocioActivo(uid), String(tenantId));
    return true;
  } catch {
    return false;
  }
}

/**
 * ¿Este evento `storage` es un cambio de negocio de ESTA cuenta, hecho en otra
 * pestaña? Si sí, esta pestaña tiene que recargar: dos pestañas de la misma cuenta
 * en negocios distintos acabarían escribiendo datos de uno en la pantalla del otro.
 */
export function esCambioDeNegocioAjeno(evento, uid) {
  return (
    Boolean(evento) &&
    evento.key === claveNegocioActivo(uid) &&
    evento.newValue !== evento.oldValue &&
    esTexto(evento.newValue)
  );
}
