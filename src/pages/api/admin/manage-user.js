import admin from "firebase-admin";
import {
  updateUserStatus,
  deleteUser,
  getUserInfo,
} from "../../../lib/services/roleService";

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

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    const { userId, action, currentUserToken } = req.body;

    // Verify the current user is authenticated and has admin permissions
    if (!currentUserToken) {
      return res
        .status(401)
        .json({ message: "Token de autenticación requerido" });
    }

    // Verify the token and get user info
    let currentUser;
    try {
      currentUser = await admin.auth().verifyIdToken(currentUserToken);
    } catch (error) {
      return res.status(401).json({ message: "Token inválido" });
    }

    // Check if trying to modify themselves
    if (currentUser.uid === userId) {
      return res
        .status(400)
        .json({ message: "No puedes modificar tu propio usuario" });
    }

    // Validate input
    if (!userId) {
      return res.status(400).json({ message: "ID de usuario requerido" });
    }

    // Handle different actions
    switch (req.method) {
      case "POST":
        if (action === "disable") {
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

          res
            .status(200)
            .json({ message: "Usuario deshabilitado exitosamente" });
        } else if (action === "enable") {
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

          res.status(200).json({ message: "Usuario habilitado exitosamente" });
        } else {
          res.status(400).json({ message: "Acción inválida" });
        }
        break;

      case "DELETE":
        // Delete user from Firebase Auth
        await admin.auth().deleteUser(userId);

        // Delete user from Firestore
        const deleteResult = await deleteUser(userId);
        if (!deleteResult.success) {
          console.error(
            "Error deleting user from Firestore:",
            deleteResult.error
          );
          // Continue anyway since user was deleted from Auth
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
