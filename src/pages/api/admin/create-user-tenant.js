import admin, { assertAdminInitialized } from "../../../lib/firebase/firebaseAdmin";
import { verificarAdminDeTenant, membresiasDe, soloActivas } from "../../../lib/server/accesoCompartido";

const TENANT_ROLES = {
  ADMIN: "admin",
  CONTADOR: "contador",
  VIEWER: "viewer",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Método no permitido" });
  }

  if (!assertAdminInitialized(res)) return;

  try {
    const {
      email,
      password,
      role = TENANT_ROLES.ADMIN,
      displayName,
      currentUserToken,
      tenantId,
    } = req.body;

    console.log("🔵 create-user-tenant - Iniciando creación:", { email, role, tenantId });

    // Verify the current user is authenticated
    if (!currentUserToken) {
      return res.status(401).json({ message: "Token de autenticación requerido" });
    }

    if (!tenantId) {
      return res.status(400).json({ message: "ID de tenant requerido" });
    }

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

    // Validate input
    if (!email) {
      return res.status(400).json({ message: "Email es requerido" });
    }

    if (!Object.values(TENANT_ROLES).includes(role)) {
      return res.status(400).json({ message: "Rol inválido" });
    }

    // Check if user already exists in Firebase Auth
    let userRecord;
    let isNewUser = false;

    try {
      // Try to get user by email
      userRecord = await admin.auth().getUserByEmail(email);
      console.log("✅ Usuario ya existe en Firebase Auth:", userRecord.uid);

    // Sumar a este negocio una cuenta que ya entra a OTRO la volvería una cuenta de
    // varios negocios, y eso lo decide Abanzoft desde la consola de superadmin: un
    // negocio no puede darle a nadie acceso a los datos de otro ni encadenar las
    // cuentas de otros negocios al suyo. Una cuenta sin ningún negocio sí se puede
    // volver a dar de alta aquí, como siempre.
    const enOtrosNegocios = soloActivas(await membresiasDe(userRecord.uid)).filter((m) => m.tenantId !== tenantId);
    if (enOtrosNegocios.length > 0) {
      return res.status(409).json({
        message:
          "Ese correo ya pertenece a otro negocio. El acceso a varios negocios lo da Abanzoft desde la consola de superadmin.",
        codigo: "CUENTA_EN_OTRO_NEGOCIO",
      });
    }

      // Check if user is already a member of this tenant
      const existingMemberDoc = await admin
        .firestore()
        .collection("tenants")
        .doc(tenantId)
        .collection("members")
        .doc(userRecord.uid)
        .get();

      if (existingMemberDoc.exists) {
        return res.status(400).json({ 
          message: "Este usuario ya es miembro de este tenant" 
        });
      }
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        // User doesn't exist, we'll create it
        console.log("📝 Usuario no existe, se creará uno nuevo");
        isNewUser = true;

        // Validate password if creating new user
        if (!password) {
          return res.status(400).json({ 
            message: "Contraseña es requerida para usuarios nuevos" 
          });
        }

        if (password.length < 6) {
          return res.status(400).json({ 
            message: "La contraseña debe tener al menos 6 caracteres" 
          });
        }

        // Create new user
        try {
          userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: displayName || email.split("@")[0],
            emailVerified: false,
          });
          console.log("✅ Usuario creado en Firebase Auth:", userRecord.uid);
        } catch (createError) {
          console.error("❌ Error creando usuario:", createError);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    console.log(`📋 ${isNewUser ? 'Nuevo usuario creado' : 'Agregando usuario existente'} al tenant`);

    // Get current user document BEFORE creating batch
    const userRef = admin.firestore().collection("users").doc(userRecord.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Now create the batch
    const batch = admin.firestore().batch();

    const memberRef = admin
      .firestore()
      .collection("tenants")
      .doc(tenantId)
      .collection("members")
      .doc(userRecord.uid);

    batch.set(memberRef, {
      email: email,
      displayName: displayName || email.split("@")[0],
      role: role,
      status: "active",
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: currentUser.uid,
    });

    // Update user document - add tenant to list of tenants
    batch.set(
      userRef,
      {
        email: email,
        displayName: displayName || userRecord.displayName || email.split("@")[0],
        tenantIds: admin.firestore.FieldValue.arrayUnion(tenantId),
        // Keep tenantId for backwards compatibility (first tenant or current)
        tenantId: userData.tenantId || tenantId,
        createdAt: userData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await batch.commit();
    console.log("✅ Usuario agregado al tenant y documento de usuario actualizado");

    // Log the action
    try {
      await admin
        .firestore()
        .collection("tenants")
        .doc(tenantId)
        .collection("activityLog")
        .add({
          type: isNewUser ? "user_created" : "user_added",
          userId: userRecord.uid,
          email: email,
          role: role,
          createdBy: currentUser.uid,
          createdByEmail: currentUser.email,
          isNewUser: isNewUser,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (logError) {
      console.error("Error creando log:", logError);
      // No fallar si el log falla
    }

    return res.status(201).json({
      message: isNewUser 
        ? "Usuario creado y agregado al tenant exitosamente" 
        : "Usuario existente agregado al tenant exitosamente",
      userId: userRecord.uid,
      email: email,
      isNewUser: isNewUser,
    });
  } catch (error) {
    console.error("❌ Error en create-user-tenant:", error);

    // Handle specific Firebase errors
    if (error.code === "auth/invalid-email") {
      return res.status(400).json({ message: "Email inválido" });
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
