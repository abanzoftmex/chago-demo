import {
  clearSetupSessionCookie,
  setupSessionDurationMs,
  verifySetupSessionCookie,
} from "../../../lib/server/setupSession";

export default function handler(req, res) {
  const setupPassword = process.env.TENANT_SETUP_PASSWORD;

  if (!setupPassword) {
    return res.status(500).json({
      authorized: false,
      message: "TENANT_SETUP_PASSWORD no está configurada.",
    });
  }

  if (req.method === "GET") {
    const authorized = verifySetupSessionCookie(req.headers.cookie, setupPassword);
    return res.status(200).json({
      authorized,
      expiresInMs: authorized ? setupSessionDurationMs : 0,
    });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSetupSessionCookie());
    return res.status(200).json({ authorized: false });
  }

  return res.status(405).json({ message: "Método no permitido" });
}
