/**
 * /api/admin/shared-access — accesos compartidos de un negocio (consola de superadmin)
 *
 *   GET    ?tenantId=...                          → los accesos compartidos del negocio
 *   POST   { tenantId, email, password?, displayName?, role? }  → da acceso
 *   DELETE { tenantId, userId, eliminarCuenta? }  → quita el acceso
 *
 * Solo la consola de superadmin: la protege la misma cookie de sesión de
 * configuración que el resto de rutas de superadmin. Un administrador de negocio
 * NO llega aquí, a propósito — un acceso compartido es una persona de afuera que
 * ve los datos de este negocio, y quien decide eso no puede ser el propio negocio.
 *
 * La lógica vive en `lib/server/accesoCompartido.js`; esto solo traduce HTTP.
 */

import { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";
import { darAcceso, quitarAcceso, listarAccesos } from "../../../lib/server/accesoCompartido";

const responder = (res, resultado, exito = 200) =>
  resultado.ok
    ? res.status(exito).json(resultado)
    : res.status(resultado.status).json({
        message: resultado.mensaje,
        codigo: resultado.codigo,
        ...(resultado.requiereBaja && { requiereBaja: true }),
      });

export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ message: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const secreto = process.env.TENANT_SETUP_PASSWORD;
  if (!secreto || !verifySetupSessionCookie(req.headers.cookie, secreto)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  const origen = req.method === "GET" ? req.query : req.body || {};
  const tenantId = typeof origen.tenantId === "string" ? origen.tenantId.trim() : "";
  if (!tenantId) return res.status(400).json({ message: "tenantId es requerido" });

  try {
    if (req.method === "GET") {
      return res.status(200).json({ accesos: await listarAccesos(tenantId) });
    }

    if (req.method === "POST") {
      const { email, password, displayName, role } = origen;
      return responder(res, await darAcceso({ tenantId, email, password, displayName, role: role || "admin" }), 201);
    }

    const { userId, eliminarCuenta } = origen;
    if (!userId) return res.status(400).json({ message: "userId es requerido" });
    return responder(res, await quitarAcceso({ tenantId, userId, eliminarCuenta: eliminarCuenta === true }));
  } catch (error) {
    console.error("Error en shared-access:", error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}
