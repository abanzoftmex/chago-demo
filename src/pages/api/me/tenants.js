/**
 * GET /api/me/tenants
 *
 * Los negocios a los que entra la persona que pregunta, para el selector del menú
 * de usuario. Solo lo consultan las cuentas marcadas como compartidas
 * (`users.accesoCompartido`): el resto de la gente no pasa por aquí.
 *
 * La lista sale de las membresías reales, nunca de `users.tenantIds`. Y no
 * concede nada: es solo el catálogo de lo que el navegador puede elegir. Lo que se
 * puede hacer en cada negocio lo siguen decidiendo las reglas de Firestore y
 * `requireTenantMember`, que miran la membresía de ESE negocio en cada petición.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { membresiasDe, soloActivas, esAccesoCompartido } from "../../../lib/server/accesoCompartido";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ message: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const cabecera = req.headers.authorization || "";
  if (!cabecera.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token de autenticación requerido" });
  }

  let quien;
  try {
    quien = await admin.auth().verifyIdToken(cabecera.slice("Bearer ".length).trim());
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }

  try {
    const db = admin.firestore();
    const membresias = soloActivas(await membresiasDe(quien.uid));

    const negocios = membresias.length
      ? await db.getAll(...membresias.map((m) => db.collection("tenants").doc(m.tenantId)))
      : [];
    const nombres = new Map(negocios.map((n) => [n.id, n.exists ? n.data().nombreEmpresa : null]));

    const tenants = membresias
      .map((m) => ({
        id: m.tenantId,
        nombre: nombres.get(m.tenantId) || "Sin nombre",
        role: m.role,
        compartido: esAccesoCompartido(m),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    const usuario = await db.collection("users").doc(quien.uid).get();
    return res.status(200).json({ tenants, home: usuario.exists ? usuario.data().tenantId || null : null });
  } catch (error) {
    console.error("Error en /api/me/tenants:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}
