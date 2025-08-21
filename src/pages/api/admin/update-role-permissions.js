import admin from "firebase-admin";
import { ROLE_PERMISSIONS, ROLES } from "../../../lib/services/roleService";
import { db } from "../../../lib/firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

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
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    const { role, permissions, currentUserToken } = req.body;

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

    // Validate input
    if (!role || !permissions) {
      return res
        .status(400)
        .json({ message: "Rol y permisos son requeridos" });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: "Rol inválido" });
    }

    // Update role permissions in Firestore
    try {
      // Store the updated permissions in a 'roles' collection
      await setDoc(
        doc(db, "roles", role),
        {
          permissions,
          updatedAt: new Date(),
          updatedBy: currentUser.uid,
        },
        { merge: true }
      );

      // Update the ROLE_PERMISSIONS object in memory
      ROLE_PERMISSIONS[role] = { ...ROLE_PERMISSIONS[role], ...permissions };

      res.status(200).json({
        message: "Permisos actualizados exitosamente",
        role,
        permissions,
      });
    } catch (error) {
      console.error("Error updating role permissions:", error);
      return res.status(500).json({
        message: "Error actualizando permisos",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Error in update-role-permissions:", error);

    res.status(500).json({
      message: "Error interno del servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}