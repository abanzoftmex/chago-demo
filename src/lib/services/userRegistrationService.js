/**
 * Servicio para registro de usuarios con soporte multi-tenant
 * Maneja el registro de nuevos usuarios y creación automática de tenants
 */

import { auth, db } from "../firebase/firebaseConfig";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { createTenant, addTenantMember, TENANT_ROLES } from "./tenantService";

/**
 * Registra un nuevo usuario y crea automáticamente un tenant
 * Este es el flujo para el primer usuario de una empresa
 * @param {Object} userData - Datos del usuario
 * @param {string} userData.email - Email del usuario
 * @param {string} userData.password - Contraseña del usuario
 * @param {string} userData.displayName - Nombre completo del usuario
 * @param {string} userData.nombreEmpresa - Nombre de la empresa
 * @returns {Promise<Object>} - Resultado del registro
 */
export const registerUserWithNewTenant = async (userData) => {
  const { email, password, displayName, nombreEmpresa } = userData;

  try {
    // 1. Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    try {
      // 2. Actualizar perfil del usuario
      await updateProfile(user, {
        displayName: displayName,
      });

      // 3. Crear el documento del usuario en Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        email: user.email,
        displayName: displayName,
        createdAt: serverTimestamp(),
        tenantId: null, // Se asignará después de crear el tenant
      });

      // 4. Crear el tenant con el usuario como admin
      const tenantResult = await createTenant(user.uid, nombreEmpresa, {
        email: user.email,
        displayName: displayName,
      });

      if (!tenantResult.success) {
        throw new Error(tenantResult.error);
      }

      // 5. Enviar email de verificación
      await sendEmailVerification(user);

      console.log(`Usuario ${user.uid} registrado exitosamente con tenant ${tenantResult.tenantId}`);
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          tenantId: tenantResult.tenantId,
          role: TENANT_ROLES.ADMIN,
        },
        message: "Usuario y empresa creados exitosamente. Revisa tu email para verificar tu cuenta.",
      };
    } catch (firestoreError) {
      // Si hay error en Firestore, eliminar el usuario de Authentication
      await user.delete();
      throw firestoreError;
    }
  } catch (error) {
    console.error("Error en registro de usuario con tenant:", error);
    return {
      success: false,
      error: getErrorMessage(error),
      code: error.code,
    };
  }
};

/**
 * Registra un nuevo usuario y lo agrega a un tenant existente
 * Este es el flujo cuando un admin invita a un usuario
 * @param {Object} userData - Datos del usuario
 * @param {string} userData.email - Email del usuario
 * @param {string} userData.password - Contraseña del usuario
 * @param {string} userData.displayName - Nombre completo del usuario
 * @param {string} userData.role - Rol asignado en el tenant
 * @param {string} tenantId - ID del tenant existente
 * @param {string} invitingAdminUid - UID del admin que invita
 * @returns {Promise<Object>} - Resultado del registro
 */
export const registerUserForExistingTenant = async (userData, tenantId, invitingAdminUid) => {
  const { email, password, displayName, role } = userData;

  try {
    // 1. Verificar que el rol es válido
    if (!Object.values(TENANT_ROLES).includes(role)) {
      throw new Error("Rol inválido");
    }

    // 2. Crear usuario en Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    try {
      // 3. Actualizar perfil del usuario
      await updateProfile(user, {
        displayName: displayName,
      });

      // 4. Crear el documento del usuario en Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        email: user.email,
        displayName: displayName,
        tenantId: tenantId,
        createdAt: serverTimestamp(),
      });

      // 5. Agregar el usuario al tenant
      const memberResult = await addTenantMember(
        tenantId,
        user.uid,
        { email: user.email, displayName: displayName },
        role,
        invitingAdminUid
      );

      if (!memberResult.success) {
        throw new Error(memberResult.error);
      }

      // 6. Enviar email de verificación
      await sendEmailVerification(user);

      console.log(`Usuario ${user.uid} agregado al tenant ${tenantId} con rol ${role}`);

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          tenantId: tenantId,
          role: role,
        },
        message: "Usuario creado exitosamente. Se ha enviado un email de verificación.",
      };
    } catch (firestoreError) {
      // Si hay error en Firestore, eliminar el usuario de Authentication
      await user.delete();
      throw firestoreError;
    }
  } catch (error) {
    console.error("Error en registro de usuario para tenant:", error);
    return {
      success: false,
      error: getErrorMessage(error),
      code: error.code,
    };
  }
};

/**
 * Verifica si un email ya está registrado
 * @param {string} email - Email a verificar
 * @returns {Promise<boolean>} - True si el email ya existe
 */
export const checkEmailExists = async (email) => {
  try {
    // Intentar crear un usuario temporal para verificar si el email existe
    // Esta es una aproximación ya que Firebase Auth no tiene una función directa
    const tempPassword = "TempPassword123!";
    const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
    
    // Si llegamos aquí, el email no existía, eliminamos el usuario temporal
    await userCredential.user.delete();
    return false;
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      return true;
    }
    // Otros errores (como formato inválido) también consideramos que no existe
    return false;
  }
};

/**
 * Validaciones de datos de usuario
 * @param {Object} userData - Datos a validar
 * @returns {Object} - Resultado de la validación
 */
export const validateUserData = (userData) => {
  const errors = [];

  // Validar email
  if (!userData.email || !isValidEmail(userData.email)) {
    errors.push("Email inválido");
  }

  // Validar password
  if (!userData.password || userData.password.length < 6) {
    errors.push("La contraseña debe tener al menos 6 caracteres");
  }

  // Validar displayName
  if (!userData.displayName || userData.displayName.trim().length < 2) {
    errors.push("El nombre debe tener al menos 2 caracteres");
  }

  // Validar nombreEmpresa si está presente
  if (userData.nombreEmpresa !== undefined && (!userData.nombreEmpresa || userData.nombreEmpresa.trim().length < 2)) {
    errors.push("El nombre de la empresa debe tener al menos 2 caracteres");
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} - True si es válido
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Convierte códigos de error de Firebase a mensajes legibles
 * @param {Object} error - Error de Firebase
 * @returns {string} - Mensaje de error legible
 */
const getErrorMessage = (error) => {
  const errorMessages = {
    "auth/email-already-in-use": "Este email ya está registrado",
    "auth/invalid-email": "Email inválido",
    "auth/operation-not-allowed": "Operación no permitida",
    "auth/weak-password": "La contraseña es muy débil",
    "auth/too-many-requests": "Demasiados intentos. Intenta más tarde",
    "auth/user-disabled": "Esta cuenta ha sido deshabilitada",
    "auth/requires-recent-login": "Operación sensible. Inicia sesión nuevamente",
    "permission-denied": "No tienes permisos para realizar esta operación",
    "unavailable": "Servicio no disponible. Intenta más tarde",
    "already-exists": "El recurso ya existe",
  };

  return errorMessages[error.code] || error.message || "Error desconocido";
};

/**
 * Crea un usuario temporal para invitación (sin contraseña)
 * El usuario deberá establecer su contraseña mediante reset password
 * @param {Object} userData - Datos del usuario
 * @param {string} tenantId - ID del tenant
 * @param {string} invitingAdminUid - UID del admin que invita
 * @returns {Promise<Object>} - Resultado de la invitación
 */
export const inviteUserToTenant = async (userData, tenantId, invitingAdminUid) => {
  const { email, displayName, role } = userData;

  try {
    // 1. Verificar que el rol es válido
    if (!Object.values(TENANT_ROLES).includes(role)) {
      throw new Error("Rol inválido");
    }

    // 2. Verificar si el email ya existe
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      return {
        success: false,
        error: "Este email ya está registrado en el sistema",
        code: "EMAIL_EXISTS",
      };
    }

    // 3. Crear usuario con contraseña temporal
    const tempPassword = generateTempPassword();
    const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
    const user = userCredential.user;

    try {
      // 4. Actualizar perfil del usuario
      await updateProfile(user, {
        displayName: displayName,
      });

      // 5. Crear el documento del usuario en Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        email: user.email,
        displayName: displayName,
        tenantId: tenantId,
        createdAt: serverTimestamp(),
        isInvited: true, // Marca que es un usuario invitado
        mustChangePassword: true, // Debe cambiar contraseña en primer login
      });

      // 6. Agregar el usuario al tenant
      const memberResult = await addTenantMember(
        tenantId,
        user.uid,
        { email: user.email, displayName: displayName },
        role,
        invitingAdminUid
      );

      if (!memberResult.success) {
        throw new Error(memberResult.error);
      }

      // 7. Enviar email de reset password (para que establezca su contraseña)
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email);

      console.log(`Usuario ${user.uid} invitado al tenant ${tenantId} con rol ${role}`);

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          tenantId: tenantId,
          role: role,
        },
        message: "Invitación enviada. El usuario recibirá un email para establecer su contraseña.",
      };
    } catch (firestoreError) {
      // Si hay error en Firestore, eliminar el usuario de Authentication
      await user.delete();
      throw firestoreError;
    }
  } catch (error) {
    console.error("Error en invitación de usuario:", error);
    return {
      success: false,
      error: getErrorMessage(error),
      code: error.code,
    };
  }
};

/**
 * Genera una contraseña temporal segura
 * @returns {string} - Contraseña temporal
 */
const generateTempPassword = () => {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return password;
};

/**
 * Helper para obtener datos completos de usuario después del registro
 * @param {string} userId - UID del usuario
 * @returns {Promise<Object>} - Datos completos del usuario
 */
export const getUserCompleteInfo = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("Usuario no encontrado");
    }

    const userData = userSnap.data();
    
    // Si tiene tenant, obtener su rol
    let tenantRole = null;
    if (userData.tenantId) {
      try {
        const { getUserTenantRole } = await import("./tenantService");
        tenantRole = await getUserTenantRole(userData.tenantId, userId);
      } catch (error) {
        console.warn("Error obteniendo rol del tenant:", error);
      }
    }

    return {
      success: true,
      user: {
        uid: userId,
        ...userData,
        tenantRole: tenantRole,
      },
    };
  } catch (error) {
    console.error("Error obteniendo información completa del usuario:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};