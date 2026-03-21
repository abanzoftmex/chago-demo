import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import GeneralModal from "../../../components/forms/GeneralModal";
import MassiveCsvImportModal from "../../../components/forms/MassiveCsvImportModal";
import { generalService } from "../../../lib/services/generalService";
import { useAuth } from '../../../context/AuthContextMultiTenant';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { 
  PencilIcon,
  TrashIcon,
  ArrowUpOnSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

const breadcrumbs = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Catálogos", href: "#" },
  { label: "Generales", href: "/admin/catalogos/generales" },
];

export default function GeneralesPage() {
  const { user, userRole, loading: authLoading, tenantInfo } = useAuth();
  const router = useRouter();
  
  // Memoize tenantId to prevent unnecessary re-renders
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);

  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isMassiveImportModalOpen, setIsMassiveImportModalOpen] = useState(false);
  const [editingGeneral, setEditingGeneral] = useState(null);
  const [filter, setFilter] = useState("all"); // all, entrada, salida
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, item: null });
  const [errorDialog, setErrorDialog] = useState({ open: false, message: '' });

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user && tenantId) {
      loadGenerals();
    }
  }, [user, authLoading, tenantId]);

  const loadGenerals = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        console.error("No tenant ID available");
        setLoading(false);
        return;
      }

      const generalsData = await generalService.getAll(tenantId);
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

  const handleDeleteGeneral = (general) => {
    setDeleteDialog({ open: true, item: general });
  };

  const confirmDeleteGeneral = async () => {
    const general = deleteDialog.item;
    setDeleteDialog({ open: false, item: null });
    try {
      if (!tenantId) throw new Error('No tenant ID available');
      await generalService.delete(general.id, tenantId, { role: user.userRole });
      await loadGenerals();
    } catch (error) {
      setErrorDialog({ open: true, message: error.message });
    }
  };

  const handleModalSuccess = async () => {
    await loadGenerals();
  };

  const handleMassiveImportSuccess = handleModalSuccess;

  const filteredGenerals = useMemo(() => generals.filter((general) => {
    const matchesFilter = filter === "all" || general.type === filter;
    const matchesSearch = general.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  }), [generals, filter, searchTerm]);

  const totalPages = Math.ceil(filteredGenerals.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedGenerals = filteredGenerals.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  if (authLoading) {
    return (
      <AdminLayout title="Generales" breadcrumbs={breadcrumbs}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
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
              Gestiona las categorías generales para entradas y salidas
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-2">

            <button
              onClick={() => setIsMassiveImportModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <ArrowUpOnSquareIcon className="h-5 w-5 mr-1.5" />
              Importar CSV
            </button>
            <button
              onClick={handleCreateGeneral}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              <PlusIcon className="h-5 w-5 mr-1.5" />
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
                  onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
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
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar generales..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
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
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saldo anterior/actual
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGenerals.length === 0 ? (
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
                    paginatedGenerals.map((general) => (
                      <tr key={general.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {general.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              general.type === "entrada"
                                ? "bg-green-100 text-green-800"
                                : general.type === "salida"
                                ? "bg-red-100 text-red-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {general.type === "entrada" ? "Entrada" : general.type === "salida" ? "Salida" : "Ambos"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {general.createdAt?.toDate
                            ? general.createdAt
                                .toDate()
                                .toLocaleDateString("es-ES")
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {general.hasPreviousBalance ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Sí
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditGeneral(general)}
                              className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center cursor-pointer"
                              title="Editar general"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            {userRole !== 'contador' && userRole !== 'director_general' && (
                              <button
                                onClick={() => handleDeleteGeneral(general)}
                                  className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center cursor-pointer"
                                  title="Eliminar general"
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
            <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Mostrando <span className="font-medium">{filteredGenerals.length === 0 ? 0 : startIndex + 1}</span> a <span className="font-medium">{Math.min(endIndex, filteredGenerals.length)}</span> de <span className="font-medium">{filteredGenerals.length}</span> resultados
              </p>
              {totalPages > 1 && (
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
                      return (<button key={page} onClick={() => handlePageChange(page)} className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${page === currentPage ? 'z-10 bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}>{page}</button>);
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (<span key={page} className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">...</span>);
                    }
                    return null;
                  })}
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                  </button>
                </nav>
              )}
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

      <ConfirmDialog
        isOpen={deleteDialog.open}
        type="confirm"
        title="Eliminar General"
        message={`¿Estás seguro de que deseas eliminar el general "${deleteDialog.item?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteGeneral}
        onClose={() => setDeleteDialog({ open: false, item: null })}
      />

      <ConfirmDialog
        isOpen={errorDialog.open}
        type="error"
        title="No se puede eliminar"
        message={errorDialog.message}
        onClose={() => setErrorDialog({ open: false, message: '' })}
      />
    </AdminLayout>
  );
}
