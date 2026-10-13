import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import {
  verificarAdminDeTenant,
  estadoDeCuenta,
  CODIGO_ACCESO_COMPARTIDO,
  MENSAJE_ACCESO_COMPARTIDO,
  MENSAJE_CUENTA_COMPARTIDA,
} from "../../../lib/server/accesoCompartido";

const TENANT_ROLES = {
  ADMIN: "admin",
  CONTADOR: "contador",
  VIEWER: "viewer",
};

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  try {
    const {
      userId,
      email,
      password,
      role,
      displayName,
      currentUserToken,
      tenantId,
    } = req.body;

    console.log("🔵 update-user-tenant - Iniciando actualización:", { userId, role, tenantId });

    // Verify the current user is authenticated
    if (!currentUserToken) {
      return res.status(401).json({ message: "Token de autenticación requerido" });
    }

    if (!tenantId) {
      return res.status(400).json({ message: "ID de tenant requerido" });
    }

    if (!userId) {
      return res.status(400).json({ message: "ID de usuario requerido" });
    }

    const normalizedEmail =
      typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

    // Quien pregunta: administrador ACTIVO de este negocio. Sin atajo para los
    // negocios de un solo miembro (ver `verificarAdminDeTenant`).
    let permiso;
    try {
      permiso = await verificarAdminDeTenant(currentUserToken, tenantId);
    } catch (error) {
      console.error("❌ Error verificando permisos:", error);
      return res.status(500).json({ message: "Error verificando permisos" });
    }
    if (!permiso.ok) return res.status(permiso.status).json({ message: permiso.mensaje });
    const currentUser = permiso.decoded;

    // Verify the user being updated exists and is part of the tenant
    const targetMemberDoc = await admin
      .firestore()
      .collection("tenants")
      .doc(tenantId)
      .collection("members")
      .doc(userId)
      .get();

    if (!targetMemberDoc.exists) {
      return res.status(404).json({ message: "Usuario no encontrado en este tenant" });
    }

    // Un acceso que dio Abanzoft no lo edita el negocio, ni siquiera su rol.
    const cuenta = await estadoDeCuenta(userId, tenantId);
    if (cuenta.vinculadoAqui) {
      return res.status(403).json({ message: MENSAJE_ACCESO_COMPARTIDO, codigo: CODIGO_ACCESO_COMPARTIDO });
    }

    // Validate role if provided
    if (role && !Object.values(TENANT_ROLES).includes(role)) {
      return res.status(400).json({ message: "Rol inválido" });
    }

    const authUser = await admin.auth().getUser(userId);

    // Correo, contraseña y nombre son de la CUENTA de Firebase, la misma en todos
    // los negocios de la persona: si entra a más de uno, los cambia Abanzoft. El
    // rol, en cambio, es de este negocio y sí se puede cambiar. Se compara con lo
    // que ya tiene para que reenviar el formulario sin tocar nada no cuente.
    if (cuenta.compartida) {
      const cambiaLaCuenta =
        Boolean(password) ||
        (normalizedEmail && normalizedEmail !== authUser.email?.toLowerCase()) ||
        (displayName && displayName !== authUser.displayName);
      if (cambiaLaCuenta) {
        return res.status(403).json({ message: MENSAJE_CUENTA_COMPARTIDA, codigo: CODIGO_ACCESO_COMPARTIDO });
      }
    }

    if (normalizedEmail) {
      try {
        const existingUser = await admin.auth().getUserByEmail(normalizedEmail);
        if (existingUser.uid !== userId) {
          return res.status(400).json({ message: "El correo electrónico ya está registrado" });
        }
      } catch (error) {
        if (error.code !== "auth/user-not-found") {
          throw error;
        }
      }
    }

    // Update user in Firebase Auth if password or displayName provided
    const authUpdates = {};
    if (normalizedEmail && normalizedEmail !== authUser.email?.toLowerCase()) {
      authUpdates.email = normalizedEmail;
    }
    if (password && password.length >= 6) {
      authUpdates.password = password;
    }
    if (displayName) {
      authUpdates.displayName = displayName;
    }

    if (Object.keys(authUpdates).length > 0) {
      console.log("📝 Actualizando usuario en Firebase Auth...");
      await admin.auth().updateUser(userId, authUpdates);
      console.log("✅ Usuario actualizado en Firebase Auth");
    }

    // Update user in tenant members collection and users collection
    const batch = admin.firestore().batch();

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: currentUser.uid,
    };

    if (role) {
      updates.role = role;
    }

    if (displayName) {
      updates.displayName = displayName;
    }
    if (normalizedEmail) {
      updates.email = normalizedEmail;
    }

    const memberRef = admin
      .firestore()
      .collection("tenants")
      .doc(tenantId)
      .collection("members")
      .doc(userId);

    batch.update(memberRef, updates);

    // Update user document if displayName changed
    if (displayName || normalizedEmail) {
      const userRef = admin.firestore().collection("users").doc(userId);
      batch.set(
        userRef,
        {
          ...(displayName ? { displayName } : {}),
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    console.log("✅ Usuario actualizado en tenant y documento de usuario");

    // Log the action
    try {
      await admin
        .firestore()
        .collection("tenants")
        .doc(tenantId)
        .collection("activityLog")
        .add({
          type: "user_updated",
          userId: userId,
          changes: updates,
          updatedBy: currentUser.uid,
          updatedByEmail: currentUser.email,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (logError) {
      console.error("Error creando log:", logError);
      // No fallar si el log falla
    }

    return res.status(200).json({
      message: "Usuario actualizado exitosamente",
      userId: userId,
    });
  } catch (error) {
    console.error("❌ Error en update-user-tenant:", error);

    // Handle specific Firebase errors
    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (error.code === "auth/invalid-password") {
      return res.status(400).json({ message: "Contraseña inválida" });
    }

    if (error.code === "auth/weak-password") {
      return res.status(400).json({ message: "La contraseña es muy débil" });
    }

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
