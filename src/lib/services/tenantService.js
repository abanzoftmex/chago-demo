import { db } from "../firebase/firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  addDoc
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// Roles disponibles en el sistema multi-tenant
export const TENANT_ROLES = {
  ADMIN: "admin",
  CONTADOR: "contador",
  VIEWER: "viewer"
};

/**
 * Crea un nuevo tenant con el usuario como admin
 * @param {string} ownerUid - UID del usuario propietario
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @param {Object} ownerData - Datos del usuario propietario (email, displayName)
 * @returns {Promise<Object>} - Resultado con tenantId creado
 */
export const createTenant = async (ownerUid, nombreEmpresa, ownerData) => {
  try {
    const tenantId = uuidv4();
    const batch = writeBatch(db);

    // 1. Crear el documento del tenant
    const tenantRef = doc(db, "tenants", tenantId);
    batch.set(tenantRef, {
      nombreEmpresa,
      ownerUid,
      createdAt: serverTimestamp()
    });

    // 2. Agregar al usuario como admin del tenant
    const memberRef = doc(db, `tenants/${tenantId}/members`, ownerUid);
    batch.set(memberRef, {
      email: ownerData.email,
      role: TENANT_ROLES.ADMIN,
      status: "active",
      createdAt: serverTimestamp()
    });

    // 3. Crear/actualizar el usuario con el tenantId
    const userRef = doc(db, "users", ownerUid);
    batch.set(userRef, {
      tenantId: tenantId,
      email: ownerData.email,
      displayName: ownerData.displayName || ownerData.email,
      uid: ownerUid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();

    console.log(`Tenant creado exitosamente: ${tenantId}`);
    return { success: true, tenantId };
  } catch (error) {
    console.error("Error al crear tenant:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene la información del tenant del usuario
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<Object>} - Información del tenant
 */
export const getTenantInfo = async (tenantId) => {
  try {
    if (!tenantId) {
      throw new Error("TenantId requerido");
    }

    const tenantRef = doc(db, "tenants", tenantId);
    const tenantSnap = await getDoc(tenantRef);

    if (!tenantSnap.exists()) {
      throw new Error("Tenant no encontrado");
    }

    return {
      success: true,
      tenant: {
        id: tenantId,
        ...tenantSnap.data()
      }
    };
  } catch (error) {
    console.error("Error al obtener tenant:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene el rol del usuario en el tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} userId - UID del usuario
 * @returns {Promise<string>} - Rol del usuario en el tenant
 */
export const getUserTenantRole = async (tenantId, userId) => {
  try {
    if (!tenantId || !userId) {
      throw new Error("TenantId y userId requeridos");
    }

    const memberRef = doc(db, `tenants/${tenantId}/members`, userId);
    const memberSnap = await getDoc(memberRef);

    if (!memberSnap.exists()) {
      throw new Error("Usuario no es miembro del tenant");
    }

    const memberData = memberSnap.data();
    if (memberData.status !== "active") {
      throw new Error("Usuario no está activo en el tenant");
    }

    return memberData.role;
  } catch (error) {
    console.error("Error al obtener rol del usuario:", error);
    throw error;
  }
};

/**
 * Agrega un nuevo miembro al tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} newUserUid - UID del nuevo usuario
 * @param {Object} userData - Datos del usuario (email, displayName)
 * @param {string} role - Rol asignado
 * @param {string} adminUid - UID del admin que hace la operación
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const addTenantMember = async (tenantId, newUserUid, userData, role, adminUid) => {
  try {
    // Verificar que quien lo ejecuta es admin del tenant
    const adminRole = await getUserTenantRole(tenantId, adminUid);
    if (adminRole !== TENANT_ROLES.ADMIN) {
      throw new Error("Solo los admins pueden agregar miembros");
    }

    // Verificar que el rol es válido
    if (!Object.values(TENANT_ROLES).includes(role)) {
      throw new Error("Rol inválido");
    }

    const batch = writeBatch(db);

    // 1. Agregar como miembro del tenant
    const memberRef = doc(db, `tenants/${tenantId}/members`, newUserUid);
    batch.set(memberRef, {
      email: userData.email,
      role: role,
      status: "active",
      createdAt: serverTimestamp()
    });

    // 2. Crear/actualizar el usuario con el tenantId
    const userRef = doc(db, "users", newUserUid);
    batch.set(userRef, {
      tenantId: tenantId,
      email: userData.email,
      displayName: userData.displayName || userData.email,
      uid: newUserUid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await batch.commit();

    console.log(`Usuario ${newUserUid} agregado al tenant ${tenantId} con rol ${role}`);
    return { success: true };
  } catch (error) {
    console.error("Error al agregar miembro al tenant:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene todos los miembros del tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} requestingUserUid - UID del usuario que hace la consulta
 * @returns {Promise<Object>} - Lista de miembros del tenant
 */
export const getTenantMembers = async (tenantId, requestingUserUid) => {
  try {
    // Verificar que el usuario es miembro del tenant
    await getUserTenantRole(tenantId, requestingUserUid);

    const membersRef = collection(db, `tenants/${tenantId}/members`);
    const membersSnap = await getDocs(membersRef);

    const members = [];
    membersSnap.forEach((doc) => {
      members.push({
        uid: doc.id,
        ...doc.data()
      });
    });

    return { success: true, members };
  } catch (error) {
    console.error("Error al obtener miembros del tenant:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Actualiza el rol de un miembro del tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} targetUserUid - UID del usuario a actualizar
 * @param {string} newRole - Nuevo rol
 * @param {string} adminUid - UID del admin que hace la operación
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const updateTenantMemberRole = async (tenantId, targetUserUid, newRole, adminUid) => {
  try {
    // Verificar que quien lo ejecuta es admin del tenant
    const adminRole = await getUserTenantRole(tenantId, adminUid);
    if (adminRole !== TENANT_ROLES.ADMIN) {
      throw new Error("Solo los admins pueden cambiar roles");
    }

    // Verificar que el rol es válido
    if (!Object.values(TENANT_ROLES).includes(newRole)) {
      throw new Error("Rol inválido");
    }

    const memberRef = doc(db, `tenants/${tenantId}/members`, targetUserUid);
    await updateDoc(memberRef, {
      role: newRole
    });

    console.log(`Rol de usuario ${targetUserUid} actualizado a ${newRole}`);
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar rol del miembro:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Desactiva un miembro del tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} targetUserUid - UID del usuario a desactivar
 * @param {string} adminUid - UID del admin que hace la operación
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deactivateTenantMember = async (tenantId, targetUserUid, adminUid) => {
  try {
    // Verificar que quien lo ejecuta es admin del tenant
    const adminRole = await getUserTenantRole(tenantId, adminUid);
    if (adminRole !== TENANT_ROLES.ADMIN) {
      throw new Error("Solo los admins pueden desactivar miembros");
    }

    // No permitir que el owner se desactive a sí mismo
    const tenantInfo = await getTenantInfo(tenantId);
    if (tenantInfo.success && tenantInfo.tenant.ownerUid === targetUserUid) {
      throw new Error("El propietario del tenant no puede desactivarse");
    }

    const memberRef = doc(db, `tenants/${tenantId}/members`, targetUserUid);
    await updateDoc(memberRef, {
      status: "inactive"
    });

    console.log(`Usuario ${targetUserUid} desactivado del tenant ${tenantId}`);
    return { success: true };
  } catch (error) {
    console.error("Error al desactivar miembro:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Verifica si un usuario tiene un permiso específico en el tenant
 * @param {string} tenantId - ID del tenant
 * @param {string} userId - UID del usuario
 * @param {string} permission - Permiso a verificar
 * @returns {Promise<boolean>} - True si tiene el permiso
 */
export const hasPermissionInTenant = async (tenantId, userId, permission) => {
  try {
    const role = await getUserTenantRole(tenantId, userId);
    return checkRolePermission(role, permission);
  } catch (error) {
    console.error("Error al verificar permiso:", error);
    return false;
  }
};

/**
 * Verifica permisos basados en rol
 * @param {string} role - Rol del usuario
 * @param {string} permission - Permiso a verificar
 * @returns {boolean} - True si tiene el permiso
 */
export const checkRolePermission = (role, permission) => {
  const rolePermissions = {
    [TENANT_ROLES.ADMIN]: {
      canCreateUsers: true,
      canDeleteUsers: true,
      canCreateEntradas: true,
      canCreateSalidas: true,
      canDeleteTransactions: true,
      canViewReports: true,
      canManageSettings: true
    },
    [TENANT_ROLES.CONTADOR]: {
      canCreateUsers: false,
      canDeleteUsers: false,
      canCreateEntradas: true,
      canCreateSalidas: true,
      canDeleteTransactions: false,
      canViewReports: true,
      canManageSettings: false
    },
    [TENANT_ROLES.VIEWER]: {
      canCreateUsers: false,
      canDeleteUsers: false,
      canCreateEntradas: false,
      canCreateSalidas: false,
      canDeleteTransactions: false,
      canViewReports: true,
      canManageSettings: false
    }
  };

  return rolePermissions[role]?.[permission] || false;
};

/**
 * Obtiene el tenant ID del usuario desde la colección users
 * @param {string} userId - UID del usuario
 * @returns {Promise<string>} - Tenant ID del usuario
 */
export const getUserTenantId = async (userId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("Usuario no encontrado");
    }

    const userData = userSnap.data();
    if (!userData.tenantId) {
      throw new Error("Usuario no tiene tenant asignado");
    }

    // Handle case where tenantId was stored as a Firestore DocumentReference object
    const rawTenantId = userData.tenantId;
    if (typeof rawTenantId === 'string') {
      return rawTenantId;
    }
    // DocumentReference: has .id (last segment) and .path (e.g. "tenants/uuid")
    if (rawTenantId && typeof rawTenantId === 'object') {
      if (typeof rawTenantId.id === 'string') return rawTenantId.id;
      if (typeof rawTenantId.path === 'string') return rawTenantId.path.split('/').pop();
    }
    throw new Error("Formato de tenantId inválido en el documento de usuario");
  } catch (error) {
    console.error("Error al obtener tenantId del usuario:", error);
    throw error;
  }
};