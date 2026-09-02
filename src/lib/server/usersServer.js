/**
 * Escrituras sobre `/users` desde el SERVIDOR, con Admin SDK.
 *
 * `firestore.rules` deja que cada usuario lea y actualice SOLO su propio
 * documento, y prohíbe borrarlo a todos. Es lo correcto: nadie debería poder
 * cambiarle el rol a otro desde el navegador. La consecuencia es que dar de
 * alta a alguien, cambiarle el rol o desactivarlo tiene que pasar por una ruta
 * de API, que es donde ya se verifica quién lo está pidiendo.
 *
 * El Admin SDK no pasa por las reglas, así que la puerta la pone la ruta.
 */

import admin from "../firebase/firebaseAdmin";

/**
 * Fija el rol de un usuario y, de paso, los datos de perfil que se le pasen.
 *
 * Devuelve `{ success, error? }` en vez de lanzar, igual que el
 * `setUserRole` del navegador al que sustituye: sus llamadores comprueban el
 * resultado en lugar de envolver en try/catch.
 */
export async function setUserRole(userId, role, userInfo = {}) {
  try {
    await admin
      .firestore()
      .collection("users")
      .doc(userId)
      .set({ role, updatedAt: new Date(), ...userInfo }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("[usersServer] Error estableciendo rol del usuario:", error);
    return { success: false, error: error.message };
  }
}
