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
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase/firebaseConfig";

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

  const loadTenants = useCallback(async () => {
    setTenantsLoading(true);
    try {
      const tenantsSnap = await getDocs(collection(db, "tenants"));
      const list = [];

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantData = tenantDoc.data();

        let adminEmail = "—";
        let adminName = "—";
        let adminUid = tenantData.ownerUid || "";

        try {
          const membersSnap = await getDocs(collection(db, `tenants/${tenantDoc.id}/members`));
          const adminMember = membersSnap.docs.find((member) => member.data().role === "admin");

          if (adminMember) {
            const memberData = adminMember.data();
            adminUid = adminMember.id;
            adminEmail = memberData.email || "—";
            adminName = memberData.displayName || memberData.email || "—";
          }
        } catch (err) {
          console.error("Error obteniendo miembros:", err);
        }

        list.push({
          id: tenantDoc.id,
          ownerUid: adminUid,
          nombreEmpresa: tenantData.nombreEmpresa || "Sin nombre",
          adminEmail,
          adminName,
          createdAt: tenantData.createdAt?.toDate?.() || null,
        });
      }

      list.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });

      setTenants(list);
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
