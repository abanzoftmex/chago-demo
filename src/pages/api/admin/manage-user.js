import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { logService } from "../../../lib/services/logService";
import {
  updateUserStatus,
} from "../../../lib/services/roleService";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  try {
    const { userId, action, currentUserToken, tenantId } = req.body;

    // Verify the current user is authenticated and has admin permissions
    if (!currentUserToken) {
      return res.status(401).json({ message: "Token de autenticación requerido" });
    }

    if (!tenantId) {
      return res.status(400).json({ message: "ID de tenant requerido" });
    }

    // Verify the token
    let currentUser;
    try {
      currentUser = await admin.auth().verifyIdToken(currentUserToken);
    } catch (error) {
      return res.status(401).json({ message: "Token inválido" });
    }

    // Verify current user is admin of the tenant (same logic as create-user-tenant)
    try {
      const membersSnapshot = await admin
        .firestore()
        .collection("tenants")
        .doc(tenantId)
        .collection("members")
        .get();

      const memberCount = membersSnapshot.size;

      if (memberCount <= 1) {
        console.log("✅ Usuario master (único en el tenant), permisos omitidos");
      } else {
        const memberDoc = membersSnapshot.docs.find((d) => d.id === currentUser.uid);

        if (!memberDoc) {
          return res.status(403).json({ message: "No eres miembro de este tenant" });
        }

        const memberData = memberDoc.data();
        if (memberData.role !== "admin") {
          return res.status(403).json({ message: "Solo los administradores pueden gestionar usuarios" });
        }
      }
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return res.status(500).json({ message: "Error verificando permisos" });
    }

    // Prevent modifying yourself
    if (currentUser.uid === userId) {
      return res.status(400).json({ message: "No puedes modificar tu propio usuario" });
    }

    // Validate input
    if (!userId) {
      return res.status(400).json({ message: "ID de usuario requerido" });
    }

    // Handle different actions
    switch (req.method) {
      case "POST":
        if (action === "disable") {
          // Get user data before disabling for logging
          const userDataBefore = await getUserInfo(userId);

          // Disable user in Firebase Auth
          await admin.auth().updateUser(userId, { disabled: true });

          // Update status in Firestore
          const disableResult = await updateUserStatus(userId, false);
          if (!disableResult.success) {
            return res.status(500).json({
              message: "Error actualizando estado del usuario",
              error: disableResult.error,
            });
          }

          // Log the user status change
          if (userDataBefore) {
            await logService.logUserStatusChange({
              user: {
                uid: currentUser.uid,
                displayName: currentUser.name || currentUser.email,
                email: currentUser.email
              },
              userId: userId,
              userData: { ...userDataBefore, isActive: false },
              action: "disable",
              previousStatus: true,
              tenantId
            });
          }

          res
            .status(200)
            .json({ message: "Usuario deshabilitado exitosamente" });
        } else if (action === "enable") {
          // Get user data before enabling for logging
          const userDataBefore = await getUserInfo(userId);

          // Enable user in Firebase Auth
          await admin.auth().updateUser(userId, { disabled: false });

          // Update status in Firestore
          const enableResult = await updateUserStatus(userId, true);
          if (!enableResult.success) {
            return res.status(500).json({
              message: "Error actualizando estado del usuario",
              error: enableResult.error,
            });
          }

          // Log the user status change
          if (userDataBefore) {
            await logService.logUserStatusChange({
              user: {
                uid: currentUser.uid,
                displayName: currentUser.name || currentUser.email,
                email: currentUser.email
              },
              userId: userId,
              userData: { ...userDataBefore, isActive: true },
              action: "enable",
              previousStatus: false,
              tenantId
            });
          }

          res.status(200).json({ message: "Usuario habilitado exitosamente" });
        } else {
          res.status(400).json({ message: "Acción inválida" });
        }
        break;

      case "DELETE":
        // Delete user from Firebase Auth
        await admin.auth().deleteUser(userId);

        // Remove from tenant members
        try {
          await admin
            .firestore()
            .collection("tenants")
            .doc(tenantId)
            .collection("members")
            .doc(userId)
            .delete();
        } catch (err) {
          console.error("Error removing member from tenant:", err);
        }

        // Delete user document from Firestore
        try {
          await admin.firestore().collection("users").doc(userId).delete();
        } catch (err) {
          console.error("Error deleting user doc:", err);
        }

        res.status(200).json({ message: "Usuario eliminado exitosamente" });
        break;

      default:
        res.status(405).json({ message: "Método no permitido" });
    }
  } catch (error) {
    console.error("Error managing user:", error);

    if (error.code === "auth/user-not-found") {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.status(500).json({
      message: "Error interno del servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
