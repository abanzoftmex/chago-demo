import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  TrashIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

const UserList = ({ users, currentUserId, onUserUpdated }) => {
  const { user, ROLES } = useAuth();
  const [loading, setLoading] = useState({});

  const getRoleDisplayName = (role) => {
    switch (role) {
      case ROLES.ADMINISTRATIVO:
        return "Administrador";
      case ROLES.CONTADOR:
        return "Contador";
      case ROLES.DIRECTOR_GENERAL:
        return "Director General";
      default:
        return "Sin rol";
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case ROLES.ADMINISTRATIVO:
        return "bg-blue-100 text-blue-800";
      case ROLES.CONTADOR:
        return "bg-green-100 text-green-800";
      case ROLES.DIRECTOR_GENERAL:
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleUserAction = async (userId, action) => {
    setLoading((prev) => ({ ...prev, [userId]: true }));

    try {
      const token = await user.getIdToken();
      const url = "/api/admin/manage-user";
      const method = action === "delete" ? "DELETE" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          action,
          currentUserToken: token,
        }),
      });

      if (response.ok) {
        onUserUpdated();
      } else {
        const data = await response.json();
        alert("Error: " + (data.message || "Error procesando solicitud"));
      }
    } catch (error) {
      alert("Error de conexión");
    } finally {
      setLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const confirmAction = (userId, action, userName) => {
    const actions = {
      delete: "eliminar",
      disable: "deshabilitar",
      enable: "habilitar",
    };

    if (
      confirm(
        `¿Estás seguro de que quieres ${actions[action]} al usuario ${userName}?`
      )
    ) {
      handleUserAction(userId, action);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {users.map((userData) => (
          <li key={userData.id}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {userData.displayName || userData.email}
                      </p>
                      {userData.id === currentUserId && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Tú
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <p className="truncate">{userData.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      userData.role
                    )}`}
                  >
                    {getRoleDisplayName(userData.role)}
                  </span>

                  <div className="flex items-center space-x-2">
                    {userData.isActive !== false ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Inactivo
                      </span>
                    )}
                  </div>

                  {userData.id !== currentUserId && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          confirmAction(
                            userData.id,
                            userData.isActive !== false ? "disable" : "enable",
                            userData.displayName || userData.email
                          )
                        }
                        disabled={loading[userData.id]}
                        className="relative inline-flex items-center cursor-pointer"
                      >
                        <div
                          className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                            userData.isActive !== false
                              ? "bg-blue-600"
                              : "bg-gray-200"
                          } ${
                            loading[userData.id] ? "opacity-50" : ""
                          }`}
                        >
                          <div
                            className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${
                              userData.isActive !== false
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </div>
                        {loading[userData.id] && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent"></div>
                          </div>
                        )}
                      </button>

                      <button
                        onClick={() =>
                          confirmAction(
                            userData.id,
                            "delete",
                            userData.displayName || userData.email
                          )
                        }
                        disabled={loading[userData.id]}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                        title="Eliminar usuario"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {userData.createdAt && (
                <div className="mt-2 text-xs text-gray-500">
                  Creado:{" "}
                  {new Date(
                    userData.createdAt.seconds * 1000
                  ).toLocaleDateString()}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {users.length === 0 && (
        <div className="text-center py-12">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No hay usuarios
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza creando un nuevo usuario.
          </p>
        </div>
      )}
    </div>
  );
};

export default UserList;
