/**
 * Componente de ejemplo para demostrar el uso del AuthContext multi-tenant
 * Muestra cómo implementar registro, login y gestión de usuarios
 */

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";

const MultiTenantExample = () => {
  const {
    // Estados
    user,
    userRole,
    tenantInfo,
    loading,
    roleLoading,
    tenantLoading,
    isLegacyUser,
    
    // Funciones
    login,
    logout,
    registerWithNewTenant,
    inviteUserToCurrentTenant,
    checkPermission,
    refreshTenantInfo,
    
    // Constantes
    TENANT_ROLES,
  } = useAuth();

  // Estados locales
  const [activeTab, setActiveTab] = useState("dashboard");
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    displayName: "",
    nombreEmpresa: "",
  });
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [inviteForm, setInviteForm] = useState({
    email: "",
    displayName: "",
    role: TENANT_ROLES.VIEWER,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState("");

  // Handle registro con nuevo tenant
  const handleRegisterWithTenant = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage("");

    try {
      const result = await registerWithNewTenant(registerForm);
      
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        setRegisterForm({
          email: "",
          password: "",
          displayName: "",
          nombreEmpresa: "",
        });
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error inesperado: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage("");

    try {
      const result = await login(loginForm.email, loginForm.password);
      
      if (result.success) {
        setMessage("✅ Login exitoso");
        setLoginForm({ email: "", password: "" });
        setActiveTab("dashboard");
      } else {
        setMessage(`❌ Error de login: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error inesperado: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle invitar usuario
  const handleInviteUser = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setMessage("");

    try {
      const result = await inviteUserToCurrentTenant(inviteForm, inviteForm.role);
      
      if (result.success) {
        setMessage(`✅ ${result.message}`);
        setInviteForm({
          email: "",
          displayName: "",
          role: TENANT_ROLES.VIEWER,
        });
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error inesperado: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Limpiar mensaje después de 5 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Mostrar loading
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Cargando sistema multi-tenant...</div>
      </div>
    );
  }

  // Si no está autenticado, mostrar login/registro
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <div className="mb-4">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("login")}
              className={`px-4 py-2 ${activeTab === "login" ? "border-b-2 border-blue-500" : ""}`}
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2 ${activeTab === "register" ? "border-b-2 border-blue-500" : ""}`}
            >
              Registrar Empresa
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
            {message}
          </div>
        )}

        {activeTab === "login" && (
          <form onSubmit={handleLogin}>
            <h2 className="text-xl font-bold mb-4">Iniciar Sesión</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Contraseña</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-blue-500 text-white p-2 rounded disabled:opacity-50"
            >
              {isProcessing ? "Ingresando..." : "Iniciar Sesión"}
            </button>
          </form>
        )}

        {activeTab === "register" && (
          <form onSubmit={handleRegisterWithTenant}>
            <h2 className="text-xl font-bold mb-4">Registrar Nueva Empresa</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Nombre de la Empresa</label>
              <input
                type="text"
                value={registerForm.nombreEmpresa}
                onChange={(e) => setRegisterForm({...registerForm, nombreEmpresa: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Nombre del Administrador</label>
              <input
                type="text"
                value={registerForm.displayName}
                onChange={(e) => setRegisterForm({...registerForm, displayName: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={registerForm.email}
                onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Contraseña</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                className="w-full p-2 border rounded"
                required
                minLength="6"
              />
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-green-500 text-white p-2 rounded disabled:opacity-50"
            >
              {isProcessing ? "Registrando..." : "Crear Empresa"}
            </button>
          </form>
        )}
      </div>
    );
  }

  // Usuario autenticado - mostrar dashboard
  return (
    <div className="max-w-4xl mx-auto mt-8 p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Multi-Tenant</h1>
            <p className="text-gray-600">Bienvenido, {user.displayName || user.email}</p>
          </div>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Estado de carga */}
      {(roleLoading || tenantLoading) && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          Cargando información del tenant y permisos...
        </div>
      )}

      {/* Información del usuario y tenant */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Info del Usuario */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4">Tu Información</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Email:</span> {user.email}</p>
            <p><span className="font-medium">Rol:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                userRole === TENANT_ROLES.ADMIN ? "bg-red-100 text-red-800" :
                userRole === TENANT_ROLES.CONTADOR ? "bg-blue-100 text-blue-800" :
                "bg-gray-100 text-gray-800"
              }`}>
                {userRole}
              </span>
            </p>
            <p><span className="font-medium">Sistema:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                isLegacyUser ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"
              }`}>
                {isLegacyUser ? "Legacy" : "Multi-tenant"}
              </span>
            </p>
          </div>
        </div>

        {/* Info del Tenant */}
        {tenantInfo && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Información de la Empresa</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Empresa:</span> {tenantInfo.nombreEmpresa}</p>
              <p><span className="font-medium">Tenant ID:</span> 
                <span className="font-mono text-sm">{tenantInfo.id}</span>
              </p>
              <p><span className="font-medium">Propietario:</span> 
                {tenantInfo.ownerUid === user.uid ? "Sí" : "No"}
              </p>
            </div>
            <button
              onClick={refreshTenantInfo}
              className="mt-4 bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
            >
              Actualizar Info
            </button>
          </div>
        )}
      </div>

      {/* Permisos del Usuario */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Tus Permisos</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: "canCreateEntradas", label: "Crear Entradas" },
            { key: "canCreateSalidas", label: "Crear Salidas" },
            { key: "canDeleteTransactions", label: "Eliminar Transacciones" },
            { key: "canViewReports", label: "Ver Reportes" },
            { key: "canCreateUsers", label: "Crear Usuarios" },
            { key: "canManageSettings", label: "Configuración" },
          ].map((permission) => (
            <div
              key={permission.key}
              className={`p-2 rounded text-sm text-center ${
                checkPermission(permission.key)
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {permission.label}
              <br />
              {checkPermission(permission.key) ? "✓" : "✗"}
            </div>
          ))}
        </div>
      </div>

      {/* Invitar Usuarios (solo para admins) */}
      {checkPermission("canCreateUsers") && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Invitar Usuario al Tenant</h2>
          
          {message && (
            <div className="mb-4 p-3 bg-gray-100 rounded text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleInviteUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <input
                type="text"
                value={inviteForm.displayName}
                onChange={(e) => setInviteForm({...inviteForm, displayName: e.target.value})}
                className="w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Rol</label>
              <select
                value={inviteForm.role}
                onChange={(e) => setInviteForm({...inviteForm, role: e.target.value})}
                className="w-full p-2 border rounded"
              >
                <option value={TENANT_ROLES.VIEWER}>Viewer</option>
                <option value={TENANT_ROLES.CONTADOR}>Contador</option>
                <option value={TENANT_ROLES.ADMIN}>Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-green-500 text-white p-2 rounded disabled:opacity-50"
              >
                {isProcessing ? "Invitando..." : "Invitar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Acciones Rápidas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Acciones Disponibles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {checkPermission("canCreateEntradas") && (
            <button className="p-4 bg-green-100 text-green-800 rounded hover:bg-green-200">
              💰 Crear Entrada
            </button>
          )}
          
          {checkPermission("canCreateSalidas") && (
            <button className="p-4 bg-red-100 text-red-800 rounded hover:bg-red-200">
              💸 Crear Salida
            </button>
          )}
          
          {checkPermission("canViewReports") && (
            <button className="p-4 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
              📊 Ver Reportes
            </button>
          )}
          
          {checkPermission("canManageSettings") && (
            <button className="p-4 bg-purple-100 text-purple-800 rounded hover:bg-purple-200">
              ⚙️ Configuración
            </button>
          )}
          
        </div>
      </div>

      {/* Información del Sistema Legacy */}
      {isLegacyUser && (
        <div className="mt-6 bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded">
          <strong>Nota:</strong> Estás usando el sistema anterior. 
          <a href="#migrate" className="underline ml-2">
            Haz clic aquí para migrar al sistema multi-tenant
          </a>
        </div>
      )}
    </div>
  );
};

export default MultiTenantExample;