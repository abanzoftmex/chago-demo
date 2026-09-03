/**
 * POST /api/admin/create-tenant
 *
 * Da de alta un tenant nuevo con su usuario administrador: la cuenta en
 * Firebase Auth, el documento del tenant, el miembro admin y el perfil.
 *
 * Antes lo hacía el navegador (`migrationHelper.createNewTenant`), y de una
 * forma que no puede sobrevivir a las reglas: creaba la cuenta con
 * `createUserWithEmailAndPassword` —que además deja la sesión iniciada COMO EL
 * USUARIO NUEVO—, llamaba a `signOut` para no desplazar al superadmin, y
 * escribía en Firestore ya sin sesión. O sea, como anónimo. Funcionaba solo
 * porque las reglas publicadas están abiertas.
 *
 * Con Admin SDK nada de eso hace falta: se crea la cuenta sin tocar la sesión
 * de quien está usando el navegador, y las escrituras van con credenciales de
 * servidor.
 *
 * La puerta es la cookie de configuración, como el resto de rutas de
 * superadmin — que es quien da de alta tenants.
 */

import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: `Método ${req.method} no permitido` });
  }

  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;
  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ success: false, error: "Sesión de configuración expirada o inválida" });
  }

  const { ownerEmail, ownerPassword, ownerName, nombreEmpresa } = req.body || {};
  if (!ownerEmail || !ownerPassword || !nombreEmpresa) {
    return res.status(400).json({
      success: false,
      error: "ownerEmail, ownerPassword y nombreEmpresa son requeridos",
    });
  }

  const displayName = String(ownerName || "").trim() || ownerEmail;

  let userRecord;
  try {
    userRecord = await admin.auth().createUser({
      email: ownerEmail,
      password: ownerPassword,
      displayName,
    });
  } catch (error) {
    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({
        success: false,
        error: `El email ${ownerEmail} ya está en uso. Usa otro email.`,
      });
    }
    console.error("Error creando la cuenta del administrador:", error);
    return res.status(500).json({ success: false, error: error.message });
  }

  const tenantId = randomUUID();

  try {
    const db = admin.firestore();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    // Los tres documentos van en un solo lote: un tenant a medias —creado pero
    // sin miembro admin— dejaría al usuario sin poder entrar a lo suyo.
    batch.set(db.collection("tenants").doc(tenantId), {
      nombreEmpresa,
      ownerUid: userRecord.uid,
      createdAt: now,
    });

    batch.set(db.collection(`tenants/${tenantId}/members`).doc(userRecord.uid), {
      email: ownerEmail,
      displayName,
      role: "admin",
      status: "active",
      createdAt: now,
    });

    batch.set(
      db.collection("users").doc(userRecord.uid),
      {
        uid: userRecord.uid,
        tenantId,
        email: ownerEmail,
        displayName,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    await batch.commit();

    return res.status(201).json({
      success: true,
      tenantId,
      user: { uid: userRecord.uid, email: ownerEmail, displayName },
      nombreEmpresa,
      message: "Tenant creado exitosamente",
    });
  } catch (error) {
    // La cuenta de Auth ya existe pero el tenant no llegó a crearse: se
    // deshace, o el email quedaría ocupado sin nada detrás y el superadmin no
    // podría volver a intentarlo con el mismo correo.
    console.error("Error creando el tenant; revirtiendo la cuenta:", error);
    try {
      await admin.auth().deleteUser(userRecord.uid);
    } catch (rollbackError) {
      console.error("No se pudo revertir la cuenta creada:", rollbackError.message);
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}
