import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import { logService } from "../../../lib/services";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  Edit,
  Plus,
  Search,
  Filter,
  AlertCircle,
  CheckCircle,
  Calendar,
  User,
  Tag,
  Trash,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

const LogsPage = () => {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    action: "",
    transactionType: "",
    searchText: "",
    startDate: "",
    endDate: "",
    limit: 20,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    hasMore: true,
    lastDoc: null,
    totalLoaded: 0,
    docHistory: [], // Historial de documentos para navegación hacia atrás
  });

  // Check if user can manage settings
  const canManageSettings = checkPermission("canManageSettings");

  useEffect(() => {
    if (!canManageSettings) {
      router.push("/admin");
      return;
    }

    loadLogs();
  }, [canManageSettings, router]);

  const loadLogs = async (page = 1, append = false) => {
    try {
      setLoading(true);
      setError("");

      const paginationFilters = {
        ...filters,
        startAfter: page > 1 ? pagination.lastDoc : null,
      };

      const logsData = await logService.getAll(paginationFilters);

      if (append) {
        setLogs(prevLogs => [...prevLogs, ...logsData]);
      } else {
        setLogs(logsData);
      }

      // Update pagination state
      const hasMore = logsData.length === parseInt(filters.limit);
      const lastDoc = logsData.length > 0 ? logsData[logsData.length - 1] : null;

      setPagination(prev => ({
        currentPage: page,
        hasMore,
        lastDoc,
        totalLoaded: append ? prev.totalLoaded + logsData.length : logsData.length,
        docHistory: append ? [...prev.docHistory, prev.lastDoc] : [],
      }));
    } catch (err) {
      console.error("Error loading logs:", err);
      setError("Error al cargar los registros de actividad");
    } finally {
      setLoading(false);
    }
  };



  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    // If changing limit, reset pagination
    if (name === 'limit') {
      setPagination({
        currentPage: 1,
        hasMore: true,
        lastDoc: null,
        totalLoaded: 0,
        docHistory: [],
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFilters();
    }
  };

  const applyFilters = () => {
    // Reset pagination when applying filters
    setPagination({
      currentPage: 1,
      hasMore: true,
      lastDoc: null,
      totalLoaded: 0,
      docHistory: [],
    });
    loadLogs(1, false);
  };

  const resetFilters = () => {
    setFilters({
      action: "",
      transactionType: "",
      searchText: "",
      startDate: "",
      endDate: "",
      limit: 20,
    });
    setPagination({
      currentPage: 1,
      hasMore: true,
      lastDoc: null,
      totalLoaded: 0,
      docHistory: [],
    });
    setTimeout(() => {
      loadLogs(1, false);
    }, 0);
  };

  const loadNextPage = () => {
    if (pagination.hasMore && !loading) {
      loadLogs(pagination.currentPage + 1, true);
    }
  };

  const loadPreviousPage = () => {
    if (pagination.currentPage > 1 && !loading) {
      const previousDoc = pagination.docHistory[pagination.docHistory.length - 1];
      const newDocHistory = pagination.docHistory.slice(0, -1);

      setPagination(prev => ({
        ...prev,
        currentPage: prev.currentPage - 1,
        lastDoc: previousDoc,
        docHistory: newDocHistory,
        totalLoaded: prev.totalLoaded - parseInt(filters.limit),
      }));

      // Remove the last page of logs from the display
      setLogs(prevLogs => prevLogs.slice(0, -parseInt(filters.limit)));
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) {
      return "Fecha no disponible";
    }
    return format(timestamp.toDate(), "dd/MM/yyyy HH:mm:ss", { locale: es });
  };

  const getEntityTypeText = (entityType) => {
    switch (entityType) {
      case "transaction":
        return "Transacción";
      case "payment":
        return "Pago";
      case "provider":
        return "Proveedor";
      case "concept":
        return "Concepto";
      case "description":
        return "Descripción";
      case "subconcept":
        return "Subconcepto";
      default:
        return entityType || "Desconocido";
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case "delete":
      case "delete_reason":
        return <Trash className="h-4 w-4 text-red-500" />;
      case "create":
        return <Plus className="h-4 w-4 text-green-500" />;
      case "update":
        return <Edit className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case "delete":
      case "delete_reason":
        return "Eliminación";
      case "create":
        return "Creación";
      case "update":
        return "Actualización";
      default:
        return action;
    }
  };

  // Second getEntityTypeText function removed to fix duplicate definition

  return (
    <AdminLayout>
      <div className="w-full px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Registros de Actividad</h1>
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Filter className="h-5 w-5 mr-2" /> Filtros
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buscar
              </label>
              <input
                type="text"
                name="searchText"
                value={filters.searchText}
                onChange={handleFilterChange}
                onKeyDown={handleKeyDown}
                placeholder="Buscar en detalles, usuario, acción..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Acción
              </label>
              <select
                name="action"
                value={filters.action}
                onChange={handleFilterChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas las acciones</option>
                <option value="delete">Eliminación</option>
                <option value="create">Creación</option>
                <option value="update">Actualización</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo (Ingreso o Gasto)
              </label>
              <select
                name="transactionType"
                value={filters.transactionType}
                onChange={handleFilterChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                <option value="entrada">Ingreso</option>
                <option value="salida">Gasto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Desde
              </label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                onKeyDown={handleKeyDown}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha Hasta
              </label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                onKeyDown={handleKeyDown}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Registros por página
              </label>
              <select
                name="limit"
                value={filters.limit}
                onChange={handleFilterChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="20">20 registros</option>
                <option value="50">50 registros</option>
                <option value="100">100 registros</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              💡 Presiona Enter en cualquier campo para aplicar filtros
            </div>
            <div className="flex space-x-2">
              <button
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center"
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Reiniciar
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              >
                <Search className="h-4 w-4 mr-1" /> Aplicar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
              <p>Cargando registros...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500">No se encontraron registros de actividad.</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Fecha y Hora
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Acción
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Tipo de Entidad
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Tipo
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      ID de Entidad
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Usuario
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Detalles
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getActionIcon(log.action)}
                          <span className="ml-2 text-sm text-gray-900">
                            {getActionText(log.action)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getEntityTypeText(log.entityType)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.entityType === "transaction" && log.transactionType ? 
                          (log.transactionType === "entrada" ? 
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ingreso</span> : 
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Gasto</span>
                          ) : 
                          "-"
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.entityId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {logs.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center text-sm text-gray-700">
                <span>
                  Página {pagination.currentPage} • {pagination.totalLoaded} registros cargados
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadPreviousPage}
                  disabled={pagination.currentPage === 1 || loading}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </button>
                <button
                  onClick={loadNextPage}
                  disabled={!pagination.hasMore || loading}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LogsPage;