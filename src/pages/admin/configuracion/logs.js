import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import { logService } from "../../../lib/services";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { generalService } from "../../../lib/services/generalService";
import { conceptService } from "../../../lib/services/conceptService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { providerService } from "../../../lib/services/providerService";
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

  // Función para comparar datos y obtener cambios
  const getChanges = (previousData, currentData, entityType) => {
    const changes = [];
    let fieldsToCompare = [];

    if (entityType === 'transaction') {
      fieldsToCompare = [
        { key: 'amount', label: 'Monto', format: (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val) },
        { key: 'description', label: 'Descripción' },
        { key: 'date', label: 'Fecha', format: (val) => formatDate(val) },
        { key: 'generalId', label: 'General', format: (val) => getGeneralName(val) },
        { key: 'conceptId', label: 'Concepto', format: (val) => getConceptName(val) },
        { key: 'subconceptId', label: 'Sub-concepto', format: (val) => getSubconceptName(val) },
        { key: 'providerId', label: 'Proveedor', format: (val) => getProviderName(val) },
        { key: 'division', label: 'División' },
        { key: 'status', label: 'Estado', format: (val) => formatStatus(val) }
      ];
    } else if (entityType === 'user') {
      fieldsToCompare = [
        { key: 'displayName', label: 'Nombre de usuario' },
        { key: 'role', label: 'Rol', format: (val) => {
          switch (val) {
            case 'administrativo': return 'Administrativo';
            case 'contador': return 'Contador';
            case 'usuario': return 'Usuario';
            default: return val || 'No definido';
          }
        }},
        { key: 'email', label: 'Correo electrónico' },
        { key: 'isActive', label: 'Estado', format: (val) => val ? 'Activo' : 'Inactivo' }
      ];
    }

    fieldsToCompare.forEach(({ key, label, format }) => {
      const prevVal = previousData?.[key];
      const currVal = currentData?.[key];

      // Formatear valores primero para comparar representaciones finales
      const formatValue = (val) => {
        if (val === null || val === undefined || val === '') {
          if (key === 'status') return formatStatus('pendiente');
          if (key === 'description') return 'Sin descripción';
          if (key === 'amount') return '$0.00';
          if (key === 'displayName') return 'Sin nombre';
          if (key === 'email') return 'Sin email';
          if (key === 'role') return 'Sin rol';
          if (key === 'isActive') return 'Inactivo';
          return 'No definido';
        }
        return format ? format(val) : val;
      };

      const formattedPrev = formatValue(prevVal);
      const formattedCurr = formatValue(currVal);

      // Solo considerar cambio si las representaciones finales son diferentes
      let hasChanged = formattedPrev !== formattedCurr;

      // Para campos específicos, hacer comparaciones adicionales
      if (hasChanged && key === 'date') {
        // Verificar que realmente sea una fecha diferente
        try {
          const prevDate = prevVal?.toDate ? prevVal.toDate().getTime() : new Date(prevVal).getTime();
          const currDate = currVal?.toDate ? currVal.toDate().getTime() : new Date(currVal).getTime();
          hasChanged = prevDate !== currDate;
        } catch (error) {
          // Si hay error en el parseo de fecha, mantener hasChanged como true
        }
      } else if (hasChanged && key === 'amount') {
        // Verificar que realmente sea un monto diferente
        const prevAmount = parseFloat(prevVal || 0);
        const currAmount = parseFloat(currVal || 0);
        hasChanged = prevAmount !== currAmount;
      } else if (hasChanged && key === 'isActive') {
        // Verificar que realmente sea un cambio de estado
        const prevActive = Boolean(prevVal);
        const currActive = Boolean(currVal);
        hasChanged = prevActive !== currActive;
      } else if (hasChanged && key === 'role') {
        // Verificar que realmente sea un cambio de rol
        const prevRole = String(prevVal || '').toLowerCase();
        const currRole = String(currVal || '').toLowerCase();
        hasChanged = prevRole !== currRole;
      }

      if (hasChanged) {
        changes.push({
          field: label,
          from: formattedPrev,
          to: formattedCurr
        });
      }
    });

    return changes;
  };

  // Función para formatear el status de manera legible
  const formatStatus = (status) => {
    if (!status) return 'pendiente';
    switch (status.toLowerCase()) {
      case 'pendiente':
        return 'Pendiente';
      case 'parcial':
        return 'Parcial';
      case 'pagado':
        return 'Pagado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  // Función para detectar logs con datos erróneos
  const hasInvalidData = (log) => {
    return (
      log.userName === "Usuario desconocido" ||
      !log.details ||
      (log.entityType === "user" && (!log.entityData || !log.previousData))
    );
  };

  // Función para resolver nombres de usuarios
  const getUserDisplayName = (userId, userName) => {
    if (userName && userName !== "Usuario desconocido") {
      return userName;
    }
    // Si no tenemos el nombre, intentar buscar en la lista de usuarios
    // Nota: Esta función necesitaría acceso a la lista de usuarios
    return userName || "Usuario desconocido";
  };

  // Funciones auxiliares para obtener nombres
  const getGeneralName = (id) => {
    if (!id) return 'No definido';
    const general = generals.find(g => g.id === id);
    return general ? general.name : `General ${id}`;
  };

  const getConceptName = (id) => {
    if (!id) return 'No definido';
    const concept = concepts.find(c => c.id === id);
    return concept ? concept.name : `Concepto ${id}`;
  };

  const getSubconceptName = (id) => {
    if (!id) return 'No definido';
    const subconcept = subconcepts.find(s => s.id === id);
    return subconcept ? subconcept.name : `Sub-concepto ${id}`;
  };

  const getProviderName = (id) => {
    if (!id) return 'No definido';
    const provider = providers.find(p => p.id === id);
    return provider ? provider.name : `Proveedor ${id}`;
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

  // Estados para datos de referencia
  const [generals, setGenerals] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
  const [providers, setProviders] = useState([]);

  // Check if user can manage settings
  const canManageSettings = checkPermission("canManageSettings");

  useEffect(() => {
    if (!canManageSettings) {
      router.push("/admin");
      return;
    }

    loadLogs();
    loadReferenceData();
  }, [canManageSettings, router]);

  // Cargar datos de referencia (generales, conceptos, subconceptos, proveedores)
  const loadReferenceData = async () => {
    try {
      const [generalsData, conceptsData, subconceptsData, providersData] = await Promise.all([
        generalService.getAll(),
        conceptService.getAll(),
        subconceptService.getAll(),
        providerService.getAll()
      ]);

      setGenerals(generalsData);
      setConcepts(conceptsData);
      setSubconcepts(subconceptsData);
      setProviders(providersData);
    } catch (error) {
      console.error("Error loading reference data:", error);
      // No mostrar error al usuario, solo usar valores por defecto
    }
  };

  const loadLogs = async (page = 1, append = false) => {
    try {
      setLoading(true);
      setError("");

      const paginationFilters = {
        ...filters,
        startAfter: page > 1 ? pagination.lastDoc : null,
      };

      const logsData = await logService.getAll(paginationFilters);

      // Debug: mostrar datos de logs
      console.log("=== LOGS DATA DEBUG ===");
      console.log("Raw logs data:", logsData);
      if (logsData.length > 0) {
        console.log("First log example:", logsData[0]);
        console.log("First log entityData:", logsData[0].entityData);
        console.log("First log previousData:", logsData[0].previousData);
      }
      console.log("=== END LOGS DATA DEBUG ===");

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
                    <tr
                      key={log.id}
                      className={`hover:bg-gray-50 ${hasInvalidData(log) ? 'bg-red-50 border-l-4 border-red-500' : ''}`}
                      title={hasInvalidData(log) ? 'Este log contiene datos erróneos o incompletos' : ''}
                    >
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
                        <span className={log.userName === "Usuario desconocido" ? "text-red-600" : ""}>
                          {getUserDisplayName(log.userId, log.userName)}
                        </span>
                        {log.userName === "Usuario desconocido" && (
                          <span className="text-xs text-red-500 ml-1">(ID: {log.userId})</span>
                        )}
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
                        {((log.entityType === "transaction" && (log.action === "delete" || log.action === "update")) ||
                          (log.entityType === "user" && log.action === "update")) && (
                          <button
                            onClick={() => handleViewDetails(log)}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                            title={`Ver detalles de ${log.action === 'update' ? 'la actualización' : 'la eliminación'}`}
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
                    Detalles de {selectedLog.action === 'update' ? 'Actualización' : selectedLog.action === 'delete' ? 'Eliminación' : 'Operación'}
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
                  ID de {selectedLog.entityType === 'transaction' ? 'Transacción' : selectedLog.entityType === 'user' ? 'Usuario' : 'Entidad'}: <span className="font-mono text-xs bg-gray-100 px-1 rounded">{selectedLog.entityId}</span>
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Usuario que Realizó los Cambios */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <User className="w-4 h-4 mr-2 text-green-600" />
                    Usuario que Realizó los Cambios
                  </h4>
                  <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h5 className="text-sm font-semibold text-gray-900">{selectedLog.userName}</h5>
                          {selectedLog.entityType === 'user' && selectedLog.action === 'update' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Editor de Usuarios
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          <p className="text-xs text-gray-500">
                            Realizó: <span className="font-medium">{getActionText(selectedLog.action).toLowerCase()}</span>
                            {selectedLog.entityType === 'user' && (
                              <span className="ml-1">
                                de <span className="font-medium">usuario</span>
                              </span>
                            )}
                            {selectedLog.entityType === 'transaction' && (
                              <span className="ml-1">
                                de <span className="font-medium">transacción</span>
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            Fecha: {formatDate(selectedLog.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información General */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <FileText className="w-4 h-4 mr-2 text-blue-600" />
                    Información General
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-gray-500">ID de {selectedLog.entityType === 'transaction' ? 'Transacción' : selectedLog.entityType === 'user' ? 'Usuario' : 'Entidad'}:</span>
                        <p className="text-sm font-medium font-mono text-xs bg-gray-100 px-2 py-1 rounded inline-block">
                          {selectedLog.entityId}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cambios Realizados (solo para actualizaciones) */}
                {selectedLog.action === 'update' && selectedLog.previousData && selectedLog.entityData && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <Edit className="w-4 h-4 mr-2 text-orange-600" />
                      Cambios Realizados
                    </h4>
                    <div className="bg-orange-50 rounded-lg p-4">
                      {(() => {
                        const changes = getChanges(selectedLog.previousData, selectedLog.entityData, selectedLog.entityType);
                        return changes.length > 0 ? (
                          <div className="space-y-3">
                            {changes.map((change, index) => (
                              <div key={index} className="flex items-center justify-between py-2 border-b border-orange-200 last:border-b-0">
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-orange-800">{change.field}:</span>
                                </div>
                                <div className="flex-1 text-right space-y-1">
                                  <div className="text-xs text-red-600 line-through">
                                    Antes: {change.from}
                                  </div>
                                  <div className="text-xs text-green-600 font-medium">
                                    Después: {change.to}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-orange-700">No se encontraron cambios específicos en los datos.</p>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Datos de la Transacción */}
                {selectedLog.entityData && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2 text-green-600" />
                      {selectedLog.action === 'update' ? 'Datos Actuales de la Transacción' : 'Datos de la Transacción Original'}
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
                          {selectedLog.entityData.status && (
                            <div>
                              <span className="text-xs text-gray-500">Estado:</span>
                              <p className="text-sm font-medium">{formatStatus(selectedLog.entityData.status)}</p>
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

                {/* Información del Usuario (solo para logs de usuarios) */}
                {selectedLog.entityType === 'user' && selectedLog.entityData && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <User className="w-4 h-4 mr-2 text-purple-600" />
                      Información del Usuario
                    </h4>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-gray-500">Nombre de Usuario:</span>
                            <p className="text-sm font-medium">{selectedLog.entityData.displayName || 'Sin nombre'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Correo Electrónico:</span>
                            <p className="text-sm font-medium">{selectedLog.entityData.email || 'Sin email'}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-gray-500">Rol:</span>
                            <p className="text-sm font-medium">
                              {selectedLog.entityData.role === 'administrativo' ? 'Administrativo' :
                               selectedLog.entityData.role === 'contador' ? 'Contador' :
                               selectedLog.entityData.role === 'usuario' ? 'Usuario' :
                               selectedLog.entityData.role || 'Sin rol'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Estado:</span>
                            <p className="text-sm font-medium">
                              {selectedLog.entityData.isActive ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Inactivo
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      {selectedLog.entityData.updatedAt && (
                        <div className="mt-4 pt-4 border-t border-purple-200">
                          <div>
                            <span className="text-xs text-gray-500">Última Actualización:</span>
                            <p className="text-sm font-medium">
                              {selectedLog.entityData.updatedAt?.toDate
                                ? new Intl.DateTimeFormat('es-MX', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }).format(selectedLog.entityData.updatedAt.toDate())
                                : new Intl.DateTimeFormat('es-MX', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }).format(new Date(selectedLog.entityData.updatedAt))
                              }
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Datos Anteriores (solo para actualizaciones) */}
                {selectedLog.action === 'update' && selectedLog.previousData && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2 text-red-600" />
                      Datos Anteriores {selectedLog.entityType === 'user' ? 'del Usuario' : 'de la Transacción'}
                    </h4>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          {selectedLog.previousData.type && (
                            <div>
                              <span className="text-xs text-gray-500">Tipo:</span>
                              <p className="text-sm font-medium">
                                {selectedLog.previousData.type === "entrada" ? (
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
                          {selectedLog.previousData.amount && (
                            <div>
                              <span className="text-xs text-gray-500">Monto:</span>
                              <p className="text-sm font-medium">
                                {new Intl.NumberFormat('es-MX', {
                                  style: 'currency',
                                  currency: 'MXN'
                                }).format(selectedLog.previousData.amount)}
                              </p>
                            </div>
                          )}
                          {selectedLog.previousData.date && (
                            <div>
                              <span className="text-xs text-gray-500">Fecha:</span>
                              <p className="text-sm font-medium">{formatDate(selectedLog.previousData.date)}</p>
                            </div>
                          )}
                          {selectedLog.previousData.description && (
                            <div>
                              <span className="text-xs text-gray-500">Descripción:</span>
                              <p className="text-sm font-medium">{selectedLog.previousData.description}</p>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {selectedLog.previousData.status && (
                            <div>
                              <span className="text-xs text-gray-500">Estado:</span>
                              <p className="text-sm font-medium">{formatStatus(selectedLog.previousData.status)}</p>
                            </div>
                          )}
                          {selectedLog.previousData.generalId && (
                            <div>
                              <span className="text-xs text-gray-500">General:</span>
                              <p className="text-sm font-medium">{getGeneralName(selectedLog.previousData.generalId)}</p>
                            </div>
                          )}
                          {selectedLog.previousData.conceptId && (
                            <div>
                              <span className="text-xs text-gray-500">Concepto:</span>
                              <p className="text-sm font-medium">{getConceptName(selectedLog.previousData.conceptId)}</p>
                            </div>
                          )}
                          {(selectedLog.previousData.providerId || selectedLog.previousData.division) && (
                            <div>
                              <span className="text-xs text-gray-500">Proveedor/División:</span>
                              <p className="text-sm font-medium">
                                {selectedLog.previousData.providerId ? getProviderName(selectedLog.previousData.providerId) : 'No definido'}
                                {selectedLog.previousData.division ? ` / ${selectedLog.previousData.division}` : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Información Anterior del Usuario (solo para logs de usuarios) */}
                {selectedLog.entityType === 'user' && selectedLog.action === 'update' && selectedLog.previousData && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                      <User className="w-4 h-4 mr-2 text-red-600" />
                      Información Anterior del Usuario
                    </h4>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-gray-500">Nombre de Usuario Anterior:</span>
                            <p className="text-sm font-medium">{selectedLog.previousData.displayName || 'Sin nombre'}</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Correo Electrónico Anterior:</span>
                            <p className="text-sm font-medium">{selectedLog.previousData.email || 'Sin email'}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs text-gray-500">Rol Anterior:</span>
                            <p className="text-sm font-medium">
                              {selectedLog.previousData.role === 'administrativo' ? 'Administrativo' :
                               selectedLog.previousData.role === 'contador' ? 'Contador' :
                               selectedLog.previousData.role === 'usuario' ? 'Usuario' :
                               selectedLog.previousData.role || 'Sin rol'}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Estado Anterior:</span>
                            <p className="text-sm font-medium">
                              {selectedLog.previousData.isActive ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Activo
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Inactivo
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      {selectedLog.previousData.createdAt && (
                        <div className="mt-4 pt-4 border-t border-red-200">
                          <div>
                            <span className="text-xs text-gray-500">Fecha de Creación Original:</span>
                            <p className="text-sm font-medium">
                              {selectedLog.previousData.createdAt?.toDate
                                ? new Intl.DateTimeFormat('es-MX', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }).format(selectedLog.previousData.createdAt.toDate())
                                : new Intl.DateTimeFormat('es-MX', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }).format(new Date(selectedLog.previousData.createdAt))
                              }
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Motivo de Eliminación (solo para eliminaciones) */}
                {selectedLog.action === 'delete' && (
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
                )}

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