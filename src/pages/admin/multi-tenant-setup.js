/**
 * Página de setup multi-tenant
 * Punto de entrada para configurar el sistema multi-tenant
 */

import { useState, useEffect } from "react";
import Head from "next/head";
import MultiTenantSetup from "../../components/admin/MultiTenantSetup";
import { useAuth } from "../../context/AuthContextMultiTenant";

export default function MultiTenantSetupPage() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Evitar hidration mismatch
  if (!mounted) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando sistema multi-tenant...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Setup Multi-Tenant | Sistema Financiero</title>
        <meta name="description" content="Configuración del sistema multi-tenant" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <MultiTenantSetup />
      </div>
    </>
  );
}