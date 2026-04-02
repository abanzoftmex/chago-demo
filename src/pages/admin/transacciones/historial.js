import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import AdvancedDateSelector from "../../../components/dashboard/AdvancedDateSelector";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { providerService } from "../../../lib/services/providerService";
import { generalService } from "../../../lib/services/generalService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { formatDivision } from "../../../lib/constants/divisions";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Filter,
  Users,
  Tag,
  Building,
  CheckCircle,
  RefreshCw,
  ClockIcon,
  AlertCircleIcon,
  EyeIcon,
  Layers
} from "lucide-react";
import Select from "react-select";
import { useAuth } from "../../../context/AuthContextMultiTenant";

const ITEMS_PER_PAGE = 20;

const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const currentMonthRange = () => {
  const now = new Date();
  return {
    startDate: formatDateForInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: formatDateForInput(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

// Defined outside component to avoid re-creation on each render
const selectStyles = {
    control: (provided, state) => ({
      ...provided,
      minHeight: '44px',
      height: '44px',
      width: '100%',
      fontSize: '14px',
      borderColor: state.isFocused ? '#3B82F6' : '#D1D5DB',
      boxShadow: state.isFocused ? '0 0 0 2px #3B82F660' : 'none',
      '&:hover': {
        borderColor: '#3B82F6'
      }
    }),
    valueContainer: (provided) => ({
      ...provided,
      height: '44px',
      padding: '0 8px'
    }),
    input: (provided) => ({
      ...provided,
      margin: '0px',
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      height: '44px',
    }),
    clearIndicator: (provided) => ({
      ...provided,
      padding: '6px',
    }),
    dropdownIndicator: (provided) => ({
      ...provided,
      padding: '6px',
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 10,
      fontSize: '14px'
    }),
    option: (provided) => ({
      ...provided,
      fontSize: "14px",
      padding: "10px 14px",
    }),
  };

const Historial = () => {
  const router = useRouter();
  const { tenantInfo } = useAuth();

  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);

  const [transactions, setTransactions] = useState([]);
  const [transactionStats, setTransactionStats] = useState({ pendiente: 0, parcial: 0, pagado: 0, total: 0 });
  const [concepts, setConcepts] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Options for React Select
  const typeOptions = [
    { value: "", label: "Todos los tipos" },
    { value: "entrada", label: "Entradas" },
    { value: "salida", label: "Salidas" },
  ];

  const statusOptions = [
    { value: "", label: "Todos los estados" },
    { value: "pendiente", label: "Pendiente" },
    { value: "parcial", label: "Parcial" },
    { value: "pagado", label: "Pagado" }
  ];

  const generalOptions = useMemo(() => [
    { value: "", label: "Todas las categorías" },
    ...generals.map(general => ({ value: general.id, label: general.name }))
  ], [generals]);

  const providerOptions = useMemo(() => [
    { value: "", label: "Todos los proveedores" },
    ...providers.map(provider => ({ value: provider.id, label: provider.name }))
  ], [providers]);

  // Filters
  const [filters, setFilters] = useState({
    type: "",
    conceptId: "",
    subconceptId: "",
    providerId: "",
    generalId: "",
    status: "",
    division: "",
    search: "",
    startDate: "",
    endDate: "",
  });

  // Date selector state
  const [selectedDate, setSelectedDate] = useState(new Date());

  const historialMonthLabel = useMemo(() => {
    const month = selectedDate.toLocaleDateString("es-ES", { month: "long" });
    const year = selectedDate.getFullYear();
    const capitalized = month.charAt(0).toUpperCase() + month.slice(1);
    return `${capitalized} ${year}`;
  }, [selectedDate]);

  const historialTitle = `Historial ${historialMonthLabel}`;

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Track if initial data has been loaded
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  // Load initial data and set default date range to current month
  useEffect(() => {
    if (!tenantId) return;

    const load = async () => {
      try {
        const [conceptsData, subconceptsData, providersData, generalsData] = await Promise.all([
          conceptService.getAll(tenantId),
          subconceptService.getAll(tenantId),
          providerService.getAll(tenantId),
          generalService.getAll(tenantId),
        ]);
        setConcepts(conceptsData);
        setSubconcepts(subconceptsData);
        setProviders(providersData);
        setGenerals(generalsData);
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError("Error al cargar los datos iniciales");
      } finally {
        setInitialDataLoaded(true);
      }
    };

    const { startDate, endDate } = currentMonthRange();
    setSelectedDate(new Date());
    setFilters(prev => ({ ...prev, startDate, endDate }));
    load();
  }, [tenantId]);

  // Load statistics separately for efficiency
  const loadStatistics = async () => {
    try {
      if (!filters.startDate || !filters.endDate) return;

      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day

      // Build filter object (excluding status since we need all statuses for stats)
      const statsFilters = {
        type:
          filters.type === "entrada" || filters.type === "salida"
            ? filters.type
            : undefined,
        conceptId: filters.conceptId || undefined,
        subconceptId: filters.subconceptId || undefined,
        providerId: filters.providerId || undefined,
        generalId: filters.generalId || undefined,
        division: filters.division || undefined,
        // Don't include status filter for stats
      };

      const stats = await transactionService.getStatsByDateRange(
        startDate,
        endDate,
        statsFilters,
        tenantId
      );

      setTransactionStats(stats);
    } catch (err) {
      console.error("Error loading transaction stats:", err);
      // Don't show error for stats, just use fallback
      setTransactionStats({ pendiente: 0, parcial: 0, pagado: 0, total: 0 });
    }
  };

  // Load transactions when filters change
  useEffect(() => {
    // Only load transactions after initial data has been loaded
    if (!initialDataLoaded) {
      return; // Wait for initial data to load
    }

    const loadTransactions = async () => {
      try {
        setLoading(true);
        setError("");

        let transactionsData;

        if (!tenantId) {
          throw new Error("No tenant ID available");
        }

        // Build filter object
        const appliedFilters = {
          type:
            filters.type === "entrada" || filters.type === "salida"
              ? filters.type
              : undefined,
          conceptId: filters.conceptId || undefined,
          subconceptId: filters.subconceptId || undefined,
          providerId: filters.providerId || undefined,
          generalId: filters.generalId || undefined,
          status: filters.status || undefined,
          division: filters.division || undefined,
        };

        if (filters.startDate && filters.endDate) {
          const startDate = new Date(filters.startDate);
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);

          transactionsData = await transactionService.getByDateRange(
            startDate,
            endDate,
            appliedFilters,
            tenantId
          );
        } else {
          transactionsData = await transactionService.getAll({
            ...appliedFilters,
            limit: ITEMS_PER_PAGE * 10,
          }, tenantId);
        }

        // Client-side search filtering
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          transactionsData = transactionsData.filter((transaction) => {
            const concept = concepts.find((c) => c.id === transaction.conceptId);
            const provider = providers.find(
              (p) => p.id === transaction.providerId
            );
            const general = generals.find((g) => g.id === transaction.generalId);

            return (
              (concept && concept.name.toLowerCase().includes(searchLower)) ||
              (provider && provider.name.toLowerCase().includes(searchLower)) ||
              (general && general.name.toLowerCase().includes(searchLower)) ||
              transaction.amount.toString().includes(searchLower)
            );
          });
        }

        setTotalItems(transactionsData.length);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        setTransactions(transactionsData.slice(startIndex, startIndex + ITEMS_PER_PAGE));
      } catch (err) {
        console.error("Error loading transactions:", err);
        setError("Error al cargar las transacciones");
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [filters, currentPage, concepts, providers, generals, initialDataLoaded, tenantId]);

  // Load statistics when date or non-status filters change
  useEffect(() => {
    if (initialDataLoaded && filters.startDate && filters.endDate) {
      loadStatistics();
    }
  }, [filters.startDate, filters.endDate, filters.type, filters.conceptId, filters.subconceptId, filters.providerId, filters.generalId, filters.division, initialDataLoaded]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      // Cascade resets
      if (key === "generalId") {
        newFilters.conceptId = "";
        newFilters.subconceptId = "";
      }
      if (key === "conceptId") {
        newFilters.subconceptId = "";
      }
      return newFilters;
    });
    setCurrentPage(1);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setFilters(prev => ({
      ...prev,
      startDate: formatDateForInput(new Date(date.getFullYear(), date.getMonth(), 1)),
      endDate: formatDateForInput(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    }));
  };

  const clearFilters = () => {
    const { startDate, endDate } = currentMonthRange();
    setSelectedDate(new Date());
    setFilters({
      type: "",
      conceptId: "",
      subconceptId: "",
      providerId: "",
      generalId: "",
      status: "",
      division: "",
      search: "",
      startDate,
      endDate,
    });
    setCurrentPage(1);
  };

  const filteredConceptOptions = useMemo(() => [
    { value: "", label: "Todos los conceptos" },
    ...concepts
      .filter(c => !filters.generalId || c.generalId === filters.generalId)
      .map(c => ({ value: c.id, label: c.name }))
  ], [concepts, filters.generalId]);

  const filteredSubconceptOptions = useMemo(() => [
    { value: "", label: "Todos los subconceptos" },
    ...subconcepts
      .filter(s => !filters.conceptId || s.conceptId === filters.conceptId)
      .map(s => ({ value: s.id, label: s.name }))
  ], [subconcepts, filters.conceptId]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "";
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    
    // Ajustar la fecha para mostrar la fecha correcta en la zona horaria local
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    
    // Crear una nueva fecha usando solo año, mes y día para evitar problemas de zona horaria
    const adjustedDate = new Date(year, month, day);
    
    return adjustedDate.toLocaleDateString("es-MX");
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pendiente: { color: "bg-red-100 text-red-800", text: "Pendiente" },
      parcial: { color: "bg-yellow-100 text-yellow-800", text: "Parcial" },
      pagado: { color: "bg-green-100 text-green-800", text: "Pagado" },
    };

    const config = statusConfig[status] || statusConfig.pendiente;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.text}
      </span>
    );
  };

  const getConceptName = (conceptId, transaction = null) => {
    // Si es un gasto inicial con conceptName, usar ese nombre
    if (transaction?.isInitialExpense && transaction?.conceptName) {
      return transaction.conceptName;
    }
    
    const concept = concepts.find((c) => c.id === conceptId);
    return concept ? concept.name : "N/A";
  };

  const getProviderName = (providerId, transaction = null) => {
    // Si es un gasto inicial con providerName, usar ese nombre
    if (transaction?.isInitialExpense && transaction?.providerName) {
      return transaction.providerName;
    }
    
    if (!providerId) return "N/A";
    const provider = providers.find((p) => p.id === providerId);
    return provider ? provider.name : "N/A";
  };

  const getGeneralName = (generalId, transaction = null) => {
    // Si es un gasto inicial con generalName, usar ese nombre
    if (transaction?.isInitialExpense && transaction?.generalName) {
      return transaction.generalName;
    }
    
    if (!generalId) return "N/A";
    const general = generals.find((g) => g.id === generalId);
    return general ? general.name : "N/A";
  };

  const getSubconceptName = (subconceptId, transaction = null) => {
    // Si es un gasto inicial con subconceptName, usar ese nombre
    if (transaction?.isInitialExpense && transaction?.subconceptName) {
      return transaction.subconceptName;
    }
    
    if (!subconceptId) return "N/A";
    const subconcept = subconcepts.find((s) => s.id === subconceptId);
    return subconcept ? subconcept.name : "N/A";
  };

  // Función para mostrar el árbol completo: General / Concepto / Subconcepto (subconcepto en negritas)
  const getTreeDisplay = (transaction) => {
    const generalName = getGeneralName(transaction.generalId, transaction);
    const conceptName = getConceptName(transaction.conceptId, transaction);
    const subconceptName = getSubconceptName(transaction.subconceptId, transaction);
    
    // Verificar si el general es de tipo "ambos"
    const general = generals.find((g) => g.id === transaction.generalId);
    const isAmboTree = general?.type === "ambos";
    
    return (
      <div>
        <div className="text-sm text-foreground">
          {generalName} / {conceptName} / <strong>{subconceptName}</strong>
        </div>
        {isAmboTree && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 mt-1">
            Árbol Mixto
          </span>
        )}
      </div>
    );
  };

  // Function to get active filters display
  const getActiveFilters = () => {
    const activeFilters = [];
    
    if (filters.type === "entrada" || filters.type === "salida") {
      activeFilters.push({
        label: "Tipo",
        value: filters.type === "entrada" ? "Entradas" : "Salidas",
        icon: filters.type === "entrada" ? TrendingUp : TrendingDown,
      });
    }
    
    if (filters.status) {
      const statusConfig = {
        pendiente: { label: "Pendiente", icon: ClockIcon },
        parcial: { label: "Parcial", icon: AlertCircleIcon },
        pagado: { label: "Pagado", icon: CheckCircle },
      };
      const config = statusConfig[filters.status];
      activeFilters.push({
        label: 'Estado',
        value: config.label,
        icon: config.icon
      });
    }
    
    if (filters.generalId) {
      const general = generals.find(g => g.id === filters.generalId);
      activeFilters.push({
        label: 'General',
        value: general ? general.name : 'Desconocido',
        icon: Building
      });
    }
    
    if (filters.conceptId) {
      const concept = concepts.find(c => c.id === filters.conceptId);
      activeFilters.push({
        label: 'Concepto',
        value: concept ? concept.name : 'Desconocido',
        icon: Tag
      });
    }

    if (filters.subconceptId) {
      const subconcept = subconcepts.find(s => s.id === filters.subconceptId);
      activeFilters.push({
        label: 'Subconcepto',
        value: subconcept ? subconcept.name : 'Desconocido',
        icon: Layers
      });
    }
    
    if (filters.providerId) {
      const provider = providers.find(p => p.id === filters.providerId);
      activeFilters.push({
        label: 'Proveedor',
        value: provider ? provider.name : 'Desconocido',
        icon: Users
      });
    }
    
    if (filters.division) {
      activeFilters.push({
        label: 'División',
        value: formatDivision(filters.division),
        icon: Layers
      });
    }
    
    if (filters.search) {
      activeFilters.push({
        label: 'Búsqueda',
        value: `"${filters.search}"`,
        icon: Search
      });
    }
    
    return activeFilters;
  };

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const getRemainingAmount = (transaction) => {
    if (transaction.balance !== undefined && transaction.balance !== null) {
      return Math.max(0, transaction.balance);
    }
    return Math.max(0, (transaction.amount || 0));
  };

  const getPaidAmount = (transaction) => {
    if (transaction.totalPaid !== undefined && transaction.totalPaid !== null) {
      return transaction.totalPaid;
    }
    return 0;
  };

  const handleViewDetails = (transactionId) => {
    router.push(`/admin/transacciones/detalle/${transactionId}`);
  };

  return (
    <AdminLayout
      title={historialTitle}
      breadcrumbs={[
        { name: "Dashboard", href: "/admin/dashboard" },
        { name: "Transacciones", href: "/admin/transacciones/entradas" },
        { name: "Historial" },
      ]}
    >
      <div className="space-y-6">
        {/* Visual header */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-slate-600 rounded-xl shadow-lg">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {historialTitle}
                </h1>
                <p className="text-gray-600 mt-1">
                  Consulta y filtra las transacciones del mes seleccionado.
                </p>
              </div>
            </div>
            
            {/* Date Selector in Header */}
            <div className="flex-shrink-0">
              <AdvancedDateSelector
                currentDate={selectedDate}
                onDateChange={handleDateChange}
                onSuccess={() => {}}
                onError={() => {}}
                accentColor="gray"
              />
            </div>
          </div>
        </div>
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4 space-y-3">

            {/* Fila 1: Búsqueda + Tipo + Estado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Búsqueda */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  <Search className="w-4 h-4 mr-1.5" />
                  Búsqueda
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Buscar por concepto, proveedor, monto..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent transition-all h-[44px] bg-white"
                />
              </div>

              {/* Tipo */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  Tipo
                </label>
                <Select
                  value={typeOptions.find(option => option.value === filters.type) || null}
                  onChange={(selectedOption) => handleFilterChange("type", selectedOption?.value || "")}
                  options={typeOptions}
                  styles={selectStyles}
                  placeholder="Todos los tipos"
                  isClearable
                  isSearchable={false}
                />
              </div>

              {/* Estado */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Estado
                </label>
                <Select
                  value={statusOptions.find(option => option.value === filters.status) || null}
                  onChange={(selectedOption) => handleFilterChange("status", selectedOption?.value || "")}
                  options={statusOptions}
                  styles={selectStyles}
                  placeholder="Todos los estados"
                  isClearable
                  isSearchable={false}
                />
              </div>
            </div>

            {/* Fila 2: General → Concepto (cascada) → Subconcepto (cascada) + Proveedor */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* General */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  <Building className="w-4 h-4 mr-1.5" />
                  General
                </label>
                <Select
                  value={generalOptions.find(option => option.value === filters.generalId) || null}
                  onChange={(selectedOption) => handleFilterChange("generalId", selectedOption?.value || "")}
                  options={generalOptions}
                  styles={selectStyles}
                  placeholder="Todos los generales"
                  isClearable
                  isSearchable
                />
              </div>

              {/* Concepto — se activa al seleccionar un General */}
              <div className="flex flex-col">
                <label className={`flex items-center text-sm font-medium mb-1.5 ${filters.generalId ? "text-gray-700" : "text-gray-400"}`}>
                  <Tag className="w-4 h-4 mr-1.5" />
                  Concepto
                  {!filters.generalId && <span className="ml-1.5 text-xs">(selecciona General)</span>}
                </label>
                <Select
                  value={filteredConceptOptions.find(option => option.value === filters.conceptId) || null}
                  onChange={(selectedOption) => handleFilterChange("conceptId", selectedOption?.value || "")}
                  options={filteredConceptOptions}
                  styles={selectStyles}
                  placeholder={filters.generalId ? "Todos los conceptos" : "Primero un General"}
                  isClearable
                  isSearchable
                  isDisabled={!filters.generalId}
                />
              </div>

              {/* Subconcepto — se activa al seleccionar un Concepto */}
              <div className="flex flex-col">
                <label className={`flex items-center text-sm font-medium mb-1.5 ${filters.conceptId ? "text-gray-700" : "text-gray-400"}`}>
                  <Layers className="w-4 h-4 mr-1.5" />
                  Subconcepto
                  {!filters.conceptId && <span className="ml-1.5 text-xs">(selecciona Concepto)</span>}
                </label>
                <Select
                  value={filteredSubconceptOptions.find(option => option.value === filters.subconceptId) || null}
                  onChange={(selectedOption) => handleFilterChange("subconceptId", selectedOption?.value || "")}
                  options={filteredSubconceptOptions}
                  styles={selectStyles}
                  placeholder={filters.conceptId ? "Todos los subconceptos" : "Primero un Concepto"}
                  isClearable
                  isSearchable
                  isDisabled={!filters.conceptId}
                />
              </div>

              {/* Proveedor — independiente */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1.5">
                  <Users className="w-4 h-4 mr-1.5" />
                  Proveedor
                </label>
                <Select
                  value={providerOptions.find(option => option.value === filters.providerId) || null}
                  onChange={(selectedOption) => handleFilterChange("providerId", selectedOption?.value || "")}
                  options={providerOptions}
                  styles={selectStyles}
                  placeholder="Todos los proveedores"
                  isClearable
                  isSearchable
                />
              </div>
            </div>

            {/* Contador de resultados + Limpiar */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-gray-600">
                {totalItems} transacciones encontradas
              </p>
              {getActiveFilters().length > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {getActiveFilters().length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-3">
              <Filter className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  Filtrando por:
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {getActiveFilters().map((filter, index) => {
                    const IconComponent = filter.icon;
                    return (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                      >
                        <IconComponent className="w-3 h-3 mr-1.5 flex-shrink-0" />
                        <span className="font-medium">{filter.label}:</span>
                        <span className="ml-1 truncate">{filter.value}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-slate-600 rounded-lg">
                  <ClockIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Transacciones
                  </h2>
                  <p className="text-sm text-gray-600">
                    {totalItems} resultado{totalItems !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  {transactionStats.pendiente}{" "}
                  Pendientes
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  {transactionStats.parcial}{" "}
                  Parciales
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {transactionStats.pagado}{" "}
                  Pagadas
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-400">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center">
              <div className="max-w-sm mx-auto">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-slate-600 mx-auto"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 bg-slate-600 rounded-full opacity-20"></div>
                  </div>
                </div>
                <p className="text-gray-600 mt-4 font-medium">
                  Cargando transacciones...
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Por favor espera un momento
                </p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                No se encontraron transacciones
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Concepto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Proveedor
                      </th>
                      {/* <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        División
                      </th> */}
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {formatDate(transaction.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              transaction.type === "entrada"
                                ? "bg-green-100 text-green-800"
                                : transaction.type === "salida"
                                ? "bg-red-100 text-red-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {transaction.type === "entrada"
                              ? "Entrada"
                              : transaction.type === "salida"
                              ? "Salida"
                              : "Ambos"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {getTreeDisplay(transaction)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {getProviderName(transaction.providerId, transaction)}
                        </td>
                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {transaction.type === 'salida' ? formatDivision(transaction.division) : '-'}
                        </td> */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-gray-900">{formatCurrency(transaction.amount)}</span>
                            {(transaction.status === "parcial" || transaction.status === "pagado") && getPaidAmount(transaction) > 0 && (
                              <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                                Pagado: {formatCurrency(getPaidAmount(transaction))}
                              </span>
                            )}
                            {(transaction.status === "pendiente" || transaction.status === "parcial") && getRemainingAmount(transaction) > 0 && (
                              <span className="text-xs text-gray-600 bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5">
                                Saldo: {formatCurrency(getRemainingAmount(transaction))}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewDetails(transaction.id)}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors cursor-pointer"
                            title="Ver detalles"
                          >
                            <EyeIcon className="h-4 w-4" /> 
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              transaction.type === "entrada"
                                ? "bg-green-100 text-green-800"
                                : transaction.type === "salida"
                                ? "bg-red-100 text-red-800"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            {transaction.type === "entrada"
                              ? "Entrada"
                              : transaction.type === "salida"
                              ? "Salida"
                              : "Ambos"}
                          </span>
                          {getStatusBadge(transaction.status)}
                        </div>
                        <div className="mb-2">
                          {getTreeDisplay(transaction)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getProviderName(transaction.providerId, transaction)}
                        </p>
                        {/* {transaction.type === 'salida' && transaction.division && (
                          <p className="text-sm text-muted-foreground">
                            {formatDivision(transaction.division)}
                          </p>
                        )} */}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-foreground">
                          {formatCurrency(transaction.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleViewDetails(transaction.id)}
                        className="text-sm text-primary hover:text-primary/80 transition-colors"
                      >
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    {/* Mobile */}
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                    {/* Desktop */}
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Mostrando{" "}
                          <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a{" "}
                          <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}</span>{" "}
                          de{" "}
                          <span className="font-medium">{totalItems}</span>{" "}
                          resultados
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Anterior</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                            if (
                              page === 1 ||
                              page === totalPages ||
                              Math.abs(page - currentPage) <= 1
                            ) {
                              return (
                                <button
                                  key={page}
                                  onClick={() => handlePageChange(page)}
                                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                    page === currentPage
                                      ? "z-10 bg-slate-100 border-slate-500 text-slate-700"
                                      : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            } else if (
                              page === currentPage - 2 ||
                              page === currentPage + 2
                            ) {
                              return (
                                <span
                                  key={page}
                                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                                >
                                  ...
                                </span>
                              );
                            }
                            return null;
                          })}
                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="sr-only">Siguiente</span>
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Historial;
