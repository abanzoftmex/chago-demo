import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../components/layout/AdminLayout";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import CreateUserModal from "../../components/admin/CreateUserModal";
import RolePermissionsModal from "../../components/admin/RolePermissionsModal";
import UserList from "../../components/admin/UserList";
import { getAllUsers } from "../../lib/services/roleService";
import { PlusIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import Toast from "../../components/ui/Toast";

const UsersPage = () => {
  const { user, checkPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Check if user can manage users
  const canManageUsers = checkPermission("canManageUsers");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await getAllUsers();
      if (result.success) {
        setUsers(result.users);
      } else {
        setToast({
          type: "error",
          message: "Error cargando usuarios: " + result.error,
        });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: "Error cargando usuarios",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) {
      loadUsers();
    }
  }, [canManageUsers]);

  const handleUserCreated = () => {
    setShowCreateModal(false);
    loadUsers();
    setToast({
      type: "success",
      message: "Usuario creado exitosamente",
    });
  };

  const handleUserUpdated = () => {
    loadUsers();
    setToast({
      type: "success",
      message: "Usuario actualizado exitosamente",
    });
  };

  // If user doesn't have permission to manage users, show access denied
  if (!canManageUsers) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                Acceso Denegado
              </h1>
              <p className="text-gray-600">
                No tienes permisos para gestionar usuarios.
              </p>
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
                />
              )}
            </div>
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onUserCreated={handleUserCreated}
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
