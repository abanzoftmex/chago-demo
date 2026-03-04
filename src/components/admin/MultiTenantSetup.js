/**
 * Componente de configuración inicial del sistema multi-tenant
 * Panel de administración para migración y setup inicial
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import {
  generatePreMigrationReport,
  migrateUserToMultiTenant,
  createDemoTenant,
  checkMigrationStatus,
} from "../../lib/helpers/migrationHelper";

const MultiTenantSetup = () => {
  const { user, userRole, tenantInfo, TENANT_ROLES, registerWithNewTenant } = useAuth();
  
  // Estados
  const [migrationReport, setMigrationReport] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("status");
  const [message, setMessage] = useState("");
  
  // Formularios
  const [demoForm, setDemoForm] = useState({
    ownerEmail: "admin@demo.com",
    ownerPassword: "Demo123!",
    ownerName: "Admin Demo",
    nombreEmpresa: "Empresa Demo",
  });

  const [migrationForm, setMigrationForm] = useState({
    nombreEmpresa: "Mi Empresa",
  });

  // Cargar estado inicial
  useEffect(() => {
    loadMigrationStatus();
  }, []);

  const loadMigrationStatus = async () => {
    setLoading(true);
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status.success ? status : null);
      
      const report = await generatePreMigrationReport();
      setMigrationReport(report.success ? report.report : null);
    } catch (error) {
      console.error("Error cargando estado:", error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const result = await createDemoTenant(
        demoForm.ownerEmail,
        demoForm.ownerPassword,
        demoForm.ownerName,
        demoForm.nombreEmpresa
      );
      
      if (result.success) {
        setMessage(`✅ Tenant de demostración creado exitosamente!
        - Tenant ID: ${result.tenantId}
        - Usuario: ${result.user.email}
        - Empresa: ${result.nombreEmpresa}`);
        loadMigrationStatus();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMigrateCurrentUser = async () => {
    if (!user) {
      setMessage("❌ Usuario no autenticado");
      return;
    }

    setLoading(true);
    setMessage("");
    
    try {
      const result = await migrateUserToMultiTenant(
        user.uid,
        migrationForm.nombreEmpresa
      );
      
      if (result.success) {
        setMessage(`✅ Usuario migrado exitosamente!
        - Usuario ID: ${result.userId}
        - Tenant ID: ${result.tenantId}
        - Rol: ${result.role}
        
        Recarga la página para ver los cambios.`);
        loadMigrationStatus();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStatusTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          📊 Estado del Sistema Multi-Tenant
        </h3>
        
        {loading && (
          <div className="text-blue-600">Cargando estado...</div>
        )}
        
        {migrationStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded">
              <div className="text-2xl font-bold text-blue-600">
                {migrationStatus.total}
              </div>
              <div className="text-sm text-gray-600">Total Usuarios</div>
            </div>
            <div className="bg-white p-3 rounded">
              <div className="text-2xl font-bold text-green-600">
                {migrationStatus.migrated}
              </div>
              <div className="text-sm text-gray-600">Migrados</div>
            </div>
            <div className="bg-white p-3 rounded">
              <div className="text-2xl font-bold text-orange-600">
                {migrationStatus.pending}
              </div>
              <div className="text-sm text-gray-600">Pendientes</div>
            </div>
            <div className="bg-white p-3 rounded">
              <div className={`text-2xl font-bold ${
                migrationStatus.migrationComplete ? "text-green-600" : "text-orange-600"
              }`}>
                {migrationStatus.migrationComplete ? "✅" : "⏳"}
              </div>
              <div className="text-sm text-gray-600">Estado</div>
            </div>
          </div>
        )}
      </div>

      {migrationReport && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            📋 Reporte de Pre-Migración
          </h3>
          
          {migrationReport && migrationReport.userDetails && migrationReport.userDetails.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Usuario
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Rol
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Tenant
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {migrationReport.userDetails.slice(0, 10).map((userDetail, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{userDetail.displayName || "Sin nombre"}</div>
                          <div className="text-gray-500 text-xs">{userDetail.email}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          userDetail.role === 'administrativo' ? 'bg-red-100 text-red-800' :
                          userDetail.role === 'contador' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {userDetail.role || 'Sin rol'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {userDetail.hasTenant ? (
                          <span className="text-green-600 text-xs font-mono">
                            {userDetail.tenantId.substring(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-orange-600 text-xs">Sin tenant</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          userDetail.hasTenant ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {userDetail.hasTenant ? 'Migrado' : 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {migrationReport && migrationReport.userDetails && migrationReport.userDetails.length > 10 && (
                <div className="mt-2 text-sm text-gray-500 text-center">
                  Mostrando 10 de {migrationReport.userDetails.length} usuarios
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="flex space-x-4">
        <button
          onClick={loadMigrationStatus}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Actualizando..." : "🔄 Actualizar Estado"}
        </button>
      </div>
    </div>
  );

  const renderDemoTab = () => (
    <div className="space-y-6">
      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-green-900 mb-3">
          🎬 Crear Tenant de Demostración
        </h3>
        <p className="text-green-700 mb-4">
          Crea un tenant completo con datos de ejemplo para probar el sistema.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email del Admin</label>
            <input
              type="email"
              value={demoForm.ownerEmail}
              onChange={(e) => setDemoForm({...demoForm, ownerEmail: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="admin@demo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <input
              type="password"
              value={demoForm.ownerPassword}
              onChange={(e) => setDemoForm({...demoForm, ownerPassword: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Demo123!"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nombre del Admin</label>
            <input
              type="text"
              value={demoForm.ownerName}
              onChange={(e) => setDemoForm({...demoForm, ownerName: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Admin Demo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nombre de la Empresa</label>
            <input
              type="text"
              value={demoForm.nombreEmpresa}
              onChange={(e) => setDemoForm({...demoForm, nombreEmpresa: e.target.value})}
              className="w-full p-2 border rounded"
              placeholder="Empresa Demo"
            />
          </div>
        </div>
        
        <button
          onClick={handleCreateDemo}
          disabled={loading}
          className="mt-4 bg-green-500 text-white px-6 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Creando..." : "🎬 Crear Tenant Demo"}
        </button>
      </div>
    </div>
  );

  const renderMigrationTab = () => (
    <div className="space-y-6">
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-900 mb-3">
          📦 Migración de Usuario Actual
        </h3>
        <p className="text-yellow-700 mb-4">
          {user ? (
            tenantInfo ? 
              `Ya estás en un tenant: ${tenantInfo.nombreEmpresa}` :
              `Migra tu usuario (${user.email}) al sistema multi-tenant.`
          ) : (
            "Debes estar autenticado para migrar."
          )}
        </p>
        
        {user && !tenantInfo && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Nombre de tu Empresa</label>
              <input
                type="text"
                value={migrationForm.nombreEmpresa}
                onChange={(e) => setMigrationForm({...migrationForm, nombreEmpresa: e.target.value})}
                className="w-full p-2 border rounded"
                placeholder="Mi Empresa SAC"
              />
            </div>
            
            <button
              onClick={handleMigrateCurrentUser}
              disabled={loading}
              className="bg-yellow-500 text-white px-6 py-2 rounded disabled:opacity-50"
            >
              {loading ? "Migrando..." : "📦 Migrar Mi Usuario"}
            </button>
          </>
        )}
        
        {tenantInfo && (
          <div className="bg-green-100 p-3 rounded">
            <p className="text-green-800">
              ✅ Ya estás migrado al sistema multi-tenant.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🚀 Configuración Multi-Tenant
        </h1>
        <p className="text-gray-600">
          Panel de administración para configurar y migrar al sistema multi-tenant.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: "status", label: "📊 Estado", desc: "Estado del sistema" },
            { id: "demo", label: "🎬 Demo", desc: "Crear tenant demo" },
            { id: "migration", label: "📦 Migración", desc: "Migrar usuarios" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
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
        {activeTab === "status" && renderStatusTab()}
        {activeTab === "demo" && renderDemoTab()}
        {activeTab === "migration" && renderMigrationTab()}
      </div>

      {/* Message Area */}
      {message && (
        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
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
          <p className="mb-2">
            🔧 <strong>Scripts disponibles:</strong>
          </p>
          <ul className="ml-4 space-y-1">
            <li>• <code>npm run setup-multi-tenant</code> - Configuración completa</li>
            <li>• <code>npm run deploy-rules</code> - Desplegar reglas de Firestore</li>
            <li>• <code>npm run deploy-indexes</code> - Desplegar índices</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MultiTenantSetup;