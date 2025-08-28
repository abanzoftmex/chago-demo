import admin from "firebase-admin";
import { logService } from "../../../lib/services/logService";

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
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    const { userId, email, password, displayName, role, currentUserToken } = req.body;

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

    // Verify current user has admin permissions
    // Check if user exists in Firestore and has admin role
    let currentUserData;
    try {
      // Get user document from Firestore using Admin SDK
      const userDoc = await admin.firestore().collection('users').doc(currentUser.uid).get();

      if (!userDoc.exists) {
        return res.status(403).json({ message: "Usuario no encontrado en la base de datos" });
      }

      currentUserData = userDoc.data();
      if (currentUserData.role !== "administrativo") {
        return res.status(403).json({ message: "No tienes permisos para gestionar usuarios" });
      }
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }

    // Check if trying to modify themselves
    // Allow administrators to edit their own profile, but prevent non-admins from self-modification
    if (currentUser.uid === userId && currentUserData.role !== "administrativo") {
      return res
        .status(400)
        .json({ message: "No puedes modificar tu propio usuario" });
    }

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ message: "ID de usuario requerido" });
    }

    if (!displayName || displayName.trim() === "") {
      return res.status(400).json({ message: "Nombre para mostrar requerido" });
    }

    if (!role) {
      return res.status(400).json({ message: "Rol requerido" });
    }

    // Get target user data before updating (for logging)
    let targetUserData = null;
    try {
      const targetUserDoc = await admin.firestore().collection('users').doc(userId).get();
      if (targetUserDoc.exists) {
        targetUserData = targetUserDoc.data();
        console.log("Target user data from Firestore:", targetUserData);
      } else {
        console.log("Target user document does not exist in Firestore");
      }
    } catch (error) {
      console.error("Error getting target user data:", error);
      // Continue without previous data
    }

    // Prepare update data
    const updateData = {
      displayName: displayName.trim(),
      role: role,
    };

    // If password is provided, update it
    if (password && password.trim() !== "") {
      if (password.length < 6) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
      }
      updateData.password = password;
    }

    // Update user in Firebase Auth
    try {
      const authUpdateData = {
        displayName: displayName.trim(),
      };

      // Only update password if provided
      if (password && password.trim() !== "") {
        authUpdateData.password = password;
      }

      await admin.auth().updateUser(userId, authUpdateData);

      // Update user record in Firestore
      const db = admin.firestore();
      await db.collection("users").doc(userId).update({
        displayName: displayName.trim(),
        role: role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Prepare target user data for logging (after successful update)
      const updatedUserData = {
        displayName: displayName.trim(),
        role: role,
        email: targetUserData?.email || "email-no-disponible",
        isActive: targetUserData?.isActive ?? true,
        updatedAt: new Date().toISOString(),
      };

      // Prepare current user info for logging (the one performing the action)
      const currentUserInfo = {
        uid: currentUser.uid,
        displayName: currentUserData.displayName || currentUser.name || "Usuario sin nombre",
        email: currentUserData.email || currentUser.email || "email-no-disponible"
      };

      console.log("=== DEBUG LOGGING DATA ===");
      console.log("Target user data (before):", targetUserData);
      console.log("Updated user data:", updatedUserData);
      console.log("Current user (performing action):", currentUserInfo);

      // Log the user update
      const logResult = await logService.logUserUpdate({
        user: currentUserInfo,
        userId: userId,
        userData: updatedUserData,
        previousData: targetUserData
      });

      console.log("Log result:", logResult);
      console.log("=== END DEBUG LOGGING DATA ===");

      res.status(200).json({
        message: "Usuario actualizado exitosamente",
        userId: userId,
      });
    } catch (authError) {
      console.error("Error updating user in Firebase Auth:", authError);

      if (authError.code === "auth/user-not-found") {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      if (authError.code === "auth/weak-password") {
        return res.status(400).json({ message: "La contraseña es demasiado débil" });
      }

      return res.status(500).json({ message: "Error al actualizar usuario en Firebase Auth" });
    }
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}
