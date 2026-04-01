import {
  createSetupSessionCookie,
  setupSessionDurationMs,
} from "../../../lib/server/setupSession";

/**
 * API para verificar la contraseña maestra del setup de tenants
 * POST /api/admin/verify-setup-password
 * Body: { password: string }
 * Response: { authorized: boolean }
 */

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Contraseña requerida" });
  }

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;

  if (!setupPassword) {
    console.error("❌ TENANT_SETUP_PASSWORD no está configurada en .env.local");
    return res.status(500).json({ 
      message: "Error de configuración del servidor. TENANT_SETUP_PASSWORD no está definida." 
    });
  }

  if (password === setupPassword) {
    res.setHeader("Set-Cookie", createSetupSessionCookie(setupPassword));
    return res.status(200).json({
      authorized: true,
      expiresInMs: setupSessionDurationMs,
    });
  }

  return res.status(401).json({ 
    authorized: false, 
    message: "Contraseña incorrecta" 
  });
}
