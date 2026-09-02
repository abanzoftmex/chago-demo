"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";



const SuperAdminContext = createContext(null);

export const useSuperAdmin = () => {
  const context = useContext(SuperAdminContext);
  if (!context) {
    throw new Error("useSuperAdmin debe usarse dentro de SuperAdminProvider");
  }
  return context;
};

/**
 * Estado compartido del superadmin: sesión maestra (cookie de setup) y
 * directorio de tenants. Todas las páginas del layout lo consumen.
 */
export function SuperAdminProvider({ children }) {
  // "checking" → validando cookie · "locked" → pedir clave · "ready" → dentro
  const [sessionState, setSessionState] = useState("checking");

  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const tenantsLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/setup-session");
        const data = await response.json();
        if (!cancelled) setSessionState(data.authorized ? "ready" : "locked");
      } catch (error) {
        console.error("Error validando sesión de setup:", error);
        if (!cancelled) setSessionState("locked");
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const verifyPassword = useCallback(async (password) => {
    const response = await fetch("/api/admin/verify-setup-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (response.ok && data.authorized) {
      setSessionState("ready");
      return { success: true };
    }

    return { error: data.message || "Contraseña incorrecta" };
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/setup-session", { method: "DELETE" });
    } catch (error) {
      console.error("Error cerrando sesión de setup:", error);
    } finally {
      tenantsLoadedRef.current = false;
      setTenants([]);
      setSessionState("locked");
    }
  }, []);

  /** Marca la sesión como expirada (para respuestas 401 de los endpoints). */
  const sessionExpired = useCallback(() => {
    tenantsLoadedRef.current = false;
    setSessionState("locked");
  }, []);

  /*
    El directorio se pide al servidor, no a Firestore.

    Desde aquí no se puede listar `/tenants`: el superadmin entra con la cookie
    de contraseña, no con Firebase Auth, así que para Firestore es un anónimo y
    ninguna regla puede autorizarlo. Funcionaba porque las reglas publicadas
    están abiertas; en cuanto se desplieguen las del repo, dejaría de funcionar.

    `/api/admin/tenants-directory` lo resuelve con Admin SDK detrás de esa
    misma cookie, y devuelve exactamente la misma forma de objeto.
  */
  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const response = await fetch("/api/admin/tenants-directory");
      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || "Error cargando tenants" };
      }

      setTenants(
        (data.tenants || []).map((tenant) => ({
          ...tenant,
          // El servidor manda ISO; las pantallas esperan Date.
          createdAt: tenant.createdAt ? new Date(tenant.createdAt) : null,
        }))
      );
      tenantsLoadedRef.current = true;
      return { success: true };
    } catch (error) {
      console.error("Error cargando tenants:", error);
      return { error: `Error cargando tenants: ${error.message}` };
    } finally {
      setTenantsLoading(false);
    }
  }, []);

  // Carga inicial del directorio al entrar
  useEffect(() => {
    if (sessionState === "ready" && !tenantsLoadedRef.current) {
      loadTenants();
    }
  }, [sessionState, loadTenants]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 1000 * 60 * 60 * 24 * 30;

    return {
      total: tenants.length,
      recent: tenants.filter(
        (tenant) => tenant.createdAt && now - tenant.createdAt.getTime() <= thirtyDays
      ).length,
      owners: tenants.filter((tenant) => tenant.adminEmail && tenant.adminEmail !== "—").length,
      lastCreatedAt: tenants[0]?.createdAt || null,
    };
  }, [tenants]);

  const value = useMemo(
    () => ({
      sessionState,
      verifyPassword,
      logout,
      sessionExpired,
      tenants,
      tenantsLoading,
      loadTenants,
      metrics,
    }),
    [sessionState, verifyPassword, logout, sessionExpired, tenants, tenantsLoading, loadTenants, metrics]
  );

  return <SuperAdminContext.Provider value={value}>{children}</SuperAdminContext.Provider>;
}
