import { Resend } from "resend";

// We expect NEXT_PUBLIC_RESEND_API_KEY or RESEND_API_KEY set in the environment
const apiKey =
  process.env.RESEND_API_KEY || process.env.NEXT_PUBLIC_RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!resend) {
    return res
      .status(500)
      .json({ error: "Falta configurar la API Key de Resend" });
  }

  const { to, subject, html } = req.body || {};

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Parámetros inválidos" });
  }

  try {
    const from = "Chago Notificaciones <noreply@email.jhernandez.mx>";
    const result = await resend.emails.send({ from, to, subject, html });
    return res.status(200).json({ success: true, id: result?.id || null });
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ error: "Error al enviar el correo" });
  }
}
