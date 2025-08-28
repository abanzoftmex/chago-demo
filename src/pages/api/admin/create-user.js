import admin from "firebase-admin";
import { setUserRole, ROLES } from "../../../lib/services/roleService";
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
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  try {
    const {
      email,
      password,
      role = ROLES.ADMINISTRATIVO,
      displayName,
      currentUserToken,
    } = req.body;

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
    try {
      // Get user document from Firestore using Admin SDK
      const userDoc = await admin.firestore().collection('users').doc(currentUser.uid).get();

      if (!userDoc.exists) {
        return res.status(403).json({ message: "Usuario no encontrado en la base de datos" });
      }

      const userData = userDoc.data();
      if (userData.role !== "administrativo") {
        return res.status(403).json({ message: "No tienes permisos para gestionar usuarios" });
      }
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }

    // Validate input
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email y contraseña son requeridos" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ message: "Rol inválido" });
    }

    // Create user with Firebase Admin
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: displayName || email.split("@")[0],
      emailVerified: true, // Auto-verify email for admin created users
    });

    // Set user role in Firestore
    const roleResult = await setUserRole(userRecord.uid, role, {
      email: userRecord.email,
      displayName: userRecord.displayName,
      createdAt: new Date(),
      createdBy: currentUser.uid,
      isActive: true,
    });

    if (!roleResult.success) {
      // If role setting fails, delete the created user
      await admin.auth().deleteUser(userRecord.uid);
      return res.status(500).json({
        message: "Error configurando rol del usuario",
        error: roleResult.error,
      });
    }

    // Log the user creation
    await logService.logUserCreation({
      user: {
        uid: currentUser.uid,
        displayName: currentUserData.displayName,
        email: currentUserData.email
      },
      userId: userRecord.uid,
      userData: {
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: role,
        isActive: true,
        createdAt: new Date(),
        createdBy: currentUser.uid
      }
    });

    res.status(201).json({
      message: "Usuario creado exitosamente",
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    if (error.code === "auth/invalid-email") {
      return res.status(400).json({ message: "Email inválido" });
    }

    if (error.code === "auth/weak-password") {
      return res.status(400).json({ message: "Contraseña muy débil" });
    }

    res.status(500).json({
      message: "Error interno del servidor",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
