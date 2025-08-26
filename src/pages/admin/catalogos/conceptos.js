import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import ConceptModal from "../../../components/forms/ConceptModal";

import MassiveCsvImportModal from "../../../components/forms/MassiveCsvImportModal";
import { conceptService } from "../../../lib/services/conceptService";
import { generalService } from "../../../lib/services/generalService";
import { useAuth } from "../../../context/AuthContext";

export default function ConceptosPage() {
  const { user, loading: authLoading, checkPermission } = useAuth();
  const router = useRouter();

  // Check permissions
  const canDeleteCatalogItems = checkPermission("canDeleteCatalogItems");

  const [concepts, setConcepts] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isMassiveImportModalOpen, setIsMassiveImportModalOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState(null);
  const [filterGeneral, setFilterGeneral] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load concepts and generals
      const [conceptsData, generalsData] = await Promise.all([
        conceptService.getAll(),
        generalService.getAll(),
      ]);

      setConcepts(conceptsData);
      setGenerals(generalsData);
    } catch (err) {
      setError(err.message);
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConcept = () => {
    setEditingConcept(null);
    setIsModalOpen(true);
  };

  const handleEditConcept = (concept) => {
    setEditingConcept(concept);
    setIsModalOpen(true);
  };

  const handleDeleteConcept = async (concept) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar el concepto "${concept.name}"?`
      )
    ) {
      return;
    }

    try {
      await conceptService.delete(concept.id);
      await loadData(); // Reload the list
    } catch (error) {
      alert(`Error al eliminar el concepto: ${error.message}`);
    }
  };

  const handleModalSuccess = async (conceptData) => {
    await loadData(); // Reload the list
  };



  const handleMassiveImportSuccess = async () => {
    await loadData(); // Reload the list after massive import
  };

  const getGeneralName = (generalId) => {
    const general = generals.find(g => g.id === generalId);
    return general ? general.name : 'General no encontrado';
  };

  const getGeneralType = (generalId) => {
    const general = generals.find(g => g.id === generalId);
    return general ? general.type : '';
  };

  const filteredConcepts = concepts.filter((concept) => {
    const matchesGeneralFilter = filterGeneral === "all" || concept.generalId === filterGeneral;
    const matchesSearch =
      concept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getGeneralName(concept.generalId)
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesGeneralFilter && matchesSearch;
  });

  const breadcrumbs = [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Catálogos", href: "#" },
    { label: "Conceptos", href: "/admin/catalogos/conceptos" },
  ];

  if (authLoading) {
    return (
      <AdminLayout title="Conceptos" breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gestión de Conceptos" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conceptos</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gestiona los conceptos asociados a generales
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">

            <button
              onClick={() => setIsMassiveImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              Importación Masiva
            </button>
            <button
              onClick={handleCreateConcept}
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
              Nuevo Concepto
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex space-x-4">
              <div>
                <label
                  htmlFor="filterGeneral"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filtrar por general
                </label>
                <select
                  id="filterGeneral"
                  value={filterGeneral}
                  onChange={(e) => setFilterGeneral(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                >
                  <option value="all">Todos los generales</option>
                  {generals.map((general) => (
                    <option key={general.id} value={general.id}>
                      {general.name} ({general.type === "entrada" ? "Ingreso" : "Gasto"})
                    </option>
                  ))}
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
                placeholder="Buscar conceptos..."
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
                Error al cargar conceptos
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadData}
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
                      General
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
                  {filteredConcepts.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
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
                            No hay conceptos
                          </p>
                          <p className="text-sm">
                            {searchTerm || filterGeneral !== "all"
                              ? "No se encontraron conceptos con los filtros aplicados"
                              : "Comienza creando tu primer concepto"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredConcepts.map((concept) => (
                      <tr key={concept.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {concept.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {getGeneralName(concept.generalId)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              getGeneralType(concept.generalId) === "entrada"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {getGeneralType(concept.generalId) === "entrada" ? "Ingreso" : "Gasto"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {concept.createdAt?.toDate
                            ? concept.createdAt
                                .toDate()
                                .toLocaleDateString("es-ES")
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditConcept(concept)}
                              className="text-primary hover:text-blue-900"
                            >
                              Editar
                            </button>
                            {canDeleteCatalogItems && (
                              <button
                                onClick={() => handleDeleteConcept(concept)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Eliminar
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

      {/* Modal */}
      <ConceptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialData={editingConcept}
      />


      
      {/* Massive CSV Import Modal */}
      <MassiveCsvImportModal
        isOpen={isMassiveImportModalOpen}
        onClose={() => setIsMassiveImportModalOpen(false)}
        onSuccess={handleMassiveImportSuccess}
      />
    </AdminLayout>
  );
}
