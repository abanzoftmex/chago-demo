/**
 * ════════════════════════════════════════════════════════════════════════════
 *  UNA PERSONA, VARIOS NEGOCIOS
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Un directivo que lleva varios negocios debe poder entrar a todos con el mismo
 * correo y la misma contraseña. Es lo mismo que ya se hizo en el punto de venta
 * (docs/accesos-compartidos.md allá) y se traslada con la misma regla:
 *
 *   · El acceso lo da SOLO Abanzoft, desde la consola de superadmin. Un
 *     administrador de negocio no puede dárselo a nadie ni quitárselo a nadie.
 *   · La persona entra con su cuenta y, si tiene más de un negocio, salta de uno
 *     a otro desde el menú de usuario.
 *
 * ── Qué ya tenía E/S y qué faltaba ──────────────────────────────────────────
 *
 * El modelo ya admitía varios negocios por persona: la membresía vive en
 * `tenants/{id}/members/{uid}`, una por negocio y cada una con su rol, y las
 * reglas y `requireTenantMember` ya validan POR NEGOCIO. No hizo falta tocar el
 * modelo. Lo que faltaba era elegir negocio al entrar y, sobre todo, proteger la
 * cuenta: varias rutas actúan sobre la CUENTA entera (borrarla, deshabilitarla,
 * cambiar correo o contraseña), así que un administrador de un negocio podía
 * dejar sin acceso a la persona en todos los demás.
 *
 * ── La verdad está en `members`, no en `users.tenantIds` ────────────────────
 *
 * `users.tenantIds` solo se escribía y nunca se mantenía al quitar a alguien (en
 * producción, 2 de los 6 documentos que lo traen no coinciden con sus membresías
 * reales). Aquí todo se calcula leyendo `members`; `tenantIds` se sigue
 * actualizando por compatibilidad pero nadie decide nada con él.
 *
 * El campo `users.accesoCompartido` SÍ lo lee el navegador, pero solo como
 * interruptor: las cuentas que no lo tienen —casi todas— no hacen nada distinto.
 */

import admin from "../firebase/firebaseAdmin";
import { logAccesoCompartido } from "./logServer";

export const ROLES_DE_TENANT = ["admin", "contador", "viewer"];
export const CODIGO_ACCESO_COMPARTIDO = "ACCESO_COMPARTIDO";
export const MENSAJE_ACCESO_COMPARTIDO =
  "Es un acceso compartido: lo administra Abanzoft, no el negocio.";
export const MENSAJE_CUENTA_COMPARTIDA =
  "Esta cuenta tiene acceso a varios negocios: esa acción la hace Abanzoft, no un negocio.";

const LOTE_DE_LECTURA = 300;
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const firestore = () => admin.firestore();
const FieldValue = () => admin.firestore.FieldValue;

const fallo = (status, codigo, mensaje, extra = {}) => ({ ok: false, status, codigo, mensaje, ...extra });

// ── Lectura ─────────────────────────────────────────────────────────────────

/**
 * Todas las membresías de una cuenta, leídas de `members`.
 *
 * Una sola ronda por lotes —lista los negocios sin leerlos y pide el documento de
 * esta persona en cada uno—: con decenas de negocios es una lectura barata y no
 * necesita un campo extra ni un índice de grupo de colecciones.
 */
export async function membresiasDe(uid) {
  const negocios = await firestore().collection("tenants").listDocuments();
  const encontradas = [];

  for (let i = 0; i < negocios.length; i += LOTE_DE_LECTURA) {
    const refs = negocios.slice(i, i + LOTE_DE_LECTURA).map((n) => n.collection("members").doc(uid));
    if (refs.length === 0) continue;
    for (const snap of await firestore().getAll(...refs)) {
      if (snap.exists) encontradas.push({ tenantId: snap.ref.parent.parent.id, ...snap.data() });
    }
  }
  return encontradas;
}

export const esAccesoCompartido = (membresia) => Boolean(membresia?.vinculadoPor);
export const soloActivas = (membresias) => membresias.filter((m) => m.status === "active");

/** Una cuenta es compartida si entra a más de un negocio o si algún acceso lo dio Abanzoft. */
export function esCuentaCompartida(membresias) {
  const activas = soloActivas(membresias);
  return activas.length > 1 || activas.some(esAccesoCompartido);
}

/**
 * Lo que una ruta de administración de un negocio necesita saber de la persona a
 * la que va a tocar: si está en ESTE negocio, si su acceso aquí lo dio Abanzoft, y
 * si su cuenta alcanza a otros negocios.
 */
export async function estadoDeCuenta(uid, tenantId) {
  const membresias = await membresiasDe(uid);
  const aqui = membresias.find((m) => m.tenantId === tenantId) || null;
  return {
    aqui,
    vinculadoAqui: esAccesoCompartido(aqui),
    compartida: esCuentaCompartida(membresias),
    otrosNegocios: soloActivas(membresias).filter((m) => m.tenantId !== tenantId).length,
  };
}

// ── Quién pregunta ──────────────────────────────────────────────────────────

/**
 * El token es de un ADMINISTRADOR ACTIVO de este negocio.
 *
 * Reemplaza una comprobación que tenía un atajo: si el negocio tenía un solo
 * miembro ("el master") se saltaba el permiso por completo, sin mirar siquiera
 * si quien preguntaba era ese miembro. 22 de los 24 negocios tienen un solo
 * miembro, así que cualquier cuenta autenticada podía gestionar usuarios de
 * ellos con solo mandar su `tenantId`. Aquí no hay atajo: se es administrador
 * activo de ESE negocio o no se pasa.
 */
export async function verificarAdminDeTenant(token, tenantId) {
  if (!token) return fallo(401, "SIN_TOKEN", "Token de autenticación requerido");
  if (!tenantId || typeof tenantId !== "string") return fallo(400, "SIN_TENANT", "ID de tenant requerido");

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(token);
  } catch {
    return fallo(401, "TOKEN_INVALIDO", "Token inválido");
  }

  const miembro = await firestore().collection(`tenants/${tenantId}/members`).doc(decoded.uid).get();
  if (!miembro.exists || miembro.data().status !== "active") {
    return fallo(403, "NO_ES_MIEMBRO", "No eres miembro de este tenant");
  }
  if (miembro.data().role !== "admin") {
    return fallo(403, "NO_ES_ADMIN", "Solo los administradores pueden gestionar usuarios");
  }
  return { ok: true, uid: decoded.uid, decoded, miembro: miembro.data() };
}

// ── Escritura ───────────────────────────────────────────────────────────────

/**
 * De las membresías que quedan, la que debe ser el negocio "de casa" de la cuenta
 * (`users.tenantId`, que es a donde entra cuando nadie ha elegido otro): primero
 * uno PROPIO —que no lo haya dado Abanzoft—, y después el más antiguo.
 */
export function elegirNegocioDeCasa(membresias) {
  const alta = (m) => {
    const t = m.joinedAt?.toMillis?.() ?? m.vinculadoAt?.toMillis?.() ?? 0;
    return t;
  };
  return [...membresias].sort(
    (a, b) =>
      Number(esAccesoCompartido(a)) - Number(esAccesoCompartido(b)) ||
      alta(a) - alta(b) ||
      String(a.tenantId).localeCompare(String(b.tenantId))
  )[0]?.tenantId ?? null;
}

/** Quita a la persona de UN negocio sin tocar su cuenta, y deja `users` coherente con lo que queda. */
export async function quitarDeTenant(tenantId, uid) {
  await firestore().collection(`tenants/${tenantId}/members`).doc(uid).delete();

  const restantes = soloActivas(await membresiasDe(uid));
  const refUsuario = firestore().collection("users").doc(uid);
  const usuario = await refUsuario.get();
  if (!usuario.exists) return { restantes };

  const cambios = {
    accesoCompartido: esCuentaCompartida(restantes),
    tenantIds: FieldValue().arrayRemove(tenantId),
    updatedAt: FieldValue().serverTimestamp(),
  };
  // Si el negocio que se quita era a donde entraba por defecto, pasa a otro de los suyos.
  if (String(usuario.data().tenantId) === String(tenantId)) {
    cambios.tenantId = elegirNegocioDeCasa(restantes);
  }
  await refUsuario.set(cambios, { merge: true });
  return { restantes };
}

/**
 * Da a una persona acceso a un negocio. Solo la consola de superadmin llama aquí.
 * Si el correo no tiene cuenta, la crea (hace falta contraseña).
 */
export async function darAcceso({ tenantId, email, password, displayName, role = "admin", operador = "Abanzoft" }) {
  const correo = String(email || "").trim().toLowerCase();
  if (!CORREO.test(correo)) return fallo(400, "CORREO_INVALIDO", "Escribe un correo válido");
  if (!ROLES_DE_TENANT.includes(role)) return fallo(400, "ROL_INVALIDO", "Rol inválido");

  const refTenant = firestore().collection("tenants").doc(tenantId);
  if (!(await refTenant.get()).exists) return fallo(404, "TENANT_NO_ENCONTRADO", "Negocio no encontrado");

  let cuenta;
  let cuentaNueva = false;
  try {
    cuenta = await admin.auth().getUserByEmail(correo);
    if (cuenta.disabled) return fallo(409, "CUENTA_DESHABILITADA", "Esa cuenta está deshabilitada");
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    if (!password) return fallo(400, "CLAVE_REQUERIDA", "Ese correo no tiene cuenta: escribe una contraseña para crearla");
    if (String(password).length < 6) return fallo(400, "CLAVE_CORTA", "La contraseña debe tener al menos 6 caracteres");
    cuenta = await admin.auth().createUser({
      email: correo,
      password,
      displayName: displayName || correo.split("@")[0],
      emailVerified: false,
    });
    cuentaNueva = true;
  }

  try {
    const refMiembro = refTenant.collection("members").doc(cuenta.uid);
    const existente = await refMiembro.get();
    if (existente.exists) {
      return existente.data().vinculadoPor
        ? fallo(409, "YA_TIENE_ACCESO", "Esa persona ya tiene acceso compartido a este negocio")
        : fallo(409, "YA_ES_MIEMBRO", "Esa persona ya es usuario de este negocio");
    }

    const previas = soloActivas(await membresiasDe(cuenta.uid));
    const refUsuario = firestore().collection("users").doc(cuenta.uid);
    const usuario = await refUsuario.get();
    const datos = usuario.exists ? usuario.data() : {};
    const nombre = datos.displayName || displayName || cuenta.displayName || correo.split("@")[0];
    // El negocio de casa no se pisa si sigue siendo válido; si la cuenta no tiene
    // ninguno (o apunta a un negocio donde ya no es miembro), es este.
    const casaValida = previas.some((m) => m.tenantId === String(datos.tenantId));

    const lote = firestore().batch();
    lote.set(refMiembro, {
      email: correo,
      displayName: nombre,
      role,
      status: "active",
      joinedAt: FieldValue().serverTimestamp(),
      vinculadoPor: "superadmin",
      vinculadoAt: FieldValue().serverTimestamp(),
    });
    lote.set(
      refUsuario,
      {
        email: correo,
        displayName: nombre,
        accesoCompartido: true,
        tenantIds: FieldValue().arrayUnion(tenantId),
        tenantId: casaValida ? datos.tenantId : tenantId,
        createdAt: datos.createdAt || FieldValue().serverTimestamp(),
        updatedAt: FieldValue().serverTimestamp(),
      },
      { merge: true }
    );
    await lote.commit();

    await logAccesoCompartido({
      tenantId,
      accion: "grant",
      userId: cuenta.uid,
      userData: { displayName: nombre, email: correo, role },
      operador,
    });
    return { ok: true, userId: cuenta.uid, cuentaNueva, otrosNegocios: previas.length };
  } catch (error) {
    // Una cuenta que se acaba de crear y se quedó sin acceso a nada es justo el
    // estado que no debe existir (ver `quitarAcceso`): se deshace.
    if (cuentaNueva) await admin.auth().deleteUser(cuenta.uid).catch(() => {});
    throw error;
  }
}

/**
 * Quita un acceso compartido. Solo toca el vínculo con ESE negocio: la cuenta y
 * los demás negocios de la persona siguen igual.
 *
 * No deja una cuenta sin ningún negocio: sin membresía, `AuthContext` la tomaría
 * por un usuario del sistema anterior (rol "visor") en vez de cerrarle el paso.
 * Si era el último, pide dar de baja la cuenta (`eliminarCuenta`).
 */
export async function quitarAcceso({ tenantId, userId, eliminarCuenta = false, operador = "Abanzoft" }) {
  const refMiembro = firestore().collection(`tenants/${tenantId}/members`).doc(userId);
  const miembro = await refMiembro.get();
  if (!miembro.exists) return fallo(404, "NO_ENCONTRADO", "Esa persona no tiene acceso a este negocio");
  if (!miembro.data().vinculadoPor) {
    return fallo(409, "NO_ES_COMPARTIDO", "Es un usuario del propio negocio: se administra desde Usuarios");
  }

  const datos = miembro.data();
  const restantes = soloActivas(await membresiasDe(userId)).filter((m) => m.tenantId !== tenantId);

  if (restantes.length === 0 && !eliminarCuenta) {
    return fallo(409, "ULTIMO_NEGOCIO", "Es su último negocio: hay que dar de baja la cuenta", { requiereBaja: true });
  }

  if (restantes.length === 0) {
    await refMiembro.delete();
    await admin.auth().deleteUser(userId).catch((e) => {
      if (e.code !== "auth/user-not-found") throw e;
    });
    await firestore().collection("users").doc(userId).delete().catch(() => {});
  } else {
    await quitarDeTenant(tenantId, userId);
  }

  await logAccesoCompartido({
    tenantId,
    accion: "revoke",
    userId,
    userData: { displayName: datos.displayName, email: datos.email, role: datos.role },
    operador,
  });
  return { ok: true, cuentaEliminada: restantes.length === 0 };
}

/** Los accesos compartidos de un negocio, con a cuántos otros negocios llega cada persona. */
export async function listarAccesos(tenantId) {
  const miembros = await firestore().collection(`tenants/${tenantId}/members`).get();
  const accesos = [];
  for (const doc of miembros.docs.filter((d) => d.data().vinculadoPor)) {
    const otras = soloActivas(await membresiasDe(doc.id)).filter((m) => m.tenantId !== tenantId);
    const d = doc.data();
    accesos.push({
      userId: doc.id,
      email: d.email || null,
      displayName: d.displayName || null,
      role: d.role,
      status: d.status,
      vinculadoAt: d.vinculadoAt?.toDate?.()?.toISOString() || null,
      otrosNegocios: otras.length,
    });
  }
  return accesos;
}
