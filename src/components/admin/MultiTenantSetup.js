/**
 * Componente de configuración inicial del sistema multi-tenant
 * Panel de administración para crear y listar tenants
 * Protegido por contraseña maestra (TENANT_SETUP_PASSWORD)
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import { db } from "../../lib/firebase/firebaseConfig";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import {
  createNewTenant,
} from "../../lib/helpers/migrationHelper";

const MultiTenantSetup = () => {
  const { user } = useAuth();

  // Autenticación de acceso
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);

  // Estados
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("crear");
  const [message, setMessage] = useState("");

  // Formularios
  const [tenantForm, setTenantForm] = useState({
    ownerEmail: "",
    ownerPassword: "",
    ownerName: "",
    nombreEmpresa: "",
  });

  // Cargar tenants cuando se autentique
  useEffect(() => {
    if (isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  const handleAccessSubmit = async (e) => {
    e.preventDefault();
    setAccessLoading(true);
    setAccessError("");

    try {
      const response = await fetch("/api/admin/verify-setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: accessPassword }),
      });

      const data = await response.json();

      if (response.ok && data.authorized) {
        setIsAuthenticated(true);
        setAccessPassword("");
      } else {
        setAccessError(data.message || "Contraseña incorrecta");
      }
    } catch (error) {
      setAccessError("Error al verificar la contraseña. Intenta de nuevo.");
    } finally {
      setAccessLoading(false);
    }
  };

  const loadTenants = async () => {
    setLoading(true);
    try {
      const tenantsRef = collection(db, "tenants");
      const tenantsSnap = await getDocs(tenantsRef);

      const tenantsList = [];

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantData = tenantDoc.data();

        // Obtener el admin (owner) del tenant desde members
        let adminEmail = "—";
        let adminName = "—";
        try {
          const membersRef = collection(db, `tenants/${tenantDoc.id}/members`);
          const membersSnap = await getDocs(membersRef);
          const adminMember = membersSnap.docs.find(
            (m) => m.data().role === "admin"
          );
          if (adminMember) {
            const memberData = adminMember.data();
            adminEmail = memberData.email || "—";
            adminName = memberData.displayName || memberData.email || "—";
          }
        } catch (err) {
          console.error("Error obteniendo miembros:", err);
        }

        tenantsList.push({
          id: tenantDoc.id,
          nombreEmpresa: tenantData.nombreEmpresa || "Sin nombre",
          adminEmail,
          adminName,
          createdAt: tenantData.createdAt?.toDate?.() || null,
        });
      }

      // Ordenar por fecha de creación (más reciente primero)
      tenantsList.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });

      setTenants(tenantsList);
    } catch (error) {
      console.error("Error cargando tenants:", error);
      setMessage(`❌ Error cargando tenants: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!tenantForm.ownerEmail || !tenantForm.ownerPassword || !tenantForm.ownerName || !tenantForm.nombreEmpresa) {
      setMessage("❌ Todos los campos son obligatorios");
      return;
    }

    if (tenantForm.ownerPassword.length < 6) {
      setMessage("❌ La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await createNewTenant(
        tenantForm.ownerEmail,
        tenantForm.ownerPassword,
        tenantForm.ownerName,
        tenantForm.nombreEmpresa
      );

      if (result.success) {
        setMessage(`✅ Tenant creado exitosamente!
        - Tenant ID: ${result.tenantId}
        - Usuario: ${result.user.email}
        - Empresa: ${result.nombreEmpresa}`);
        setTenantForm({
          ownerEmail: "",
          ownerPassword: "",
          ownerName: "",
          nombreEmpresa: "",
        });
        // Recargar lista de tenants
        loadTenants();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // PANTALLA DE ACCESO
  // =====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="w-full max-w-md">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4">
                <span className="text-3xl">🔐</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Panel de Administración
              </h1>
              <p className="text-gray-400 text-sm">
                Ingresa la contraseña maestra para acceder al configurador de tenants.
              </p>
            </div>

            <form onSubmit={handleAccessSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contraseña de acceso
                </label>
                <input
                  type="password"
                  value={accessPassword}
                  onChange={(e) => setAccessPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="••••••••••••"
                  autoFocus
                  required
                />
              </div>

              {accessError && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <p className="text-red-400 text-sm text-center">{accessError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={accessLoading || !accessPassword}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/25"
              >
                {accessLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  "Acceder"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =====================
  // TABS DEL PANEL
  // =====================

  const renderCrearTab = () => (
    <div className="space-y-6">
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-green-900 mb-3">
          🏢 Crear Nuevo Tenant
        </h3>
        <p className="text-green-700 mb-4">
          Crea un nuevo tenant con un usuario administrador. El usuario podrá iniciar sesión con las credenciales ingresadas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email del Admin</label>
            <input
              type="email"
              value={tenantForm.ownerEmail}
              onChange={(e) => setTenantForm({ ...tenantForm, ownerEmail: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="admin@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <input
              type="password"
              value={tenantForm.ownerPassword}
              onChange={(e) => setTenantForm({ ...tenantForm, ownerPassword: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nombre del Admin</label>
            <input
              type="text"
              value={tenantForm.ownerName}
              onChange={(e) => setTenantForm({ ...tenantForm, ownerName: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Juan Pérez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nombre de la Empresa</label>
            <input
              type="text"
              value={tenantForm.nombreEmpresa}
              onChange={(e) => setTenantForm({ ...tenantForm, nombreEmpresa: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Mi Empresa S.A."
            />
          </div>
        </div>

        <button
          onClick={handleCreateTenant}
          disabled={loading || !tenantForm.ownerEmail || !tenantForm.ownerPassword || !tenantForm.ownerName || !tenantForm.nombreEmpresa}
          className="mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded disabled:opacity-50 transition-colors"
        >
          {loading ? "Creando..." : "🏢 Crear Tenant"}
        </button>
      </div>
    </div>
  );

  const renderTenantsTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-blue-900">
            📋 Tenants Registrados
          </h3>
          <button
            onClick={loadTenants}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50 transition-colors"
          >
            {loading ? "Cargando..." : "🔄 Actualizar"}
          </button>
        </div>

        {loading && tenants.length === 0 && (
          <div className="text-blue-600 text-center py-8">Cargando tenants...</div>
        )}

        {!loading && tenants.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-3">🏢</div>
            <p className="font-medium">No hay tenants registrados</p>
            <p className="text-sm mt-1">Crea tu primer tenant en la pestaña "Crear Tenant".</p>
          </div>
        )}

        {tenants.length > 0 && (
          <>
            <div className="mb-3 text-sm text-blue-700">
              Total: <strong>{tenants.length}</strong> tenant{tenants.length !== 1 ? "s" : ""}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Empresa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Email Admin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Admin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Tenant ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏢</span>
                          <span className="font-semibold text-gray-900">
                            {tenant.nombreEmpresa}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {tenant.adminEmail}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {tenant.adminName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {tenant.createdAt
                          ? tenant.createdAt.toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                          {tenant.id.substring(0, 8)}...
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚀 Configuración Multi-Tenant
          </h1>
          <p className="text-gray-600">
            Panel de administración para crear tenants y gestionar el sistema multi-tenant.
          </p>
        </div>
        <button
          onClick={() => {
            setIsAuthenticated(false);
            setAccessPassword("");
          }}
          className="text-sm text-gray-500 hover:text-red-500 border border-gray-300 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          🔒 Cerrar sesión
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "crear", label: "➕ Crear Tenant", desc: "Crear nuevo tenant" },
            { id: "tenants", label: "📋 Tenants", desc: "Tenants registrados" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              {tab.label}
              <div className="text-xs text-gray-400">{tab.desc}</div>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-96">
        {activeTab === "crear" && renderCrearTab()}
        {activeTab === "tenants" && renderTenantsTab()}
      </div>

      {/* Message Area */}
      {message && (
        <div className={`mt-6 p-4 rounded-lg ${message.startsWith("✅") ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}>
          <pre className="text-sm whitespace-pre-wrap">{message}</pre>
          <button
            onClick={() => setMessage("")}
            className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
          >
            Cerrar mensaje
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          <p className="mb-2">
            📚 <strong>Documentación:</strong> Consulta MULTI_TENANT_GUIDE.md para guía completa
          </p>
        </div>
      </div>
    </div>
  );
};

export default MultiTenantSetup;