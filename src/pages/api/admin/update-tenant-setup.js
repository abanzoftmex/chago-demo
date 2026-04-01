import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verifySetupSessionCookie } from "../../../lib/server/setupSession";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  const setupPassword = process.env.TENANT_SETUP_PASSWORD;

  if (!setupPassword || !verifySetupSessionCookie(req.headers.cookie, setupPassword)) {
    return res.status(401).json({ message: "Sesión de configuración expirada o inválida" });
  }

  try {
    const { tenantId, ownerUid, nombreEmpresa, adminName, adminEmail } = req.body;

    if (!tenantId || !ownerUid) {
      return res.status(400).json({ message: "Tenant y admin son requeridos" });
    }

    if (!nombreEmpresa?.trim()) {
      return res.status(400).json({ message: "El nombre de la empresa es requerido" });
    }

    const normalizedEmail =
      typeof adminEmail === "string" && adminEmail.trim()
        ? adminEmail.trim().toLowerCase()
        : null;

    if (!normalizedEmail) {
      return res.status(400).json({ message: "El correo del administrador es requerido" });
    }

    const tenantRef = admin.firestore().collection("tenants").doc(tenantId);
    const tenantDoc = await tenantRef.get();

    if (!tenantDoc.exists) {
      return res.status(404).json({ message: "Tenant no encontrado" });
    }

    const memberRef = tenantRef.collection("members").doc(ownerUid);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({ message: "Administrador del tenant no encontrado" });
    }

    try {
      const existingUser = await admin.auth().getUserByEmail(normalizedEmail);
      if (existingUser.uid !== ownerUid) {
        return res.status(400).json({ message: "El correo electrónico ya está registrado" });
      }
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const authUpdates = {
      email: normalizedEmail,
    };

    if (adminName?.trim()) {
      authUpdates.displayName = adminName.trim();
    }

    await admin.auth().updateUser(ownerUid, authUpdates);

    const batch = admin.firestore().batch();

    batch.set(
      tenantRef,
      {
        nombreEmpresa: nombreEmpresa.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      memberRef,
      {
        email: normalizedEmail,
        ...(adminName?.trim() ? { displayName: adminName.trim() } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(
      admin.firestore().collection("users").doc(ownerUid),
      {
        email: normalizedEmail,
        ...(adminName?.trim() ? { displayName: adminName.trim() } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();

    await tenantRef.collection("activityLog").add({
      type: "tenant_setup_updated",
      tenantId,
      ownerUid,
      nombreEmpresa: nombreEmpresa.trim(),
      adminEmail: normalizedEmail,
      adminName: adminName?.trim() || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      message: "Tenant actualizado correctamente",
    });
  } catch (error) {
    console.error("❌ Error en update-tenant-setup:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({ message: "El correo electrónico ya está registrado" });
    }

    if (error.code === "auth/invalid-email") {
      return res.status(400).json({ message: "Correo electrónico inválido" });
    }

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
