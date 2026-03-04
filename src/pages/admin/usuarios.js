import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import AdminLayout from "../../components/layout/AdminLayout";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import CreateUserModal from "../../components/admin/CreateUserModal";
import RolePermissionsModal from "../../components/admin/RolePermissionsModal";
import UserList from "../../components/admin/UserList";
import { getTenantUsers } from "../../lib/services/roleServiceMultiTenant";
import { PlusIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import Toast from "../../components/ui/Toast";

const UsersPage = () => {
  const { user, userRole, tenantInfo, TENANT_ROLES, loading: authLoading, tenantLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [toast, setToast] = useState(null);

  console.log("🎨 RENDER - authLoading:", authLoading);
  console.log("🎨 RENDER - tenantLoading:", tenantLoading);
  console.log("🎨 RENDER - tenantInfo:", tenantInfo);
  console.log("🎨 RENDER - user:", user?.email);

  const loadUsers = async () => {
    setLoading(true);
    try {
      console.log("🔍 loadUsers - tenantInfo:", tenantInfo);
      console.log("🔍 loadUsers - tenantId:", tenantInfo?.id);
      console.log("🔍 loadUsers - user:", user);
      
      if (!tenantInfo?.id) {
        console.error("❌ No hay tenant asignado");
        throw new Error("No hay tenant asignado");
      }
      
      console.log(`📋 Cargando usuarios del tenant: ${tenantInfo.id}`);
      const result = await getTenantUsers(tenantInfo.id);
      console.log("📊 Resultado getTenantUsers:", result);
      
      if (result.success) {
        console.log(`✅ Usuarios cargados: ${result.users.length}`);
        setUsers(result.users);
      } else {
        console.error("❌ Error en getTenantUsers:", result.error);
        setToast({
          type: "error",
          message: "Error cargando usuarios: " + result.error,
        });
      }
    } catch (error) {
      console.error("❌ Error en loadUsers:", error);
      setToast({
        type: "error",
        message: "Error cargando usuarios: " + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (userData) => {
    setEditingUser(userData);
  };

  const handleUserUpdated = () => {
    loadUsers();
    setShowCreateModal(false);
    setEditingUser(null);
    setToast({
      type: "success",
      message: editingUser ? "Usuario actualizado exitosamente" : "Usuario creado exitosamente",
    });
  };

  // useEffect - Siempre se ejecuta, lógica condicional dentro
  useEffect(() => {
    // Solo cargar si no está cargando auth/tenant y hay tenantInfo
    if (authLoading || tenantLoading || !tenantInfo?.id || !TENANT_ROLES) {
      console.log("🔄 useEffect - Skip: loading o sin tenant");
      return;
    }
    
    // Verificar si es admin
    const isAdmin = tenantInfo?.role === TENANT_ROLES.ADMIN;
    console.log("🔄 useEffect - isAdmin:", isAdmin, "role:", tenantInfo?.role);
    
    if (isAdmin) {
      console.log(`✅ Es admin, llamando loadUsers()`);
      loadUsers();
    } else {
      console.log(`❌ No es admin, skip loadUsers`);
      setLoading(false);
    }
  }, [authLoading, tenantLoading, tenantInfo?.id, tenantInfo?.role, TENANT_ROLES]);
  
  // Early returns DESPUÉS de todos los hooks
  if (authLoading || tenantLoading) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <p className="text-gray-600">Cargando información del tenant...</p>
        </div>
      </AdminLayout>
    );
  }
  
  // Verificar que tenga tenant asignado (solo después de que termine de cargar)
  if (!tenantInfo?.id) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <p className="text-red-600">No tienes acceso a un tenant. Contacta al administrador.</p>
          <p className="text-sm text-gray-500 mt-2">User: {user?.email}</p>
          <p className="text-sm text-gray-500">TenantInfo: {JSON.stringify(tenantInfo)}</p>
        </div>
      </AdminLayout>
    );
  }
  
  // Check if user can manage users
  const canManageUsers = TENANT_ROLES && tenantInfo?.role === TENANT_ROLES.ADMIN;




  // Función temporal para diagnosticar y solucionar problemas de permisos
  const fixPermissions = async () => {
    if (!user) {
      setToast({
        type: "error",
        message: "No hay usuario autenticado",
      });
      return;
    }

    try {
      console.log("=== INTENTANDO CORREGIR PERMISOS ===");
      console.log("Usuario:", user.email, "UID:", user.uid);

      // Importar las funciones necesarias
      const { setUserRole, reloadRolePermissions } = require("../../lib/services/roleService");

      // Primero, intentar recargar permisos del rol actual si existe
      if (userRole) {
        console.log("Intentando recargar permisos del rol actual:", userRole);
        await reloadRolePermissions(userRole);
      }

      // Otorgar rol de administrador
      console.log("Otorgando rol de administrador...");
      const result = await setUserRole(user.uid, "administrativo", {
        displayName: user.displayName || user.email,
        email: user.email
      });

      console.log("Resultado de setUserRole:", result);

      if (result.success) {
        // Recargar permisos del rol administrativo
        await reloadRolePermissions("administrativo");

        setToast({
          type: "success",
          message: "Permisos de administrador otorgados correctamente. Recargando...",
        });

        // Recargar la página para aplicar los cambios
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setToast({
          type: "error",
          message: "Error al otorgar permisos: " + result.error,
        });
      }
    } catch (error) {
      console.error("Error en fixPermissions:", error);
      setToast({
        type: "error",
        message: "Error al otorgar permisos: " + error.message,
      });
    }
  };

  // If user doesn't have permission to manage users, show access denied
  if (!canManageUsers) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Acceso Denegado
              </h1>
              <p className="text-gray-600 mb-6">
                No tienes permisos para gestionar usuarios.
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-sm font-medium text-green-900 mb-2">✅ Estado del Sistema:</h3>
                  <p className="text-xs text-green-700">
                    <strong>Usuario:</strong> {user?.email || 'No definido'}<br/>
                    <strong>Rol:</strong> {userRole || 'No definido'}<br/>
                    <strong>Permisos de gestión:</strong> {canManageUsers ? '✅ Habilitados' : '❌ Deshabilitados'}
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    El sistema de permisos está funcionando correctamente.
                  </p>
                </div>

                <button
                  onClick={fixPermissions}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Otorgar Permisos de Administrador
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Recargar Página
                </button>
              </div>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="md:flex md:items-center md:justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                  Gestión de Usuarios
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Administra los usuarios del sistema y sus roles
                </p>
              </div>
              <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">

                <button
                  onClick={() => setShowPermissionsModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <AdjustmentsHorizontalIcon className="-ml-1 mr-2 h-5 w-5" />
                  Gestionar Permisos
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Crear Usuario
                </button>
              </div>
            </div>

            <div className="mt-8">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-sm text-gray-600">
                    Cargando usuarios...
                  </p>
                </div>
              ) : (
                <UserList
                  users={users}
                  currentUserId={user?.uid}
                  onUserUpdated={handleUserUpdated}
                  onEditUser={handleEditUser}
                />
              )}
            </div>
          </div>
        </div>

        {/* Create/Edit User Modal */}
        {(showCreateModal || editingUser) && (
          <CreateUserModal
            editingUser={editingUser}
            onClose={() => {
              setShowCreateModal(false);
              setEditingUser(null);
            }}
            onUserCreated={handleUserUpdated}
          />
        )}

        {/* Role Permissions Modal */}
        {showPermissionsModal && (
          <RolePermissionsModal
            onClose={() => setShowPermissionsModal(false)}
          />
        )}

        {/* Toast Notifications */}
        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default UsersPage;
