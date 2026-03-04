/**
 * Service para manejo de roles - Compatible con Multi-Tenant
 * Mantiene compatibilidad con sistema anterior pero agrega soporte para tenants
 */

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
} from "firebase/firestore";
import { getUserTenantRole, getUserTenantId } from "./tenantService";

// Roles del sistema anterior (mantenemos para compatibilidad)
export const ROLES = {
  ADMINISTRATIVO: "administrativo",
  CONTADOR: "contador",
  DIRECTOR_GENERAL: "director_general",
};

// Nuevos roles para multi-tenant
export const TENANT_ROLES = {
  ADMIN: "admin",
  CONTADOR: "contador", 
  VIEWER: "viewer"
};

// Mapeo de roles anteriores a nuevos roles tenant
export const ROLE_MAPPING = {
  [ROLES.ADMINISTRATIVO]: TENANT_ROLES.ADMIN,
  [ROLES.CONTADOR]: TENANT_ROLES.CONTADOR,
  [ROLES.DIRECTOR_GENERAL]: TENANT_ROLES.VIEWER,
};

// Permisos por defecto para roles anteriores (compatibilidad)
export const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.ADMINISTRATIVO]: {
    canViewDashboard: true,
    canManageTransactions: true,
    canViewEntradas: true,
    canViewSalidas: true,
    canViewHistorial: true,
    canManageProviders: true,
    canManageConcepts: true,
    canManageDescriptions: true,
    canManageGenerales: true,
    canManageSubconcepts: true,
    canViewReports: true,
    canViewAnalisisIA: true,
    canManageSettings: true,
    canManageUsers: true,
    canDeleteCatalogItems: true,
    canDeleteTransactions: true,
    canDeletePayments: true,
  },
  [ROLES.CONTADOR]: {
    canViewDashboard: true,
    canManageTransactions: true,
    canViewEntradas: true,
    canViewSalidas: true,
    canViewHistorial: true,
    canManageProviders: true,
    canManageConcepts: true,
    canManageDescriptions: true,
    canManageGenerales: true,
    canManageSubconcepts: true,
    canViewReports: false,
    canViewAnalisisIA: false,
    canManageSettings: false,
    canManageUsers: false,
    canDeleteCatalogItems: false,
    canDeleteTransactions: false,
    canDeletePayments: false,
  },
  [ROLES.DIRECTOR_GENERAL]: {
    canViewDashboard: true,
    canManageTransactions: false,
    canViewEntradas: true,
    canViewSalidas: true,
    canViewHistorial: true,
    canManageProviders: false,
    canManageConcepts: false,
    canManageDescriptions: false,
    canManageGenerales: false,
    canManageSubconcepts: false,
    canViewReports: false,
    canViewAnalisisIA: false,
    canManageSettings: false,
    canManageUsers: false,
    canDeleteCatalogItems: false,
    canDeleteTransactions: false,
    canDeletePayments: false,
  },
};

// Nuevos permisos para roles tenant
export const TENANT_ROLE_PERMISSIONS = {
  [TENANT_ROLES.ADMIN]: {
    canViewDashboard: true,
    canManageTransactions: true,
    canViewEntradas: true,
    canViewSalidas: true,
    canViewHistorial: true,
    canManageProviders: true,
    canManageConcepts: true,
    canManageDescriptions: true,
    canManageGenerales: true,
    canManageSubconcepts: true,
    canViewReports: true,
    canViewAnalisisIA: true,
    canManageSettings: true,
    canManageUsers: true,
    canDeleteCatalogItems: true,
    canDeleteTransactions: true,
    canDeletePayments: true,
    // Nuevos permisos específicos de tenant
    canCreateUsers: true,
    canDeleteUsers: true,
    canManageTenantsettings: true,
  },
  [TENANT_ROLES.CONTADOR]: {
    canViewDashboard: true,
    canManageTransactions: true,
    canViewEntradas: true,
    canViewSalidas: true,
    canViewHistorial: true,
    canManageProviders: true,
    canManageConcepts: true,
    canManageDescriptions: true,
    canManageGenerales: true,
    canManageSubconcepts: true,
    canViewReports: true,
    canViewAnalisisIA: false,
    canManageSettings: false,
    canManageUsers: false,
    canDeleteCatalogItems: false,
    canDeleteTransactions: false,
    canDeletePayments: false,
    // Permisos tenant
    canCreateUsers: false,
    canDeleteUsers: false,
    canManageTenantsettings: false,
  },
  [TENANT_ROLES.VIEWER]: {
    canViewDashboard: true,
    canManageTransactions: false,
    canViewEntradas: true,
    canViewSalidas: true,
    canViewHistorial: true,
    canManageProviders: false,
    canManageConcepts: false,
    canManageDescriptions: false,
    canManageGenerales: false,
    canManageSubconcepts: false,
    canViewReports: true,
    canViewAnalisisIA: false,
    canManageSettings: false,
    canManageUsers: false,
    canDeleteCatalogItems: false,
    canDeleteTransactions: false,
    canDeletePayments: false,
    // Permisos tenant
    canCreateUsers: false,
    canDeleteUsers: false,
    canManageTenantsettings: false,
  },
};

// Inicializar con los valores por defecto
export let ROLE_PERMISSIONS = { ...DEFAULT_ROLE_PERMISSIONS };

/**
 * Obtiene el rol del usuario - Compatible con ambos sistemas
 * @param {string} userId - UID del usuario
 * @param {boolean} useTenantRole - Si usar el nuevo sistema de tenant (default: true)
 * @returns {Promise<string>} - Rol del usuario
 */
export const getUserRole = async (userId, useTenantRole = true) => {
  try {
    if (useTenantRole) {
      // Nuevo sistema multi-tenant
      try {
        const tenantId = await getUserTenantId(userId);
        const tenantRole = await getUserTenantRole(tenantId, userId);
        return tenantRole;
      } catch (tenantError) {
        console.log("Usuario no tiene tenant asignado, usando sistema anterior");
        // Si no tiene tenant, usar sistema anterior
        return await getLegacyUserRole(userId);
      }
    } else {
      // Sistema anterior
      return await getLegacyUserRole(userId);
    }
  } catch (error) {
    console.error("Error obteniendo rol del usuario:", error);
    return TENANT_ROLES.VIEWER; // Rol por defecto más restrictivo
  }
};

/**
 * Obtiene el rol del usuario del sistema anterior
 * @param {string} userId - UID del usuario
 * @returns {Promise<string>} - Rol del usuario del sistema anterior
 */
const getLegacyUserRole = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists() && userDoc.data().role) {
      const legacyRole = userDoc.data().role;
      // Mapear a nuevo rol si existe el mapeo
      return ROLE_MAPPING[legacyRole] || legacyRole;
    }
    return TENANT_ROLES.VIEWER; // Rol por defecto
  } catch (error) {
    console.error("Error obteniendo rol legacy:", error);
    return TENANT_ROLES.VIEWER;
  }
};

/**
 * Carga los permisos de roles desde Firestore
 */
export const loadRolePermissionsFromFirestore = async () => {
  const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (DEMO_MODE) {
    console.log("🎭 DEMO MODE: Using default role permissions (Firestore disabled)");
    return true;
  }

  try {
    console.log("Loading role permissions from Firestore...");
    // Cargar permisos para roles legacy
    for (const role of Object.values(ROLES)) {
      try {
        const roleDoc = await getDoc(doc(db, "roles", role));
        if (roleDoc.exists() && roleDoc.data().permissions) {
          ROLE_PERMISSIONS[role] = {
            ...DEFAULT_ROLE_PERMISSIONS[role],
            ...roleDoc.data().permissions,
          };
        }
      } catch (error) {
        console.warn(`Error loading permissions for role ${role}:`, error);
      }
    }
    console.log("Role permissions loaded successfully");
    return true;
  } catch (error) {
    console.error("Error loading role permissions from Firestore:", error);
    return false;
  }
};

/**
 * Establece el rol de un usuario en el sistema legacy
 */
export const setUserRole = async (userId, role, userInfo = {}) => {
  try {
    const userData = {
      role,
      updatedAt: serverTimestamp(),
      ...userInfo,
    };

    await setDoc(doc(db, "users", userId), userData, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("Error estableciendo rol del usuario:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Verifica si un usuario tiene un permiso específico
 * @param {string} userRole - Rol del usuario
 * @param {string} permission - Permiso a verificar
 * @param {boolean} useTenantPermissions - Si usar permisos de tenant
 * @returns {boolean} - True si tiene el permiso
 */
export const hasPermission = (userRole, permission, useTenantPermissions = true) => {
  if (!userRole) {
    return false;
  }

  if (useTenantPermissions && TENANT_ROLE_PERMISSIONS[userRole]) {
    return TENANT_ROLE_PERMISSIONS[userRole][permission] || false;
  }

  if (ROLE_PERMISSIONS[userRole]) {
    return ROLE_PERMISSIONS[userRole][permission] || false;
  }

  return false;
};

/**
 * Recarga los permisos de un rol específico desde Firestore
 */
export const reloadRolePermissions = async (role) => {
  const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (DEMO_MODE) {
    console.log("🎭 DEMO MODE: Skipping permission reload");
    return { success: true };
  }

  try {
    if (!role) {
      return { success: false, error: "Rol requerido" };
    }

    // Solo recargar si es rol legacy
    if (Object.values(ROLES).includes(role)) {
      const roleDoc = await getDoc(doc(db, "roles", role));
      if (roleDoc.exists() && roleDoc.data().permissions) {
        ROLE_PERMISSIONS[role] = {
          ...DEFAULT_ROLE_PERMISSIONS[role],
          ...roleDoc.data().permissions,
        };
        console.log(`Reloaded permissions for role ${role}:`, ROLE_PERMISSIONS[role]);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error reloading permissions for role ${role}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene todos los permisos de un rol
 * @param {string} role - Rol del usuario
 * @param {boolean} useTenantPermissions - Si usar permisos de tenant
 * @returns {Object} - Permisos del rol
 */
export const getRolePermissions = (role, useTenantPermissions = true) => {
  if (!role) return {};

  if (useTenantPermissions && TENANT_ROLE_PERMISSIONS[role]) {
    return TENANT_ROLE_PERMISSIONS[role];
  }

  return ROLE_PERMISSIONS[role] || {};
};

/**
 * Verifica si un usuario puede acceder a una ruta específica
 * @param {string} userRole - Rol del usuario
 * @param {string} routePath - Ruta a verificar
 * @param {boolean} useTenantPermissions - Si usar permisos de tenant
 * @returns {boolean} - True si puede acceder
 */
export const canAccessRoute = (userRole, routePath, useTenantPermissions = true) => {
  const permissions = getRolePermissions(userRole, useTenantPermissions);

  // Mapeo de rutas a permisos
  const routePermissions = {
    "/admin/dashboard": "canViewDashboard",
    "/admin/transacciones/entradas": "canViewEntradas",
    "/admin/transacciones/salidas": "canViewSalidas",
    "/admin/transacciones/historial": "canViewHistorial",
    "/admin/catalogos/proveedores": "canManageProviders",
    "/admin/catalogos/conceptos": "canManageConcepts",
    "/admin/catalogos/descripciones": "canManageDescriptions",
    "/admin/catalogos/generales": "canManageGenerales",
    "/admin/catalogos/subconceptos": "canManageSubconcepts",
    "/admin/reportes": "canViewReports",
    "/admin/analisis-ia": "canViewAnalisisIA",
    "/admin/configuracion": "canManageSettings",
    "/admin/configuracion/correos-notificacion": "canManageSettings",
    "/admin/usuarios": "canManageUsers",
  };

  const requiredPermission = routePermissions[routePath];
  if (!requiredPermission) {
    return true; // Si no está mapeada, permitir acceso
  }

  return permissions[requiredPermission] || false;
};

/**
 * FUNCIONES LEGACY - Mantenidas para compatibilidad
 */

/**
 * Obtiene usuarios del tenant actual
 * @param {string} tenantId - ID del tenant
 */
export const getTenantUsers = async (tenantId) => {
  try {
    console.log(`🔍 getTenantUsers - Tenant ID recibido: ${tenantId}`);
    
    if (!tenantId) {
      throw new Error("TenantId requerido");
    }

    // Obtener miembros del tenant
    const membersPath = `tenants/${tenantId}/members`;
    console.log(`📂 Obteniendo miembros de: ${membersPath}`);
    
    const membersQuery = query(collection(db, membersPath));
    const membersSnapshot = await getDocs(membersQuery);
    
    console.log(`👥 Miembros encontrados en tenant: ${membersSnapshot.size}`);
    
    const users = [];
    
    // Para cada miembro, obtener sus datos completos de la colección users
    for (const memberDoc of membersSnapshot.docs) {
      const memberId = memberDoc.id;
      const memberData = memberDoc.data();
      
      console.log(`👤 Procesando miembro: ${memberId}`, memberData);
      
      try {
        const userRef = doc(db, "users", memberId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = {
            id: memberId,
            ...userDoc.data(),
            tenantRole: memberData.role,
            tenantStatus: memberData.status
          };
          console.log(`✅ Usuario agregado:`, userData);
          users.push(userData);
        } else {
          console.warn(`⚠️ Usuario ${memberId} no existe en colección users`);
        }
      } catch (error) {
        console.error(`❌ Error obteniendo datos del usuario ${memberId}:`, error);
      }
    }

    console.log(`📊 Total usuarios del tenant ${tenantId}: ${users.length}`);
    return { success: true, users };
  } catch (error) {
    console.error("❌ Error obteniendo usuarios del tenant:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene todos los usuarios (LEGACY - NO usar en multi-tenant)
 */
export const getAllUsers = async () => {
  try {
    const usersQuery = query(collection(db, "users"));
    const snapshot = await getDocs(usersQuery);

    const users = [];
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error obteniendo usuarios:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Actualiza el estado activo de un usuario (sistema legacy)
 */
export const updateUserStatus = async (userId, isActive) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      isActive,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando estado del usuario:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Elimina un usuario del sistema (sistema legacy)
 */
export const deleteUser = async (userId) => {
  try {
    await deleteDoc(doc(db, "users", userId));
    return { success: true };
  } catch (error) {
    console.error("Error eliminando usuario:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene información de un usuario específico
 */
export const getUserInfo = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return { success: true, user: { id: userDoc.id, ...userDoc.data() } };
    }
    return { success: false, error: "Usuario no encontrado" };
  } catch (error) {
    console.error("Error obteniendo información del usuario:", error);
    return { success: false, error: error.message };
  }
};

/**
 * NUEVAS FUNCIONES PARA MULTI-TENANT
 */

/**
 * Verifica si un usuario tiene un permiso en su tenant
 * @param {string} userId - UID del usuario
 * @param {string} permission - Permiso a verificar
 * @returns {Promise<boolean>} - True si tiene el permiso
 */
export const hasPermissionInUserTenant = async (userId, permission) => {
  try {
    const userRole = await getUserRole(userId, true);
    return hasPermission(userRole, permission, true);
  } catch (error) {
    console.error("Error verificando permiso en tenant:", error);
    return false;
  }
};

/**
 * Middleware function para verificar permisos antes de operaciones
 * @param {string} userId - UID del usuario
 * @param {string} permission - Permiso requerido
 * @returns {Promise<Object>} - Resultado de la verificación
 */
export const requirePermission = async (userId, permission) => {
  try {
    const hasPerms = await hasPermissionInUserTenant(userId, permission);
    if (!hasPerms) {
      return { 
        success: false, 
        error: "No tienes permisos para realizar esta operación",
        code: "INSUFFICIENT_PERMISSIONS"
      };
    }
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: "Error verificando permisos",
      code: "PERMISSION_CHECK_ERROR"
    };
  }
};