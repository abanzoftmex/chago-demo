import admin from "firebase-admin";

// Initialize Firebase Admin SDK (only if not already initialized)
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

const TENANT_ROLES = {
  ADMIN: "admin",
  CONTADOR: "contador",
  VIEWER: "viewer",
};

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    const {
      userId,
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

    // Verify the token and get user info
    let currentUser;
    try {
      currentUser = await admin.auth().verifyIdToken(currentUserToken);
      console.log("✅ Token verificado para usuario:", currentUser.email);
    } catch (error) {
      console.error("❌ Error verificando token:", error);
      return res.status(401).json({ message: "Token inválido" });
    }

    // Verify current user is admin of the tenant
    try {
      const memberDoc = await admin
        .firestore()
        .collection("tenants")
        .doc(tenantId)
        .collection("members")
        .doc(currentUser.uid)
        .get();

      if (!memberDoc.exists) {
        console.error("❌ Usuario no es miembro del tenant");
        return res.status(403).json({ message: "No eres miembro de este tenant" });
      }

      const memberData = memberDoc.data();
      if (memberData.role !== TENANT_ROLES.ADMIN) {
        console.error("❌ Usuario no es admin del tenant, rol:", memberData.role);
        return res.status(403).json({ message: "Solo los administradores pueden actualizar usuarios" });
      }

      console.log("✅ Usuario verificado como admin del tenant");
    } catch (error) {
      console.error("❌ Error verificando permisos:", error);
      return res.status(500).json({ message: "Error verificando permisos" });
    }

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

    // Validate role if provided
    if (role && !Object.values(TENANT_ROLES).includes(role)) {
      return res.status(400).json({ message: "Rol inválido" });
    }

    // Update user in Firebase Auth if password or displayName provided
    const authUpdates = {};
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

    const memberRef = admin
      .firestore()
      .collection("tenants")
      .doc(tenantId)
      .collection("members")
      .doc(userId);

    batch.update(memberRef, updates);

    // Update user document if displayName changed
    if (displayName) {
      const userRef = admin.firestore().collection("users").doc(userId);
      batch.set(
        userRef,
        {
          displayName: displayName,
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

    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
}
