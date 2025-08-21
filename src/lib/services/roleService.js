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
} from "firebase/firestore";


// Definición de roles
export const ROLES = {
  ADMINISTRATIVO: "administrativo",
  CONTADOR: "contador", 
  DIRECTOR_GENERAL: "director_general",
};

// Definición de permisos por rol (valores por defecto)
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

// Inicializar con los valores por defecto
export let ROLE_PERMISSIONS = { ...DEFAULT_ROLE_PERMISSIONS };

/**
 * Carga los permisos de roles desde Firestore
 */
export const loadRolePermissionsFromFirestore = async () => {
  try {
    console.log("Loading role permissions from Firestore...");
    // Cargar permisos para cada rol
    for (const role of Object.values(ROLES)) {
      const roleDoc = await getDoc(doc(db, "roles", role));
      if (roleDoc.exists() && roleDoc.data().permissions) {
        // Actualizar los permisos en memoria con los de Firestore
        ROLE_PERMISSIONS[role] = {
          ...DEFAULT_ROLE_PERMISSIONS[role], // Mantener valores por defecto para permisos no definidos
          ...roleDoc.data().permissions, // Sobrescribir con los valores de Firestore
        };
        console.log(`Loaded permissions for role ${role}:`, ROLE_PERMISSIONS[role]);
      }
    }
    return true;
  } catch (error) {
    console.error("Error loading role permissions from Firestore:", error);
    return false;
  }
};

// Cargar permisos al inicializar el servicio
loadRolePermissionsFromFirestore().catch(console.error);

/**
 * Obtiene el rol de un usuario
 */
export const getUserRole = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data().role || ROLES.ADMINISTRATIVO; // Por defecto administrativo
    }
    return ROLES.ADMINISTRATIVO; // Si no existe el documento, es administrativo
  } catch (error) {
    console.error("Error obteniendo rol del usuario:", error);
    return ROLES.ADMINISTRATIVO; // En caso de error, dar permisos de administrativo
  }
};

/**
 * Establece el rol de un usuario
 */
export const setUserRole = async (userId, role, userInfo = {}) => {
  try {
    const userData = {
      role,
      updatedAt: new Date(),
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
 */
export const hasPermission = (userRole, permission) => {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) {
    return false;
  }
  return ROLE_PERMISSIONS[userRole][permission] || false;
};

/**
 * Recarga los permisos de un rol específico desde Firestore
 */
export const reloadRolePermissions = async (role) => {
  try {
    if (!role || !Object.values(ROLES).includes(role)) {
      return { success: false, error: "Rol inválido" };
    }
    
    const roleDoc = await getDoc(doc(db, "roles", role));
    if (roleDoc.exists() && roleDoc.data().permissions) {
      // Actualizar los permisos en memoria
      ROLE_PERMISSIONS[role] = {
        ...DEFAULT_ROLE_PERMISSIONS[role],
        ...roleDoc.data().permissions,
      };
      console.log(`Reloaded permissions for role ${role}:`, ROLE_PERMISSIONS[role]);
      return { success: true };
    }
    return { success: false, error: "No se encontraron permisos para este rol" };
  } catch (error) {
    console.error(`Error reloading permissions for role ${role}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Obtiene todos los permisos de un rol
 */
export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || {};
};

/**
 * Verifica si un usuario puede acceder a una ruta específica
 */
export const canAccessRoute = (userRole, routePath) => {
  const permissions = getRolePermissions(userRole);

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
 * Obtiene todos los usuarios con sus roles
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
 * Actualiza el estado activo de un usuario
 */
export const updateUserStatus = async (userId, isActive) => {
  try {
    await updateDoc(doc(db, "users", userId), {
      isActive,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error actualizando estado del usuario:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Elimina un usuario del sistema
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
