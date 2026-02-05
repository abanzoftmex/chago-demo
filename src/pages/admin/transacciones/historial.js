import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import AdvancedDateSelector from "../../../components/dashboard/AdvancedDateSelector";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { descriptionService } from "../../../lib/services/descriptionService";
import { providerService } from "../../../lib/services/providerService";
import { generalService } from "../../../lib/services/generalService";
import { DIVISIONS, formatDivision } from "../../../lib/constants/divisions";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Users, 
  Tag, 
  Building, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw,
  ClockIcon,
  EyeIcon,
  X,
  Layers
} from "lucide-react";
import Select from "react-select";

const Historial = () => {
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [transactionStats, setTransactionStats] = useState({ pendiente: 0, parcial: 0, pagado: 0, total: 0 });
  const [concepts, setConcepts] = useState([]);
  const [descriptions, setDescriptions] = useState([]);
  const [providers, setProviders] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Custom styles for React Select
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
    option: (provided, state) => ({
      ...provided,
      fontSize: '14px',
      padding: '10px 14px'
    })
  };

  // Options for React Select
  const typeOptions = [
    { value: "", label: "Todos los tipos" },
    { value: "entrada", label: "Entradas" },
    { value: "salida", label: "Salidas" }
  ];

  const statusOptions = [
    { value: "", label: "Todos los estados" },
    { value: "pendiente", label: "Pendiente" },
    { value: "parcial", label: "Parcial" },
    { value: "pagado", label: "Pagado" }
  ];

  const generalOptions = [
    { value: "", label: "Todas las categorías" },
    ...generals.map(general => ({
      value: general.id,
      label: general.name
    }))
  ];

  const conceptOptions = [
    { value: "", label: "Todos los conceptos" },
    ...concepts.map(concept => ({
      value: concept.id,
      label: concept.name
    }))
  ];

  const providerOptions = [
    { value: "", label: "Todos los proveedores" },
    ...providers.map(provider => ({
      value: provider.id,
      label: provider.name
    }))
  ];

  const divisionOptions = [
    { value: "", label: "Todas las divisiones" },
    ...DIVISIONS.map(division => ({
      value: division.value,
      label: division.label
    }))
  ];

  // Filters
  const [filters, setFilters] = useState({
    type: "",
    conceptId: "",
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  // Track if initial data has been loaded
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const loadInitialData = async () => {
    try {
      const [conceptsData, providersData, generalsData] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        generalService.getAll(),
      ]);

      setConcepts(conceptsData);
      setProviders(providersData);
      setGenerals(generalsData);
      setInitialDataLoaded(true);
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError("Error al cargar los datos iniciales");
      setInitialDataLoaded(true); // Set to true even on error to prevent infinite loading
    }
  };

  // Load initial data and set default date range to current month
  useEffect(() => {
    loadInitialData();
    
    // Set default date to current month for AdvancedDateSelector
    const now = new Date();
    setSelectedDate(now);
    
    // Set default date range to current month
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Format dates as YYYY-MM-DD for input type="date"
    const formatDateForInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    setFilters(prev => ({
      ...prev,
      startDate: formatDateForInput(firstDay),
      endDate: formatDateForInput(lastDay)
    }));
  }, []);

  // Load statistics separately for efficiency
  const loadStatistics = async () => {
    try {
      if (!filters.startDate || !filters.endDate) return;

      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of day

      // Build filter object (excluding status since we need all statuses for stats)
      const statsFilters = {
        type: filters.type || undefined,
        conceptId: filters.conceptId || undefined,
        providerId: filters.providerId || undefined,
        generalId: filters.generalId || undefined,
        division: filters.division || undefined,
        // Don't include status filter for stats
      };

      const stats = await transactionService.getStatsByDateRange(
        startDate,
        endDate,
        statsFilters
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

        // Build filter object
        const appliedFilters = {
          type: filters.type || undefined,
          conceptId: filters.conceptId || undefined,
          providerId: filters.providerId || undefined,
          generalId: filters.generalId || undefined,
          status: filters.status || undefined,
          division: filters.division || undefined,
        };

        // If date range is specified, use date range query
        if (filters.startDate && filters.endDate) {
          const startDate = new Date(filters.startDate);
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day

          transactionsData = await transactionService.getByDateRange(
            startDate,
            endDate,
            appliedFilters
          );
        } else {
          // Use regular getAll with filters
          transactionsData = await transactionService.getAll({
            ...appliedFilters,
            limit: itemsPerPage * 2, // Load more for client-side filtering
          });
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

        // Pagination
        setTotalItems(transactionsData.length);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedData = transactionsData.slice(
          startIndex,
          startIndex + itemsPerPage
        );

        setTransactions(paginatedData);

        // Load statistics separately for badges
        await loadStatistics();
      } catch (err) {
        console.error("Error loading transactions:", err);
        setError("Error al cargar las transacciones");
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [filters, currentPage, concepts, providers, generals, itemsPerPage, initialDataLoaded]);

  // Load statistics when date or non-status filters change
  useEffect(() => {
    if (initialDataLoaded && filters.startDate && filters.endDate) {
      loadStatistics();
    }
  }, [filters.startDate, filters.endDate, filters.type, filters.conceptId, filters.providerId, filters.generalId, filters.division, initialDataLoaded]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      return newFilters;
    });
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    
    // Calculate start and end of month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    // Format dates as YYYY-MM-DD
    const formatDateForInput = (dateObj) => {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    setFilters(prev => ({
      ...prev,
      startDate: formatDateForInput(startOfMonth),
      endDate: formatDateForInput(endOfMonth)
    }));
  };

  const clearFilters = () => {
    const now = new Date();
    setSelectedDate(now);
    
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const formatDateForInput = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    setFilters({
      type: "",
      conceptId: "",
      providerId: "",
      generalId: "",
      status: "",
      division: "",
      search: "",
      startDate: formatDateForInput(firstDay),
      endDate: formatDateForInput(lastDay),
    });
    setCurrentPage(1);
  };

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

  // Function to get active filters display
  const getActiveFilters = () => {
    const activeFilters = [];
    
    if (filters.type) {
      activeFilters.push({
        label: 'Tipo',
        value: filters.type === 'entrada' ? 'Entradas' : 'Salidas',
        icon: filters.type === 'entrada' ? TrendingUp : TrendingDown
      });
    }
    
    if (filters.status) {
      const statusConfig = {
        'pendiente': { label: 'Pendiente', icon: Clock },
        'parcial': { label: 'Parcial', icon: AlertCircle },
        'pagado': { label: 'Pagado', icon: CheckCircle }
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

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const handleViewDetails = (transactionId) => {
    router.push(`/admin/transacciones/detalle/${transactionId}`);
  };

  return (
    <AdminLayout
      title="Historial"
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
                <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
                <p className="text-gray-600 mt-1">
                  Consulta y filtra todas las transacciones
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
              />
            </div>
          </div>
        </div>
        {/* Filters Only */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-4">
            {/* Filters Grid - Full width distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 mb-4">
              {/* Search */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Search className="w-4 h-4 mr-1.5" />
                  Búsqueda
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out h-[44px]"
                />
              </div>

              {/* Type Filter */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <TrendingUp className="w-4 h-4 mr-1.5" />
                  Tipo
                </label>
                <Select
                  value={typeOptions.find(option => option.value === filters.type)}
                  onChange={(selectedOption) => handleFilterChange("type", selectedOption?.value || "")}
                  options={typeOptions}
                  styles={selectStyles}
                  placeholder="Seleccionar..."
                  isClearable
                  isSearchable={false}
                />
              </div>

              {/* Status Filter */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  Estado
                </label>
                <Select
                  value={statusOptions.find(option => option.value === filters.status)}
                  onChange={(selectedOption) => handleFilterChange("status", selectedOption?.value || "")}
                  options={statusOptions}
                  styles={selectStyles}
                  placeholder="Seleccionar..."
                  isClearable
                  isSearchable={false}
                />
              </div>

              {/* General Filter */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Building className="w-4 h-4 mr-1.5" />
                  General
                </label>
                <Select
                  value={generalOptions.find(option => option.value === filters.generalId)}
                  onChange={(selectedOption) => handleFilterChange("generalId", selectedOption?.value || "")}
                  options={generalOptions}
                  styles={selectStyles}
                  placeholder="Seleccionar..."
                  isClearable
                  isSearchable
                />
              </div>

              {/* Concept Filter */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Tag className="w-4 h-4 mr-1.5" />
                  Concepto
                </label>
                <Select
                  value={conceptOptions.find(option => option.value === filters.conceptId)}
                  onChange={(selectedOption) => handleFilterChange("conceptId", selectedOption?.value || "")}
                  options={conceptOptions}
                  styles={selectStyles}
                  placeholder="Seleccionar..."
                  isClearable
                  isSearchable
                />
              </div>

              {/* Provider Filter */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 mr-1.5" />
                  Proveedor
                </label>
                <Select
                  value={providerOptions.find(option => option.value === filters.providerId)}
                  onChange={(selectedOption) => handleFilterChange("providerId", selectedOption?.value || "")}
                  options={providerOptions}
                  styles={selectStyles}
                  placeholder="Seleccionar..."
                  isClearable
                  isSearchable
                />
              </div>

              {/* Division Filter */}
              <div className="flex flex-col">
                <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                  <Layers className="w-4 h-4 mr-1.5" />
                  División
                </label>
                <Select
                  value={divisionOptions.find(option => option.value === filters.division)}
                  onChange={(selectedOption) => handleFilterChange("division", selectedOption?.value || "")}
                  options={divisionOptions}
                  styles={selectStyles}
                  placeholder="Seleccionar..."
                  isClearable
                  isSearchable={false}
                />
              </div>

              {/* Clear Filters */}
              {getActiveFilters().length > 0 && (
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-transparent mb-2">
                    Acciones
                  </label>
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center justify-center px-3 py-2.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors h-[44px] w-full"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            {/* Results Counter */}
            <div className="text-sm text-gray-600">
              {totalItems} transacciones encontradas
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
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">
                Cargando transacciones...
              </p>
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
                        General
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Concepto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Proveedor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        División
                      </th>
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
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {transaction.type === "entrada"
                              ? "Entrada"
                              : "Salida"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {getGeneralName(transaction.generalId, transaction)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {getConceptName(transaction.conceptId, transaction)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {getProviderName(transaction.providerId, transaction)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {transaction.type === 'salida' ? formatDivision(transaction.division) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(transaction.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewDetails(transaction.id)}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors"
                            title="Ver detalles"
                            cursor="pointer"
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
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {transaction.type === "entrada"
                              ? "Entrada"
                              : "Salida"}
                          </span>
                          {getStatusBadge(transaction.status)}
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {getGeneralName(transaction.generalId, transaction)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getConceptName(transaction.conceptId, transaction)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getProviderName(transaction.providerId, transaction)}
                        </p>
                        {transaction.type === 'salida' && transaction.division && (
                          <p className="text-sm text-muted-foreground">
                            {formatDivision(transaction.division)}
                          </p>
                        )}
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
                <div className="px-6 py-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                      {Math.min(currentPage * itemsPerPage, totalItems)} de{" "}
                      {totalItems} resultados
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Anterior
                      </button>

                      <div className="flex items-center space-x-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-1 text-sm border rounded-md transition-colors ${
                                  currentPage === pageNum
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border hover:bg-muted"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages)
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Siguiente
                      </button>
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
