import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import GeneralModal from "../../../components/forms/GeneralModal";
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import MassiveCsvImportModal from "../../../components/forms/MassiveCsvImportModal";
import { generalService } from "../../../lib/services/generalService";
import { useAuth } from "../../../context/AuthContext";

export default function GeneralesPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Debug: Log user object to check role
  useEffect(() => {
    if (user) {
      console.log('Current user object:', user);
      console.log('User role from AuthContext:', userRole);
      console.log('User role from user object:', user.role || user.userRole || 'No role found');
    }
  }, [user, userRole]);

  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isMassiveImportModalOpen, setIsMassiveImportModalOpen] = useState(false);
  const [editingGeneral, setEditingGeneral] = useState(null);
  const [filter, setFilter] = useState("all"); // all, entrada, salida
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      loadGenerals();
    }
  }, [user, authLoading, router]);

  const loadGenerals = async () => {
    try {
      setLoading(true);
      setError(null);
      const generalsData = await generalService.getAll();
      setGenerals(generalsData);
    } catch (err) {
      setError(err.message);
      console.error("Error loading generals:", err);
    } finally {
      setLoading(false);
    };
  };

  const handleCreateGeneral = () => {
    setEditingGeneral(null);
    setIsModalOpen(true);
  };

  const handleEditGeneral = (general) => {
    setEditingGeneral(general);
    setIsModalOpen(true);
  };

  const handleDeleteGeneral = async (general) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar el general "${general.name}"?`
      )
    ) {
      return;
    }

    try {
      await generalService.delete(general.id, { role: user.userRole });
      await loadGenerals(); // Reload the list
    } catch (error) {
      alert(`Error al eliminar el general: ${error.message}`);
    }
  };

  const handleModalSuccess = async (generalData) => {
    await loadGenerals(); // Reload the list
  };



  const handleMassiveImportSuccess = async () => {
    await loadGenerals(); // Reload the list after massive import
  };

  const filteredGenerals = generals.filter((general) => {
    const matchesFilter = filter === "all" || general.type === filter;
    const matchesSearch = general.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const breadcrumbs = [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Catálogos", href: "#" },
    { label: "Generales", href: "/admin/catalogos/generales" },
  ];

  if (authLoading) {
    return (
      <AdminLayout title="Generales" breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gestión de Generales" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Generales</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gestiona las categorías generales para ingresos y gastos
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">

            <button
              onClick={() => setIsMassiveImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                />
              </svg>
              Importar CSV
            </button>
            <button
              onClick={handleCreateGeneral}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <svg
                className="-ml-1 mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Nuevo General
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex space-x-4">
              <div>
                <label
                  htmlFor="filter"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filtrar por tipo
                </label>
                <select
                  id="filter"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="entrada">Ingreso</option>
                  <option value="salida">Gasto</option>
                </select>
              </div>
            </div>

            <div className="flex-1 max-w-md">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Buscar
              </label>
              <input
                type="text"
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar generales..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center">
              <div className="text-red-600 mb-4">
                <svg
                  className="mx-auto h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Error al cargar generales
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadGenerals}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-orange-700"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha de Creación
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGenerals.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <svg
                            className="mx-auto h-12 w-12 mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <p className="text-lg font-medium mb-2">
                            No hay generales
                          </p>
                          <p className="text-sm">
                            {searchTerm || filter !== "all"
                              ? "No se encontraron generales con los filtros aplicados"
                              : "Comienza creando tu primer general"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredGenerals.map((general) => (
                      <tr key={general.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {general.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              general.type === "entrada"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {general.type === "entrada" ? "Ingreso" : "Gasto"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {general.createdAt?.toDate
                            ? general.createdAt
                                .toDate()
                                .toLocaleDateString("es-ES")
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditGeneral(general)}
                              className="text-primary hover:text-blue-900 p-1"
                              title="Editar"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            {userRole !== 'contador' && userRole !== 'director_general' && (
                              <button
                                onClick={() => handleDeleteGeneral(general)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Eliminar"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <GeneralModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialData={editingGeneral}
      />
      

      
      <MassiveCsvImportModal
        isOpen={isMassiveImportModalOpen}
        onClose={() => setIsMassiveImportModalOpen(false)}
        onSuccess={handleMassiveImportSuccess}
      />
    </AdminLayout>
  );
}
