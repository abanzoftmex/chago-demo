/**
 * Superadmin · Vínculo con punto-de-venta de un tenant.
 *
 * GET  ?tenantId=...            -> estado actual (nunca el token, solo si existe)
 * POST { tenantId, action }     -> 'generate' | 'disable' | 'enable' | 'revoke'
 *
 * Protegido igual que el resto de rutas de superadmin: la cookie de sesión
 * de configuración (`verifySetupSessionCookie`), no un login de usuario
 * normal del tenant.
 */

import { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";
import {
  getPosIntegration,
  generatePosIntegrationToken,
  setPosIntegrationEnabled,
  revokePosIntegration,
} from "../../../lib/server/posIntegrationService";

const toIso = (timestamp) => timestamp?.toDate?.()?.toISOString() || null;

export default async function handler(req, res) {
  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;
  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  if (req.method === "GET") {
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== "string") {
      return res.status(400).json({ message: "El tenant es requerido" });
    }
    try {
      const integration = await getPosIntegration(tenantId);
      return res.status(200).json({
        enabled: !!integration?.enabled,
        hasToken: !!integration?.tokenHash,
        conceptId: integration?.conceptId || null,
        linkedAt: toIso(integration?.linkedAt),
        updatedAt: toIso(integration?.updatedAt),
      });
    } catch (error) {
      console.error("❌ Error leyendo pos-integration:", error);
      return res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }

  if (req.method === "POST") {
    const { tenantId, action } = req.body || {};
    if (!tenantId || typeof tenantId !== "string") {
      return res.status(400).json({ message: "El tenant es requerido" });
    }

    try {
      if (action === "generate") {
        // Genera SIEMPRE un token nuevo — regenerar invalida el anterior de
        // inmediato (no hay forma de tener dos tokens vivos a la vez), así
        // que hay que volver a pegarlo en Torre de Control tras esto.
        const token = await generatePosIntegrationToken(tenantId);
        return res.status(200).json({ token });
      }
      if (action === "disable") {
        await setPosIntegrationEnabled(tenantId, false);
        return res.status(200).json({ ok: true });
      }
      if (action === "enable") {
        const integration = await getPosIntegration(tenantId);
        if (!integration?.tokenHash) {
          return res.status(400).json({ message: "Genera un token antes de activar el vínculo" });
        }
        await setPosIntegrationEnabled(tenantId, true);
        return res.status(200).json({ ok: true });
      }
      if (action === "revoke") {
        await revokePosIntegration(tenantId);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ message: "Acción no reconocida" });
    } catch (error) {
      console.error("❌ Error en pos-integration:", error);
      return res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }

  return res.status(405).json({ message: "Método no permitido" });
}
