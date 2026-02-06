import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import ConceptModal from "../../../components/forms/ConceptModal";
import MassiveCsvImportModal from "../../../components/forms/MassiveCsvImportModal";
import { conceptService } from "../../../lib/services/conceptService";
import { generalService } from "../../../lib/services/generalService";
import { useAuth } from "../../../context/AuthContext";
import { 
  PencilIcon,
  TrashIcon,
  ArrowUpOnSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

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
  const [filterType, setFilterType] = useState("all");
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

      // Load both concepts and generals
      const [conceptsData, generalsData] = await Promise.all([
        conceptService.getAll(),
        generalService.getAll()
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

  const filteredConcepts = concepts.filter((concept) => {
    const matchesGeneralFilter = filterGeneral === "all" || concept.generalId === filterGeneral;
    const matchesTypeFilter = filterType === "all" || concept.type === filterType;
    const matchesSearch = concept.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesGeneralFilter && matchesTypeFilter && matchesSearch;
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
              Gestiona los conceptos para categorizar transacciones
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">

            <button
              onClick={() => setIsMassiveImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            ><ArrowUpOnSquareIcon className="h-5 w-5 mr-1.5" />
              Importar CSV
            </button>
            <button
              onClick={handleCreateConcept}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <PlusIcon className="h-5 w-5 mr-1.5" />
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
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-blue-500"
                >
                  <option value="all">Todos los generales</option>
                  {generals.map((general) => (
                    <option key={general.id} value={general.id}>
                      {general.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="filterType"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filtrar por tipo
                </label>
                <select
                  id="filterType"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-blue-500"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="entrada">Entradas</option>
                  <option value="salida">Salidas</option>
                  <option value="ambos">Ambos</option>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-blue-500"
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
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-red-700"
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
                            {searchTerm || filterType !== "all" || filterGeneral !== "all"
                              ? "No se encontraron conceptos con los filtros aplicados"
                              : "Comienza creando tu primer concepto"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredConcepts.map((concept) => {
                      const general = generals.find(g => g.id === concept.generalId);
                      return (
                        <tr key={concept.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {concept.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {general ? general.name : 'Sin asignar'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                concept.type === "entrada"
                                  ? "bg-green-100 text-green-800"
                                  : concept.type === "salida"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {concept.type === "entrada" ? "Entrada" : concept.type === "salida" ? "Salida" : "Ambos"}
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
                                className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                                title="Editar concepto"
                                cursor="pointer"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              {canDeleteCatalogItems && (
                                <button
                                  onClick={() => handleDeleteConcept(concept)}
                                  className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                                  title="Eliminar concepto"
                                  cursor="pointer"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
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
        generals={generals}
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
