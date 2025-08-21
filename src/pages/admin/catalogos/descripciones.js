import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import DescriptionModal from "../../../components/forms/DescriptionModal";
import { descriptionService } from "../../../lib/services/descriptionService";
import { conceptService } from "../../../lib/services/conceptService";
import { generalService } from "../../../lib/services/generalService";
import { useAuth } from "../../../context/AuthContext";

export default function DescripcionesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [descriptions, setDescriptions] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDescription, setEditingDescription] = useState(null);
  const [filterConcept, setFilterConcept] = useState("all");
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

      // Load descriptions, concepts, and generals
      const [descriptionsData, conceptsData, generalsData] = await Promise.all([
        descriptionService.getAll(),
        conceptService.getAll(),
        generalService.getAll(),
      ]);

      setDescriptions(descriptionsData);
      setConcepts(conceptsData);
      setGenerals(generalsData);
    } catch (err) {
      setError(err.message);
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDescription = () => {
    setEditingDescription(null);
    setIsModalOpen(true);
  };

  const handleEditDescription = (description) => {
    setEditingDescription(description);
    setIsModalOpen(true);
  };

  const handleDeleteDescription = async (description) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar la descripción "${description.name}"?`
      )
    ) {
      return;
    }

    try {
      await descriptionService.delete(description.id);
      await loadData(); // Reload the list
    } catch (error) {
      alert(`Error al eliminar la descripción: ${error.message}`);
    }
  };

  const handleModalSuccess = async (descriptionData) => {
    await loadData(); // Reload the list
  };

  const getConceptName = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    return concept ? concept.name : "Concepto no encontrado";
  };

  const getConceptType = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return "";
    
    // Get the type from the general (parent of concept)
    const general = generals.find((g) => g.id === concept.generalId);
    return general ? general.type : "";
  };

  const filteredDescriptions = descriptions.filter((description) => {
    const matchesFilter =
      filterConcept === "all" || description.conceptId === filterConcept;
    const matchesSearch =
      description.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getConceptName(description.conceptId)
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const breadcrumbs = [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Catálogos", href: "#" },
    { label: "Descripciones", href: "/admin/catalogos/descripciones" },
  ];

  if (authLoading) {
    return (
      <AdminLayout title="Descripciones" breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gestión de Descripciones" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Descripciones</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gestiona las descripciones asociadas a conceptos
            </p>
          </div>
          <button
            onClick={handleCreateDescription}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
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
            Nueva Descripción
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex space-x-4">
              <div>
                <label
                  htmlFor="filterConcept"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Filtrar por concepto
                </label>
                <select
                  id="filterConcept"
                  value={filterConcept}
                  onChange={(e) => setFilterConcept(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                >
                  <option value="all">Todos los conceptos</option>
                  {concepts.map((concept) => (
                    <option key={concept.id} value={concept.id}>
                      {concept.name} (
                      {concept.type === "entrada" ? "Ingreso" : "Gasto"})
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
                placeholder="Buscar descripciones..."
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
                Error al cargar descripciones
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
                      Descripción
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Concepto
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
                  {filteredDescriptions.length === 0 ? (
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
                            No hay descripciones
                          </p>
                          <p className="text-sm">
                            {searchTerm || filterConcept !== "all"
                              ? "No se encontraron descripciones con los filtros aplicados"
                              : "Comienza creando tu primera descripción"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDescriptions.map((description) => (
                      <tr key={description.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {description.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {getConceptName(description.conceptId)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              getConceptType(description.conceptId) ===
                              "entrada"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {getConceptType(description.conceptId) === "entrada"
                              ? "Ingreso"
                              : "Gasto"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {description.createdAt?.toDate
                            ? description.createdAt
                                .toDate()
                                .toLocaleDateString("es-ES")
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditDescription(description)}
                              className="text-primary hover:text-blue-900"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteDescription(description)
                              }
                              className="text-red-600 hover:text-red-900"
                            >
                              Eliminar
                            </button>
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
      <DescriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialData={editingDescription}
      />
    </AdminLayout>
  );
}
