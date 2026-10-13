/**
 * Los negocios de la persona que entró, y a cuál entra.
 *
 * Solo las cuentas marcadas como compartidas (`users.accesoCompartido`) hacen
 * algo distinto: preguntan al servidor a qué negocios entran. Todas las demás —casi
 * todas— salen de aquí con su negocio de siempre, sin una llamada extra y sin
 * ningún cambio en cómo cargan.
 *
 * Y si algo falla al preguntar (sin red, el servidor responde mal), se entra al
 * negocio de casa en vez de dejar a la persona fuera: el selector es una comodidad
 * encima de un acceso que ya funcionaba.
 */

import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { elegirNegocio, leerNegocioGuardado } from "../negocioActivo";

/** `true` si la cuenta entra a más de un negocio, según la marca que pone el servidor. */
async function esCuentaCompartida(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() && snap.data().accesoCompartido === true;
  } catch {
    return false;
  }
}

/**
 * @param {import("firebase/auth").User} user
 * @param {string} propio  el negocio de casa (`users.tenantId`), el de siempre
 * @returns {Promise<{ tenantId: string, negocios: Array|null }>}
 *   `negocios` es `null` si la cuenta no es compartida: no hay nada que elegir.
 */
export async function resolverNegocioActivo(user, propio) {
  if (!(await esCuentaCompartida(user.uid))) return { tenantId: propio, negocios: null };

  try {
    const respuesta = await fetch("/api/me/tenants", {
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    });
    if (!respuesta.ok) throw new Error(`/api/me/tenants respondió ${respuesta.status}`);

    const { tenants } = await respuesta.json();
    if (!Array.isArray(tenants) || tenants.length === 0) return { tenantId: propio, negocios: null };

    const almacen = typeof window !== "undefined" ? window.localStorage : null;
    const tenantId = elegirNegocio(tenants, { guardado: leerNegocioGuardado(almacen, user.uid), propio });
    return { tenantId: tenantId || propio, negocios: tenants };
  } catch (error) {
    console.error("No se pudo cargar la lista de negocios; se entra al negocio de casa:", error);
    return { tenantId: propio, negocios: null };
  }
}
