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
import {
  getUserRole,
  setUserRole,
  hasPermission,
  getRolePermissions,
  canAccessRoute,
  ROLES,
  loadRolePermissionsFromFirestore,
  reloadRolePermissions,
} from "../lib/services/roleService";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRoleState] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto logout after 2 hours of inactivity
  const INACTIVITY_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  // Load user role and permissions
  const loadUserRole = async (userId) => {
    if (!userId) {
      setUserRoleState(null);
      return;
    }

    setRoleLoading(true);
    try {
      // Load user role
      const role = await getUserRole(userId);
      
      // Load role permissions from Firestore to ensure we have the latest
      await loadRolePermissionsFromFirestore();
      
      // If we have a specific role, make sure its permissions are up to date
      if (role) {
        await reloadRolePermissions(role);
      }
      
      console.log(`Loaded role ${role} with permissions:`, getRolePermissions(role));
      setUserRoleState(role);
    } catch (error) {
      console.error("Error loading user role and permissions:", error);
      setUserRoleState(ROLES.ADMINISTRATIVO); // Default to administrativo on error
    } finally {
      setRoleLoading(false);
    }
  };

  // Login function
  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setLastActivity(Date.now());
      // Role will be loaded in the useEffect when user changes
      return { success: true, user: result.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserRoleState(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Reset password function
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Update password function
  const updatePassword = async (currentPassword, newPassword) => {
    if (!user) {
      throw new Error("No user logged in");
    }

    try {
      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await firebaseUpdatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  };

  // Update last activity
  const updateActivity = () => {
    setLastActivity(Date.now());
  };

  // Check for inactivity and auto logout
  useEffect(() => {
    if (!user) return;

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        logout();
      }
    };

    const interval = setInterval(checkInactivity, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user, lastActivity]);

  // Listen for activity events
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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        setLastActivity(Date.now());
        loadUserRole(user.uid);
      } else {
        setUserRoleState(null);
      }
    });

    return unsubscribe;
  }, []);

  // Helper functions for role management
  const checkPermission = (permission) => {
    return hasPermission(userRole, permission);
  };

  const getUserPermissions = () => {
    return getRolePermissions(userRole);
  };

  const canUserAccessRoute = (routePath) => {
    return canAccessRoute(userRole, routePath);
  };

  const updateUserRole = async (userId, role, userInfo = {}) => {
    const result = await setUserRole(userId, role, userInfo);
    if (result.success && userId === user?.uid) {
      setUserRoleState(role);
    }
    return result;
  };

  const value = {
    user,
    userRole,
    roleLoading,
    loading,
    login,
    logout,
    resetPassword,
    updatePassword,
    updateActivity,
    checkPermission,
    getUserPermissions,
    canUserAccessRoute,
    updateUserRole,
    ROLES,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
