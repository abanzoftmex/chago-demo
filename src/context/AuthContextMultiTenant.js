/**
 * AuthContext actualizado para soporte multi-tenant
 * Mantiene compatibilidad con el sistema anterior
 */

import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { auth } from "../lib/firebase/firebaseConfig";

// Importar servicios multi-tenant
import {
  getUserTenantId,
  getUserTenantRole,
  getTenantInfo,
  hasPermissionInTenant,
  TENANT_ROLES,
} from "../lib/services/tenantService";

import {
  registerUserWithNewTenant,
  registerUserForExistingTenant,
  inviteUserToTenant,
  getUserCompleteInfo,
} from "../lib/services/userRegistrationService";

// Importar servicios de roles (legacy y tenant)
import {
  getUserRole,
  hasPermission,
  getRolePermissions,
  canAccessRoute,
  ROLES,
  loadRolePermissionsFromFirestore,
  reloadRolePermissions,
  requirePermission,
} from "../lib/services/roleServiceMultiTenant";

const AuthContext = createContext({
  TENANT_ROLES: {
    ADMIN: "admin",
    CONTADOR: "contador", 
    VIEWER: "viewer"
  },
  ROLES: {
    ADMINISTRATIVO: "administrativo",
    CONTADOR: "contador",
    DIRECTOR_GENERAL: "director_general"
  }
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  // Estados principales
  const [user, setUser] = useState(null);
  const [userRole, setUserRoleState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  
  // Estados específicos de multi-tenant
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [isLegacyUser, setIsLegacyUser] = useState(false);

  // Estados de actividad
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto logout después de 2 horas de inactividad
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas en milisegundos

  /**
   * Carga información completa del usuario (rol y tenant)
   * @param {string} userId - UID del usuario
   */
  const loadUserRole = async (userId) => {
    if (!userId) {
      setUserRoleState(null);
      setTenantInfo(null);
      setIsLegacyUser(false);
      return;
    }

    setRoleLoading(true);
    setTenantLoading(true);
    
    try {
      // Intentar cargar como usuario multi-tenant
      try {
        console.log(`🔍 Cargando información multi-tenant para usuario: ${userId}`);
        const tenantId = await getUserTenantId(userId);
        console.log(`📍 TenantId encontrado: ${tenantId}`);
        
        const tenantRole = await getUserTenantRole(tenantId, userId);
        console.log(`👤 Rol en tenant: ${tenantRole}`);
        
        const tenantInfoResult = await getTenantInfo(tenantId);
        console.log(`🏢 Información del tenant:`, tenantInfoResult);

        if (tenantInfoResult.success) {
          setUserRoleState(tenantRole);
          setTenantInfo({
            role: tenantRole,
            ...tenantInfoResult.tenant,
            id: tenantId, // always ensure id is the string tenantId, not overridden by tenant doc data
          });
          setIsLegacyUser(false);
          console.log(`✅ Usuario multi-tenant cargado: ${tenantRole} en tenant ${tenantId}`);
        }
      } catch (tenantError) {
        console.log("⚠️ Usuario no tiene tenant, intentando cargar como usuario legacy:", tenantError.message);
        
        // Cargar como usuario legacy
        await loadRolePermissionsFromFirestore();
        const legacyRole = await getUserRole(userId, false);
        
        if (legacyRole) {
          await reloadRolePermissions(legacyRole);
          console.log(`✅ Usuario legacy cargado: ${legacyRole}`);
        }
        
        setUserRoleState(legacyRole || TENANT_ROLES.VIEWER);
        setTenantInfo(null);
        setIsLegacyUser(true);
      }
    } catch (error) {
      console.error("Error loading user role and tenant:", error);
      setUserRoleState(TENANT_ROLES.VIEWER); // Rol por defecto más restrictivo
      setTenantInfo(null);
      setIsLegacyUser(true);
    } finally {
      setRoleLoading(false);
      setTenantLoading(false);
    }
  };

  /**
   * Función de login
   */
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setLastActivity(Date.now());
      // El rol y tenant se cargarán en el useEffect cuando el user cambie
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Función de logout
   */
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserRoleState(null);
      setTenantInfo(null);
      setIsLegacyUser(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * Función de reset de contraseña
   */
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  };

  /**
   * Función de actualizar contraseña
   */
  const updatePassword = async (currentPassword, newPassword) => {
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      // Re-authenticar usuario con contraseña actual
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Actualizar contraseña
      await firebaseUpdatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  };

  /**
   * NUEVAS FUNCIONES MULTI-TENANT
   */

  /**
   * Registrar usuario con nueva empresa
   */
  const registerWithNewTenant = async (userData) => {
    return await registerUserWithNewTenant(userData);
  };

  /**
   * Registrar usuario en tenant existente (solo admins)
   */
  const registerUserInTenant = async (userData, role) => {
    if (!user || !tenantInfo) {
      return { success: false, error: "No estás autenticado o no tienes tenant" };
    }

    return await registerUserForExistingTenant(userData, tenantInfo.id, user.uid);
  };

  /**
   * Invitar usuario al tenant actual (solo admins)
   */
  const inviteUserToCurrentTenant = async (userData, role) => {
    if (!user || !tenantInfo) {
      return { success: false, error: "No estás autenticado o no tienes tenant" };
    }

    return await inviteUserToTenant(userData, tenantInfo.id, user.uid);
  };

  /**
   * Verificar si el usuario actual tiene un permiso
   */
  const checkPermission = (permission) => {
    if (isLegacyUser) {
      return hasPermission(userRole, permission, false);
    } else {
      return hasPermission(userRole, permission, true);
    }
  };

  /**
   * Verificar si el usuario puede acceder a una ruta
   */
  const canUserAccessRoute = (routePath) => {
    return canAccessRoute(userRole, routePath, !isLegacyUser);
  };

  /**
   * Obtener permisos del usuario actual
   */
  const getUserPermissions = () => {
    return getRolePermissions(userRole, !isLegacyUser);
  };

  /**
   * Recargar información del tenant actual
   */
  const refreshTenantInfo = async () => {
    if (user && tenantInfo) {
      setTenantLoading(true);
      try {
        const result = await getTenantInfo(tenantInfo.id);
        if (result.success) {
          setTenantInfo({
            ...result.tenant,
            id: tenantInfo.id, // keep the known string id last so it always wins
          });
        }
      } catch (error) {
        console.error("Error refreshing tenant info:", error);
      } finally {
        setTenantLoading(false);
      }
    }
  };

  /**
   * Verificar permiso específico en el tenant actual
   */
  const hasCurrentTenantPermission = async (permission) => {
    if (!user || !tenantInfo) {
      return false;
    }

    try {
      return await hasPermissionInTenant(tenantInfo.id, user.uid, permission);
    } catch (error) {
      console.error("Error checking tenant permission:", error);
      return false;
    }
  };

  /**
   * Middleware para verificar permisos antes de operaciones
   */
  const requireUserPermission = async (permission) => {
    if (!user) {
      return { 
        success: false, 
        error: "Usuario no autenticado",
        code: "NOT_AUTHENTICATED"
      };
    }

    if (isLegacyUser) {
      const hasPerms = hasPermission(userRole, permission, false);
      if (!hasPerms) {
        return { 
          success: false, 
          error: "No tienes permisos para realizar esta operación",
          code: "INSUFFICIENT_PERMISSIONS"
        };
      }
      return { success: true };
    } else {
      return await requirePermission(user.uid, permission);
    }
  };

  /**
   * Actualizar actividad del usuario
   */
  const updateActivity = () => {
    setLastActivity(Date.now());
  };

  // Verificar inactividad y auto logout
  useEffect(() => {
    if (!user) return;

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        logout();
      }
    };

    const interval = setInterval(checkInactivity, 60000); // Verificar cada minuto
    return () => clearInterval(interval);
  }, [user, lastActivity]);

  // Escuchar eventos de actividad
  useEffect(() => {
    if (!user) return;

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      updateActivity();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [user]);

  // Escuchar cambios en el estado de autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        setLastActivity(Date.now());
        loadUserRole(user.uid);
      } else {
        setUserRoleState(null);
        setTenantInfo(null);
        setIsLegacyUser(false);
      }
    });

    return unsubscribe;
  }, []);

  // Valores del contexto
  const value = {
    // Estados principales
    user,
    userRole,
    roleLoading,
    loading,

    // Estados multi-tenant
    tenantInfo,
    tenantLoading,
    isLegacyUser,

    // Funciones de autenticación
    login,
    logout,
    resetPassword,
    updatePassword,

    // Funciones multi-tenant
    registerWithNewTenant,
    registerUserInTenant,
    inviteUserToCurrentTenant,
    refreshTenantInfo,
    hasCurrentTenantPermission,

    // Funciones de permisos
    checkPermission,
    getUserPermissions,
    canUserAccessRoute,
    requireUserPermission,

    // Funciones de actividad
    updateActivity,

    // Constantes
    ROLES,
    TENANT_ROLES,

    // Funciones legacy (mantener compatibilidad)
    updateUserRole: async (userId, role, userInfo = {}) => {
      // Esta función mantiene compatibilidad con el sistema anterior
      console.warn("updateUserRole is deprecated in multi-tenant system");
      return { success: false, error: "Use tenant-specific user management" };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
};