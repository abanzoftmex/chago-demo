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
  Eye,
  BarChart3,
  StickyNote,
} from "lucide-react";

const LogsPage = () => {
  const router = useRouter();
  const { user, checkPermission } = useAuth();
  const toast = useToast();

  // Función para obtener el tipo de transacción desde diferentes fuentes
  const getTransactionType = (log) => {
    return logService.extractTransactionType(log);
  };

  // Función para abrir el modal de detalles
  const handleViewDetails = (log) => {
    setSelectedLog(log);
    setShowDetailsModal(true);
  };
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
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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
    // Limpiar todos los filtros y resetear la vista
    setFilters({
      action: "",
      transactionType: "",
      searchText: "",
      startDate: "",
      endDate: "",
      limit: 20,
    });

    // Resetear paginación completamente para volver al estado inicial
    setPagination({
      currentPage: 1,
      hasMore: true,
      lastDoc: null,
      totalLoaded: 0,
      docHistory: [],
    });

    // Recargar los datos desde el inicio
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
                disabled={loading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <RotateCcw className="h-4 w-4 mr-1" /> Limpiar filtros
              </button>
              <button
                onClick={applyFilters}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Acciones
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
                        {log.entityType === "transaction" ? (() => {
                          const transactionType = getTransactionType(log);
                          return transactionType ? (
                            transactionType === "entrada" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Ingreso
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Gasto
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Tipo no disponible
                            </span>
                          );
                        })() : (
                          "-"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.entityId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs">
                        <div className="truncate" title={log.details}>
                          {log.details}
                        </div>
                        {log.deletionReason && (
                          <div className="text-xs text-blue-600 mt-1 truncate" title={`Motivo: ${log.deletionReason}`}>
                            📝 {log.deletionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.entityType === "transaction" && log.action === "delete" && (
                          <button
                            onClick={() => handleViewDetails(log)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                            title="Ver detalles de la transacción eliminada"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Ver detalles
                          </button>
                        )}
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

        {/* Details Modal */}
        {showDetailsModal && selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Eye className="w-5 h-5 mr-2 text-blue-600" />
                    Detalles de Transacción Eliminada
                  </h3>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  ID de Transacción: <span className="font-mono text-xs bg-gray-100 px-1 rounded">{selectedLog.entityId}</span>
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Información General */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-blue-600" />
                    Información General
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">Fecha de Eliminación:</span>
                        <p className="text-sm font-medium">{formatDate(selectedLog.timestamp)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Usuario:</span>
                        <p className="text-sm font-medium">{selectedLog.userName}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">Tipo de Acción:</span>
                        <p className="text-sm font-medium">{getActionText(selectedLog.action)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Tipo de Entidad:</span>
                        <p className="text-sm font-medium">{getEntityTypeText(selectedLog.entityType)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Datos de la Transacción Original */}
                {selectedLog.entityData && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2 text-green-600" />
                      Datos de la Transacción Original
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          {selectedLog.entityData.type && (
                            <div>
                              <span className="text-xs text-gray-500">Tipo:</span>
                              <p className="text-sm font-medium">
                                {selectedLog.entityData.type === "entrada" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Ingreso
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Gasto
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                          {selectedLog.entityData.amount && (
                            <div>
                              <span className="text-xs text-gray-500">Monto:</span>
                              <p className="text-sm font-medium">
                                {new Intl.NumberFormat('es-MX', {
                                  style: 'currency',
                                  currency: 'MXN'
                                }).format(selectedLog.entityData.amount)}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {selectedLog.entityData.date && (
                            <div>
                              <span className="text-xs text-gray-500">Fecha Original:</span>
                              <p className="text-sm font-medium">
                                {selectedLog.entityData.date?.toDate
                                  ? new Intl.DateTimeFormat('es-MX').format(selectedLog.entityData.date.toDate())
                                  : new Intl.DateTimeFormat('es-MX').format(new Date(selectedLog.entityData.date))
                                }
                              </p>
                            </div>
                          )}
                          {selectedLog.entityData.reference && (
                            <div>
                              <span className="text-xs text-gray-500">Referencia:</span>
                              <p className="text-sm font-medium">{selectedLog.entityData.reference}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Información adicional si existe */}
                      <div className="mt-4 space-y-2">
                        {selectedLog.entityData.description && (
                          <div>
                            <span className="text-xs text-gray-500">Descripción:</span>
                            <p className="text-sm font-medium">{selectedLog.entityData.description}</p>
                          </div>
                        )}
                        {selectedLog.entityData.notes && (
                          <div>
                            <span className="text-xs text-gray-500">Notas:</span>
                            <p className="text-sm font-medium">{selectedLog.entityData.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Motivo de Eliminación */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <StickyNote className="w-4 h-4 mr-2 text-orange-600" />
                    Motivo de Eliminación
                  </h4>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    {selectedLog.deletionReason ? (
                      <p className="text-sm text-orange-800">{selectedLog.deletionReason}</p>
                    ) : (
                      <p className="text-sm text-orange-600 italic">No se especificó motivo de eliminación</p>
                    )}
                  </div>
                </div>

                {/* Detalles Técnicos */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-gray-600" />
                    Información Técnica
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">ID del Log:</span>
                        <p className="text-xs font-mono bg-white px-2 py-1 rounded border mt-1">{selectedLog.id}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Timestamp:</span>
                        <p className="text-xs font-mono bg-white px-2 py-1 rounded border mt-1">
                          {selectedLog.timestamp?.toDate
                            ? selectedLog.timestamp.toDate().toISOString()
                            : new Date(selectedLog.timestamp).toISOString()
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:ring-2 focus:ring-gray-500"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default LogsPage;