import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { ROLE_PERMISSIONS, ROLES } from "../../lib/services/roleService";
import PermissionCheckbox from "./PermissionCheckbox";
import { db } from "../../lib/firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const RolePermissionsModal = ({ onClose }) => {
  const { user, userRole } = useAuth();
  const [permissions, setPermissions] = useState({});
  const [selectedRole, setSelectedRole] = useState(ROLES.ADMINISTRATIVO);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load permissions for the selected role from Firestore
  useEffect(() => {
    const fetchRolePermissions = async () => {
      try {
        setLoading(true);
        // First try to get permissions from Firestore
        const roleDoc = await getDoc(doc(db, "roles", selectedRole));
        
        if (roleDoc.exists() && roleDoc.data().permissions) {
          // Use permissions from Firestore if they exist
          setPermissions(roleDoc.data().permissions);
        } else {
          // Fall back to default permissions if not in Firestore
          setPermissions(ROLE_PERMISSIONS[selectedRole] || {});
        }
      } catch (error) {
        // Fall back to default permissions on error
        setPermissions(ROLE_PERMISSIONS[selectedRole] || {});
      } finally {
        setLoading(false);
      }
    };
    
    fetchRolePermissions();
  }, [selectedRole]);


  const handleRoleChange = (e) => {
    setSelectedRole(e.target.value);
  };

  const handlePermissionChange = (permission) => {
    try {
      // Create a new permissions object with the toggled value
      const newPermissions = { ...permissions };
      newPermissions[permission] = !newPermissions[permission];
      
      // Set the entire permissions object at once
      setPermissions(newPermissions);
      
    } catch (error) {
      console.error('Error changing permission:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      // Get current user token
      const token = await user.getIdToken(true); // Force refresh token

      const response = await fetch("/api/admin/update-role-permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: selectedRole,
          permissions,
          currentUserToken: token,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        
        // Update the in-memory ROLE_PERMISSIONS object to keep it in sync with Firestore
        // This ensures that if the modal is closed and reopened without a page refresh,
        // the permissions will still be correct
        ROLE_PERMISSIONS[selectedRole] = { ...permissions };
        console.log('Updated in-memory ROLE_PERMISSIONS:', ROLE_PERMISSIONS[selectedRole]);
      } else {
        setError(data.message || "Error actualizando permisos");
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role) {
      case ROLES.ADMINISTRATIVO:
        return "Administrador";
      case ROLES.CONTADOR:
        return "Contador";
      case ROLES.DIRECTOR_GENERAL:
        return "Director General";
      default:
        return role;
    }
  };

  // Group permissions by category
  const permissionCategories = {
    Visualización: [
      "canViewDashboard",
      "canViewEntradas",
      "canViewSalidas",
      "canViewHistorial",
      "canViewReports",
      "canViewAnalisisIA",
    ],
    Gestión: [
      "canManageTransactions",
      "canManageProviders",
      "canManageConcepts",
      "canManageDescriptions",
      "canManageGenerales",
      "canManageSubconcepts",
      "canManageSettings",
      "canManageUsers",
    ],
    Eliminación: [
      "canDeleteCatalogItems",
      "canDeleteTransactions",
      "canDeletePayments",
    ],
  };

  const getPermissionDisplayName = (permission) => {
    const displayNames = {
      canViewDashboard: "Ver Dashboard",
      canViewEntradas: "Ver Entradas",
      canViewSalidas: "Ver Salidas",
      canViewHistorial: "Ver Historial",
      canViewReports: "Ver Reportes",
      canViewAnalisisIA: "Ver Análisis IA",
      canManageTransactions: "Gestionar Transacciones",
      canManageProviders: "Gestionar Proveedores",
      canManageConcepts: "Gestionar Conceptos",
      canManageDescriptions: "Gestionar Descripciones",
      canManageGenerales: "Gestionar Generales",
      canManageSubconcepts: "Gestionar Subconceptos",
      canManageSettings: "Gestionar Configuración",
      canManageUsers: "Gestionar Usuarios",
      canDeleteCatalogItems: "Eliminar Elementos de Catálogo",
      canDeleteTransactions: "Eliminar Transacciones",
      canDeletePayments: "Eliminar Pagos",
    };

    return displayNames[permission] || permission;
  };

  return (
    <div className="fixed inset-0 bg-gray-600/50 backdrop-blur-lg overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Gestionar Permisos de Roles
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded">
              Permisos actualizados exitosamente
            </div>
          )}

          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700"
            >
              Seleccionar Rol
            </label>
            <select
              id="role"
              name="role"
              value={selectedRole}
              onChange={handleRoleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            >
              {Object.values(ROLES).map((role) => (
                <option key={role} value={role}>
                  {getRoleDisplayName(role)}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-md font-medium text-gray-900 mb-4">
              Permisos para {getRoleDisplayName(selectedRole)}
            </h4>

            {Object.entries(permissionCategories).map(([category, categoryPermissions]) => (
              <div key={category} className="mb-6">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  {category}
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryPermissions.map((permission) => (
                    <PermissionCheckbox
                       key={permission}
                       permission={permission}
                       checked={permissions[permission] || false}
                       onChange={handlePermissionChange}
                       label={getPermissionDisplayName(permission)}
                     />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RolePermissionsModal;