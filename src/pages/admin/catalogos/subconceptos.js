import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import SubconceptModal from "../../../components/forms/SubconceptModal";


import { subconceptService } from "../../../lib/services/subconceptService";
import { conceptService } from "../../../lib/services/conceptService";
import { generalService } from "../../../lib/services/generalService";
import { useAuth } from "../../../context/AuthContext";

export default function SubconceptosPage() {
  const { user, userRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [subconcepts, setSubconcepts] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);


  const [editingSubconcept, setEditingSubconcept] = useState(null);
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

      // Load subconcepts, concepts, and generals
      const [subconceptsData, conceptsData, generalsData] = await Promise.all([
        subconceptService.getAll(),
        conceptService.getAll(),
        generalService.getAll(),
      ]);

      setSubconcepts(subconceptsData);
      setConcepts(conceptsData);
      setGenerals(generalsData);
    } catch (err) {
      setError(err.message);
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubconcept = () => {
    setEditingSubconcept(null);
    setIsModalOpen(true);
  };

  const handleEditSubconcept = (subconcept) => {
    setEditingSubconcept(subconcept);
    setIsModalOpen(true);
  };

  const handleDeleteSubconcept = async (subconcept) => {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar el subconcepto "${subconcept.name}"?`
      )
    ) {
      return;
    }

    try {
      await subconceptService.delete(subconcept.id, { role: userRole });
      await loadData(); // Reload the list
    } catch (error) {
      alert(`Error al eliminar el subconcepto: ${error.message}`);
    }
  };

  const handleModalSuccess = async (subconceptData) => {
    await loadData(); // Reload the list
  };





  const getConceptName = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    return concept ? concept.name : "Concepto no encontrado";
  };

  const getFullConceptPath = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return "Concepto no encontrado";
    
    const general = generals.find((g) => g.id === concept.generalId);
    const generalName = general ? general.name : "Sin general";
    
    return `${generalName} > ${concept.name}`;
  };

  const getConceptType = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return "";
    
    // Get the type from the general (parent of concept)
    const general = generals.find((g) => g.id === concept.generalId);
    return general ? general.type : "";
  };

  const filteredSubconcepts = subconcepts.filter((subconcept) => {
    const matchesFilter =
      filterConcept === "all" || subconcept.conceptId === filterConcept;
    const matchesSearch =
      subconcept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getConceptName(subconcept.conceptId)
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const breadcrumbs = [
    { label: "Dashboard", href: "/admin/dashboard" },
    { label: "Catálogos", href: "#" },
    { label: "Subconceptos", href: "/admin/catalogos/subconceptos" },
  ];

  if (authLoading) {
    return (
      <AdminLayout title="Subconceptos" breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Gestión de Subconceptos" breadcrumbs={breadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subconceptos</h1>
            <p className="mt-1 text-sm text-gray-600">
              Gestiona los subconceptos asociados a conceptos
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">


            <button
              onClick={handleCreateSubconcept}
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
              Nuevo Subconcepto
            </button>
          </div>
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
                  {concepts.map((concept) => {
                    const general = generals.find((g) => g.id === concept.generalId);
                    const generalName = general ? general.name : "Sin general";
                    const type = general ? general.type : "";
                    return (
                      <option key={concept.id} value={concept.id}>
                        {generalName} &gt; {concept.name} ({type === "entrada" ? "Ingreso" : "Gasto"})
                      </option>
                    );
                  })}
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
                placeholder="Buscar subconceptos..."
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
                Error al cargar subconceptos
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
                  {filteredSubconcepts.length === 0 ? (
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
                            No hay subconceptos
                          </p>
                          <p className="text-sm">
                            {searchTerm || filterConcept !== "all"
                              ? "No se encontraron subconceptos con los filtros aplicados"
                              : "Comienza creando tu primer subconcepto"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSubconcepts.map((subconcept) => (
                      <tr key={subconcept.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {subconcept.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {getFullConceptPath(subconcept.conceptId)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              getConceptType(subconcept.conceptId) === "entrada"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {getConceptType(subconcept.conceptId) === "entrada" ? "Ingreso" : "Gasto"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {subconcept.createdAt?.toDate
                            ? subconcept.createdAt
                                .toDate()
                                .toLocaleDateString("es-ES")
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditSubconcept(subconcept)}
                              className="text-primary hover:text-blue-900"
                            >
                              Editar
                            </button>
                            {userRole !== 'contador' && userRole !== 'director_general' && (
                              <button
                                onClick={() => handleDeleteSubconcept(subconcept)}
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
      <SubconceptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        initialData={editingSubconcept}
      />
      

      

    </AdminLayout>
  );
}
