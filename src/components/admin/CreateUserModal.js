import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { XMarkIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

const CreateUserModal = ({ onClose, onUserCreated, editingUser = null }) => {
  const { user, ROLES } = useAuth();
  const [formData, setFormData] = useState(() => {
    if (editingUser) {
      return {
        email: editingUser.email || "",
        password: "", // No mostrar la contraseña existente
        displayName: editingUser.displayName || "",
        role: editingUser.role || ROLES.ADMINISTRATIVO,
      };
    }
    return {
      email: "",
      password: "",
      displayName: "",
      role: ROLES.ADMINISTRATIVO,
    };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Get current user token
      const token = await user.getIdToken();

      const endpoint = editingUser ? "/api/admin/update-user" : "/api/admin/create-user";
      const method = editingUser ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          userId: editingUser?.id,
          currentUserToken: token,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onUserCreated();
      } else {
        setError(data.message || `Error ${editingUser ? 'actualizando' : 'creando'} usuario`);
      }
    } catch (error) {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600/50 backdrop-blur-lg overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email {editingUser ? "(no editable)" : "*"}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={editingUser}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="usuario@ejemplo.com"
            />
            {editingUser && (
              <p className="mt-1 text-xs text-gray-500">
                El email no se puede cambiar por motivos de seguridad
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre para mostrar
            </label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              placeholder="Nombre del usuario"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Contraseña {editingUser ? "(opcional)" : "*"}
            </label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                required={!editingUser}
                minLength={editingUser ? 0 : 6}
                value={formData.password}
                onChange={handleChange}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary pr-10"
                placeholder={editingUser ? "Dejar vacío para mantener la actual" : "Mínimo 6 caracteres"}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <EyeIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700"
            >
              Rol *
            </label>
            <select
              id="role"
              name="role"
              required
              value={formData.role}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value={ROLES.ADMINISTRATIVO}>Administrador</option>
              <option value={ROLES.CONTADOR}>Contador</option>
              <option value={ROLES.DIRECTOR_GENERAL}>Director General</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? (editingUser ? "Actualizando..." : "Creando...") : (editingUser ? "Actualizar Usuario" : "Crear Usuario")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;
