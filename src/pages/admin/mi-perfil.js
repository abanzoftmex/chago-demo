import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { 
  UserCircleIcon, 
  EnvelopeIcon, 
  ShieldCheckIcon,
  CalendarIcon,
  KeyIcon,
  PencilIcon
} from "@heroicons/react/24/outline";

const MiPerfil = () => {
  const router = useRouter();
  const { user, userRole, ROLES, updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const toast = useToast();

  const getRoleDisplayName = (role) => {
    switch (role) {
      case ROLES?.ADMINISTRATIVO:
        return "Administrador";
      case ROLES?.CONTADOR:
        return "Contador";
      case ROLES?.DIRECTOR_GENERAL:
        return "Director General";
      default:
        return "Sin rol";
    }
  };

  const getRoleDescription = (role) => {
    switch (role) {
      case ROLES?.ADMINISTRATIVO:
        return "Acceso completo al sistema, gestión de usuarios y configuración";
      case ROLES?.CONTADOR:
        return "Gestión de transacciones, reportes y análisis financiero";
      case ROLES?.DIRECTOR_GENERAL:
        return "Visualización de reportes y análisis ejecutivo";
      default:
        return "Sin permisos asignados";
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      setLoading(true);
      await updatePassword(passwordData.currentPassword, passwordData.newPassword);
      toast.success("Contraseña actualizada exitosamente");
      setShowPasswordForm(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error("Error al actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "No disponible";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Mi Perfil"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Mi Perfil" },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-blue-600 rounded-xl shadow-lg">
                <UserCircleIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
                <p className="text-gray-600 mt-1">
                  Gestiona tu información personal y configuración de cuenta
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Information */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <UserCircleIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Información Personal
                      </h3>
                      <p className="text-sm text-gray-600">
                        Detalles de tu cuenta y perfil
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Avatar and Basic Info */}
                  <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-2xl font-bold">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold text-gray-900">
                        {user?.displayName || user?.email || 'Usuario'}
                      </h4>
                      <p className="text-gray-600">{getRoleDisplayName(userRole)}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Miembro desde {formatDate(user?.metadata?.creationTime)}
                      </p>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                        <EnvelopeIcon className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Email</p>
                          <p className="text-gray-900">{user?.email || 'No disponible'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                        <ShieldCheckIcon className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Rol</p>
                          <p className="text-gray-900">{getRoleDisplayName(userRole)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Role Description */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <ShieldCheckIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h5 className="font-medium text-blue-900 mb-1">Permisos del rol</h5>
                        <p className="text-sm text-blue-700">
                          {getRoleDescription(userRole)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="border-t border-gray-200 pt-6">
                    <h5 className="font-medium text-gray-900 mb-4">Detalles de la cuenta</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-600">Cuenta creada</p>
                          <p className="text-sm text-gray-900">
                            {formatDate(user?.metadata?.creationTime)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-600">Último acceso</p>
                          <p className="text-sm text-gray-900">
                            {formatDate(user?.metadata?.lastSignInTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Settings */}
            <div className="space-y-6">
              {/* Password Change */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-600 rounded-lg">
                      <KeyIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Seguridad
                      </h3>
                      <p className="text-sm text-gray-600">
                        Gestiona tu contraseña
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {!showPasswordForm ? (
                    <div className="text-center">
                      <KeyIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        Cambiar Contraseña
                      </h4>
                      <p className="text-gray-600 mb-4">
                        Actualiza tu contraseña para mantener tu cuenta segura
                      </p>
                      <button
                        onClick={() => setShowPasswordForm(true)}
                        className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-500/20 transition-all duration-200 font-medium"
                      >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        Cambiar Contraseña
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contraseña Actual
                        </label>
                        <input
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData(prev => ({
                            ...prev,
                            currentPassword: e.target.value
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nueva Contraseña
                        </label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData(prev => ({
                            ...prev,
                            newPassword: e.target.value
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          required
                          minLength={6}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Confirmar Nueva Contraseña
                        </label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData(prev => ({
                            ...prev,
                            confirmPassword: e.target.value
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          required
                          minLength={6}
                        />
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-500/20 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? "Actualizando..." : "Actualizar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setPasswordData({
                              currentPassword: "",
                              newPassword: "",
                              confirmPassword: ""
                            });
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Estado de la Cuenta
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-800">
                        Cuenta Activa
                      </span>
                    </div>
                    <span className="text-xs text-green-600">Verificada</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm font-medium text-blue-800">
                        Email Verificado
                      </span>
                    </div>
                    <span className="text-xs text-blue-600">
                      {user?.emailVerified ? "Sí" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default MiPerfil;