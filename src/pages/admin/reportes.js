import { useState, useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import AdvancedDateSelector from "../../components/dashboard/AdvancedDateSelector";
import { reportService } from "../../lib/services/reportService";
import { dashboardService } from "../../lib/services/dashboardService";
import { generalService } from "../../lib/services/generalService";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";
import { transactionService } from "../../lib/services/transactionService";
import { providerService } from "../../lib/services/providerService";
import { carryoverService } from "../../lib/services/carryoverService";
import { DIVISIONS, formatDivision } from "../../lib/constants/divisions";
import { useAuth } from "../../context/AuthContext";
import useReportStore from "../../lib/stores/reportStore";
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ClockIcon,
  XMarkIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

const Reportes = () => {
  const { success, error } = useToast();
  const { user } = useAuth();
  const { showIncomeInBreakdown, toggleShowIncomeInBreakdown } = useReportStore();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [calculatingCarryover, setCalculatingCarryover] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [generals, setGenerals] = useState([]);
  const [showCarryoverPanel, setShowCarryoverPanel] = useState(false);
  const [carryoverTransactions, setCarryoverTransactions] = useState([]);
  const [carryoverInfo, setCarryoverInfo] = useState(null);
  const [carryoverStatus, setCarryoverStatus] = useState({
    executed: false,
    canExecute: false,
    data: null
  });

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    type: "",
    generalId: "",
    conceptId: "",
    subconceptId: "",
    division: "",
  });
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [concepts, setConcepts] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);

  useEffect(() => {
    loadReferenceData();
    // Load initial report with current month
    handleDateChange(currentDate);
  }, []);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
    const startOfMonth = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
    const endOfMonth = new Date(
      newDate.getFullYear(),
      newDate.getMonth() + 1,
      0
    );

    // Update month name
    updateMonthName(newDate);

    // Update filters with proper time handling
    setFilters((prev) => ({
      ...prev,
      startDate: startOfMonth.toISOString().split("T")[0],
      endDate: endOfMonth.toISOString().split("T")[0],
    }));
  };

  const updateMonthName = (date) => {
    const monthName = date.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
    setCurrentMonthName(monthName.charAt(0).toUpperCase() + monthName.slice(1));
  };

  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      generateReport();
      loadCarryoverInfo();
    }
  }, [filters]);

  useEffect(() => {
    updateMonthName(currentDate);
  }, [currentDate]);

  const loadReferenceData = async () => {
    try {
      const [generalsData, conceptsData, subconceptsData] = await Promise.all([
        generalService.getAll(),
        conceptService.getAll(),
        subconceptService.getAll(),
      ]);
      setGenerals(generalsData);
      setConcepts(conceptsData);
      setSubconcepts(subconceptsData);
    } catch (err) {
      console.error("Error loading reference data:", err);
      error("Error al cargar datos de referencia");
    }
  };

  // Determinar el tipo de transacción basado en los filtros seleccionados
  // Ahora es simple porque los filtros están en cascada y siempre tenemos el tipo
  const getFilteredTransactionType = () => {
    // Si hay filtro de tipo, retornarlo (siempre debe estar si hay general/concepto/subconcepto)
    return filters.type || null;
  };

  const calculateCarryoverManually = async () => {
    try {
      setCalculatingCarryover(true);
      
      // Obtener año y mes del reporte actual
      const startDateParts = filters.startDate.split('-');
      const year = parseInt(startDateParts[0]);
      const month = parseInt(startDateParts[1]);

      console.log(`🔄 Calculando arrastre manualmente para ${month}/${year}`);
      
      // Calcular y guardar el arrastre
      const carryoverData = await carryoverService.calculateAndSaveCarryover(year, month);
      
      success(`Arrastre calculado: ${carryoverData.saldoArrastre.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} para ${month}/${year}`);
      
      // Actualizar el estado
      setCarryoverStatus({
        calculated: true,
        executed: true,
        canExecute: false,
        data: carryoverData
      });
      
      // Regenerar el reporte para mostrar el nuevo arrastre
      if (stats) {
        await generateReport();
      }
    } catch (err) {
      console.error('Error calculando arrastre:', err);
      error('Error al calcular el arrastre: ' + err.message);
    } finally {
      setCalculatingCarryover(false);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);

      // Construir fechas correctamente para evitar problemas de zona horaria
      let startDate = null;
      let endDate = null;

      if (filters.startDate) {
        const startParts = filters.startDate.split('-');
        startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
      }

      if (filters.endDate) {
        const endParts = filters.endDate.split('-');
        endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
      }

      const filterData = {
        ...filters,
        startDate: startDate,
        endDate: endDate,
        conceptId: filters.conceptId || null,
        subconceptId: filters.subconceptId || null,
        division: filters.division || null,
      };

      // Verificar si estamos viendo el mes actual y calcular arrastre automáticamente
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (filterData.startDate && filterData.endDate) {
        const filterYear = filterData.startDate.getFullYear();
        const filterMonth = filterData.startDate.getMonth() + 1;

        // Si estamos viendo el mes actual, verificar arrastre automáticamente
        if (filterYear === currentYear && filterMonth === currentMonth) {
          console.log('Verificando cálculo de arrastre automático para el mes actual...');
          try {
            const carryoverResult = await reportService.checkAndCalculateCarryoverIfNeeded();
            if (carryoverResult.calculated) {
              console.log('✅ Arrastre calculado automáticamente:', carryoverResult.message);
            } else if (carryoverResult.error) {
              console.warn('Error en verificación de arrastre:', carryoverResult.message);
            }
          } catch (error) {
            console.warn('Error verificando arrastre automático:', error.message);
          }
        }
      }

      const transactionsData =
        await reportService.getFilteredTransactions(filterData);
      const statsData = await reportService.generateReportStats(
        transactionsData,
        filterData
      );

      setTransactions(transactionsData);
      setStats(statsData);

      success("Reporte generado exitosamente");
    } catch (err) {
      console.error("Error generating report:", err);
      error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const loadCarryoverTransactions = async () => {
    try {
      // Get ALL pending transactions but filter by month like the backend
      const allTransactions = await transactionService.getAll({
        type: 'salida',
        status: 'pendiente'
      });

      // Filter pending transactions to only include those up to the report month
      const reportEndDate = new Date(filters.endDate);
      const reportYear = reportEndDate.getFullYear();
      const reportMonth = reportEndDate.getMonth(); // 0-based

      const pendingFromPrevious = allTransactions.filter(transaction => {
        if (transaction.status !== 'pendiente') return false;

        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const transactionYear = transactionDate.getFullYear();
        const transactionMonth = transactionDate.getMonth();

        // Only include pending transactions up to the report month
        return (transactionYear < reportYear) ||
          (transactionYear === reportYear && transactionMonth <= reportMonth);
      });

      console.log('🔍 Frontend - Filtrado de gastos pendientes:', {
        reportMonth: `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`,
        totalPendingInSystem: allTransactions.length,
        pendingUntilReportMonth: pendingFromPrevious.length,
        filteredOut: allTransactions.length - pendingFromPrevious.length
      });

      // Get reference data for display
      const [conceptsData, providersData, generalsData] = await Promise.all([
        conceptService.getAll(),
        providerService.getAll(),
        generalService.getAll()
      ]);

      // Enrich transactions with reference data
      const enrichedTransactions = pendingFromPrevious.map(transaction => ({
        ...transaction,
        conceptName: conceptsData.find(c => c.id === transaction.conceptId)?.name || 'Sin concepto',
        providerName: providersData.find(p => p.id === transaction.providerId)?.name || 'Sin proveedor',
        generalName: generalsData.find(g => g.id === transaction.generalId)?.name || 'Sin categoría'
      }));

      setCarryoverTransactions(enrichedTransactions);
      setShowCarryoverPanel(true);
    } catch (err) {
      console.error("Error loading carryover transactions:", err);
      error("Error al cargar transacciones de arrastre");
    }
  };

  const loadCarryoverInfo = async () => {
    try {
      if (filters.startDate) {
        // Parsear la fecha correctamente evitando problemas de zona horaria
        let startDateStr = filters.startDate;
        if (filters.startDate instanceof Date) {
          startDateStr = filters.startDate.toISOString().split('T')[0];
        }

        const startDateParts = startDateStr.split('-');
        const year = parseInt(startDateParts[0]);
        const month = parseInt(startDateParts[1]);

        console.log(`🔍 checkCarryoverStatus: startDate=${startDateStr}, year=${year}, month=${month}`);

        const status = await reportService.getCarryoverStatus(year, month);
        console.log(`📊 checkCarryoverStatus: status recibido:`, status);

        setCarryoverStatus(status);
        setCarryoverInfo(status.data);
      }
    } catch (err) {
      console.warn("No se pudo cargar información de arrastre:", err.message);
      setCarryoverInfo(null);
      setCarryoverStatus({
        executed: false,
        canExecute: false,
        data: null
      });
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [field]: value };

      // Limpiar filtros dependientes en cascada
      if (field === "type") {
        // Si cambia el tipo, limpiar general, concepto y subconcepto
        newFilters.generalId = "";
        newFilters.conceptId = "";
        newFilters.subconceptId = "";
      } else if (field === "generalId") {
        // Si cambia el general, limpiar concepto y subconcepto
        newFilters.conceptId = "";
        newFilters.subconceptId = "";
      } else if (field === "conceptId") {
        // Si cambia el concepto, limpiar subconcepto
        newFilters.subconceptId = "";
      }

      return newFilters;
    });
  };

  // Filtrar generals por tipo seleccionado
  const getFilteredGenerals = () => {
    if (!filters.type) {
      return [];
    }
    return generals.filter((general) => general.type === filters.type);
  };

  // Filtrar concepts por general seleccionado
  const getFilteredConcepts = () => {
    if (!filters.generalId) {
      return [];
    }
    return concepts.filter((concept) => concept.generalId === filters.generalId);
  };

  // Filtrar subconcepts por concepto seleccionado

  const getFilteredSubconcepts = () => {
    if (!filters.conceptId) {
      return [];
    }
    return subconcepts.filter(
      (subconcept) => subconcept.conceptId === filters.conceptId
    );
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const filename = await reportService.exportToExcel(
        transactions,
        stats,
        filters
      );
      success(`Reporte exportado a Excel: ${filename}`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      error("Error al exportar a Excel");
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const filename = await reportService.exportToPDF(
        transactions,
        stats,
        filters
      );
      success(`Reporte exportado a PDF: ${filename}`);
    } catch (err) {
      console.error("Error exporting to PDF:", err);
      error("Error al exportar a PDF");
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatPercentage = (amount, total) => {
    if (total === 0) return "0%";
    const percentage = (amount / total) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  // Función para determinar si una categoría/concepto es principalmente ingreso
  const isMainlyIncome = (data) => {
    return data.entradas > 0 && data.salidas === 0;
  };

  // Función para formatear el porcentaje según si es ingreso o gasto
  const formatSmartPercentage = (data, totalSalidas, totalEntradas) => {
    if (isMainlyIncome(data)) {
      // Es un ingreso, calcular porcentaje del total de ingresos
      return (
        <span className="flex items-center">
          <ArrowUpIcon className="h-4 w-4 mr-1" />
          {formatPercentage(data.entradas, totalEntradas)}
        </span>
      );
    } else {
      // Es un gasto, calcular porcentaje del total de gastos
      return (
        <span className="flex items-center">
          <ArrowDownIcon className="h-4 w-4 mr-1" />
          {formatPercentage(data.salidas, totalSalidas)}
        </span>
      );
    }
  };

  return (
    <AdminLayout
      title="Reportes"
      breadcrumbs={[
        { name: "Dashboard", href: "/admin/dashboard" },
        { name: "Reportes" },
      ]}
    >
      <div className="space-y-6">
        {/* Filters Section */}
        <div className="bg-background rounded-lg border border-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Filtros de Reporte: {currentMonthName}
            </h2>
            <AdvancedDateSelector
              currentDate={currentDate}
              onDateChange={handleDateChange}
              onSuccess={success}
              onError={error}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Todos</option>
                <option value="entrada">Ingreso</option>
                <option value="salida">Gasto</option>
              </select>
            </div>

            {/* General Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                General
              </label>
              <select
                value={filters.generalId}
                onChange={(e) =>
                  handleFilterChange("generalId", e.target.value)
                }
                disabled={!filters.type}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">{!filters.type ? 'Selecciona un tipo primero' : 'Todos'}</option>
                {getFilteredGenerals().map((general) => (
                  <option key={general.id} value={general.id}>
                    {general.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Concept Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Concepto
              </label>
              <select
                value={filters.conceptId}
                onChange={(e) =>
                  handleFilterChange("conceptId", e.target.value)
                }
                disabled={!filters.generalId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">{!filters.generalId ? 'Selecciona un general primero' : 'Todos'}</option>
                {getFilteredConcepts().map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subconcept Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Sub-concepto
              </label>
              <select
                value={filters.subconceptId}
                onChange={(e) =>
                  handleFilterChange("subconceptId", e.target.value)
                }
                disabled={!filters.conceptId}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">{!filters.conceptId ? 'Selecciona un concepto primero' : 'Todos'}</option>
                {getFilteredSubconcepts().map((subconcept) => (
                  <option key={subconcept.id} value={subconcept.id}>
                    {subconcept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Division Filter - OCULTO POR AHORA */}
            {/* <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                División
              </label>
              <select
                value={filters.division}
                onChange={(e) =>
                  handleFilterChange("division", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">Todas</option>
                {DIVISIONS.map((division) => (
                  <option key={division.value} value={division.value}>
                    {division.label}
                  </option>
                ))}
              </select>
            </div> */}
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={generateReport}
              disabled={loading}
              variant="primary"
              size="md"
              className="inline-flex items-center"
            >
              {loading ? "Generando..." : "Generar Reporte"}
            </Button>

            <div className="flex space-x-2">
              <Button
                onClick={exportToExcel}
                disabled={!stats || exporting}
                variant="outline"
                size="sm"
                className="inline-flex items-center border-green-500 text-green-600 hover:bg-green-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                {exporting ? "Exportando..." : "Excel"}
              </Button>
              <Button
                onClick={exportToPDF}
                disabled={!stats || exporting}
                variant="outline"
                size="sm"
                className="inline-flex items-center border-red-500 text-red-600 hover:bg-red-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                {exporting ? "Exportando..." : "PDF"}
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Summary */}
        {stats && (
          <div className="space-y-6">
            {/* Current Period Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-lime-50 rounded-lg border border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Total de Ingresos
                    </h3>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(getFilteredTransactionType() === 'salida' ? 0 : stats.totalEntradas)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getFilteredTransactionType() === 'salida' ? 0 : stats.entradasCount} transacciones
                    </p>
                  </div>
                  <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
                </div>
              </div>


              <div className="bg-red-50 rounded-lg border border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Total de Gastos
                    </h3>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(getFilteredTransactionType() === 'entrada' ? 0 : stats.totalSalidas)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getFilteredTransactionType() === 'entrada' ? 0 : stats.salidasCount} transacciones
                    </p>
                  </div>
                  <CurrencyDollarIcon className="h-8 w-8 text-red-600" />
                </div>
              </div>

              {/* Balance Total
              <div className="bg-background rounded-lg border border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Balance Total
                    </h3>
                    <p
                      className={`text-2xl font-bold ${stats.totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {formatCurrency(stats.totalBalance)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Incluye arrastre
                    </p>
                  </div>
                  <ChartBarIcon
                    className={`h-8 w-8 ${stats.totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                  />
                </div>
              </div> */}

              <div className="bg-purple-50 rounded-lg border border-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Total de Transacciones
                    </h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {getFilteredTransactionType() === 'entrada' 
                        ? stats.entradasCount 
                        : getFilteredTransactionType() === 'salida' 
                          ? stats.salidasCount 
                          : stats.entradasCount + stats.salidasCount
                      }
                    </p>
                    <p className="text-sm text-muted-foreground">
                      En el período
                    </p>
                  </div>
                  <DocumentTextIcon className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Weekly Breakdown for Entradas - PRIMERO */}
            {stats && (!getFilteredTransactionType() || getFilteredTransactionType() === 'entrada') && (
              <div className="bg-background rounded-lg border border-border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-lime-700">
                    Resumen Mes {currentMonthName} - Ingresos
                  </h3>
                </div>

                {stats.weeklyBreakdown && stats.weeklyBreakdown.weeks ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-lime-100">
                        <tr>
                          <th rowSpan={2} className="px-6 py-3 text-center text-sm font-bold text-lime-800 bg-lime-200 tracking-wider border-r-2 border-lime-200">
                            Concepto
                          </th>
                          <th colSpan={stats.weeklyBreakdown.weeks.length} className="px-6 py-3 text-center text-sm font-bold bg-lime-200 text-lime-800 tracking-wider border-r-2 border-lime-200">
                            Semanas
                          </th>
                          <th rowSpan={2} className="px-6 py-3 text-center text-sm font-bold tracking-wider text-lime-800 bg-lime-200">
                            Totales
                          </th>
                        </tr>
                        <tr>
                          {stats.weeklyBreakdown.weeks.map((week, index) => {
                            return (
                            <th key={index} className="px-6 py-3 text-center text-xs font-medium text-lime-800 tracking-wider bg-lime-50">
                              <div>{week.weekNumber || (index + 1)}</div>
                              {(() => {
                                try {
                                  if (!week.startDate || !week.endDate) {
                                    return null;
                                  }
                                  
                                  // Parse dates - handle both Firestore Timestamp and "dd/MM" string format
                                  let startDate, endDate;
                                  
                                  if (typeof week.startDate === 'string' && week.startDate.includes('/')) {
                                    // Format "dd/MM" - need to add year
                                    const currentYear = new Date(filters.startDate || currentDate).getFullYear();
                                    const [dayStart, monthStart] = week.startDate.split('/');
                                    startDate = new Date(currentYear, parseInt(monthStart) - 1, parseInt(dayStart));
                                  } else {
                                    startDate = week.startDate?.toDate ? week.startDate.toDate() : new Date(week.startDate);
                                  }
                                  
                                  if (typeof week.endDate === 'string' && week.endDate.includes('/')) {
                                    // Format "dd/MM" - need to add year
                                    const currentYear = new Date(filters.startDate || currentDate).getFullYear();
                                    const [dayEnd, monthEnd] = week.endDate.split('/');
                                    endDate = new Date(currentYear, parseInt(monthEnd) - 1, parseInt(dayEnd));
                                  } else {
                                    endDate = week.endDate?.toDate ? week.endDate.toDate() : new Date(week.endDate);
                                  }
                                  
                                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                                    return null;
                                  }
                                  
                                  return (
                                    <div className="text-xs font-normal text-lime-700 mt-1">
                                      {startDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {endDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                    </div>
                                  );
                                } catch (error) {
                                  return null;
                                }
                              })()}
                            </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {Object.entries(stats.weeklyBreakdown.entradas || {}).map(([subconcept, weekData]) => {
                          const parts = subconcept.split(' > ');
                          return (
                          <tr key={subconcept} className="hover:bg-muted/50">
                            <td className="px-6 py-4 text-sm text-foreground min-w-[200px] max-w-[230px]">
                              <div className="break-words">
                                {parts.length === 3 ? (
                                  <>
                                    <div className="font-bold text-foreground">{parts[2]}</div>
                                    <div className="font-normal text-xs text-muted-foreground mt-0.5">{parts[0]} / {parts[1]}</div>
                                  </>
                                ) : (
                                  <span className="font-semibold">{subconcept}</span>
                                )}
                              </div>
                            </td>
                            {stats.weeklyBreakdown.weeks.map((week, index) => (
                              <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-right text-lime-600">
                                {weekData[`week${index + 1}`] ? formatCurrency(weekData[`week${index + 1}`]) : '-'}
                              </td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-lime-800 bg-lime-100">
                              {formatCurrency(weekData.total || 0)}
                            </td>
                          </tr>
                          );
                        })}
                        <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {/* Vacío para totales */}
                          </td>
                          {stats.weeklyBreakdown.weeks.map((week, index) => {
                            const weekTotal = Object.values(stats.weeklyBreakdown.entradas || {}).reduce(
                              (sum, data) => sum + (data[`week${index + 1}`] || 0),
                              0
                            );
                            return (
                              <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-right text-lime-700">
                                {formatCurrency(weekTotal)}
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-lime-800 bg-lime-200">
                            {formatCurrency(stats.totalEntradas || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay datos de desglose semanal disponibles.</p>
                    <p className="text-sm mt-2">El backend necesita proporcionar la estructura <code>weeklyBreakdown</code> con semanas y subconceptos.</p>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Breakdown for Salidas - SEGUNDO */}
            {stats && (!getFilteredTransactionType() || getFilteredTransactionType() === 'salida') && (
              <div className="bg-background rounded-lg border border-border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-red-700">
                    Resumen Mes {currentMonthName} - Gastos
                  </h3>
                </div>

                {stats.weeklyBreakdown && stats.weeklyBreakdown.weeks ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                      <thead className="bg-red-100">
                        <tr>
                          <th rowSpan={2} className="px-6 py-3 text-center text-sm font-bold text-red-800 tracking-wider border-r-2 border-red-200">
                            Concepto
                          </th>
                          <th colSpan={stats.weeklyBreakdown.weeks.length} className="px-6 py-3 text-center text-sm font-bold text-red-800 tracking-wider border-r-2 border-red-200">
                            Semanas
                          </th>
                          <th rowSpan={2} className="px-6 py-3 text-center text-sm font-bold tracking-wider bg-red-200 text-red-800">
                            Totales
                          </th>
                        </tr>
                        <tr>
                          {stats.weeklyBreakdown.weeks.map((week, index) => {
                            return (
                            <th key={index} className="px-6 py-3 text-center text-xs font-medium text-red-800 uppercase tracking-wider bg-red-50">
                              <div>{week.weekNumber || (index + 1)}</div>
                              {(() => {
                                try {
                                  if (!week.startDate || !week.endDate) {
                                    return null;
                                  }
                                  
                                  // Parse dates - handle both Firestore Timestamp and "dd/MM" string format
                                  let startDate, endDate;
                                  
                                  if (typeof week.startDate === 'string' && week.startDate.includes('/')) {
                                    // Format "dd/MM" - need to add year
                                    const currentYear = new Date(filters.startDate || currentDate).getFullYear();
                                    const [dayStart, monthStart] = week.startDate.split('/');
                                    startDate = new Date(currentYear, parseInt(monthStart) - 1, parseInt(dayStart));
                                  } else {
                                    startDate = week.startDate?.toDate ? week.startDate.toDate() : new Date(week.startDate);
                                  }
                                  
                                  if (typeof week.endDate === 'string' && week.endDate.includes('/')) {
                                    // Format "dd/MM" - need to add year
                                    const currentYear = new Date(filters.startDate || currentDate).getFullYear();
                                    const [dayEnd, monthEnd] = week.endDate.split('/');
                                    endDate = new Date(currentYear, parseInt(monthEnd) - 1, parseInt(dayEnd));
                                  } else {
                                    endDate = week.endDate?.toDate ? week.endDate.toDate() : new Date(week.endDate);
                                  }
                                  
                                  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                                    return null;
                                  }
                                  
                                  return (
                                    <div className="text-xs font-normal text-red-700 mt-1">
                                      {startDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {endDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                    </div>
                                  );
                                } catch (error) {
                                  return null;
                                }
                              })()}
                            </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {Object.entries(stats.weeklyBreakdown.salidas || {}).map(([subconcept, weekData]) => {
                          const parts = subconcept.split(' > ');
                          return (
                          <tr key={subconcept} className="hover:bg-muted/50">
                            <td className="px-6 py-4 text-sm text-foreground min-w-[200px] max-w-[230px]">
                              <div className="break-words">
                                {parts.length === 3 ? (
                                  <>
                                    <div className="font-bold text-foreground">{parts[2]}</div>
                                    <div className="font-normal text-xs text-muted-foreground mt-0.5">{parts[0]} / {parts[1]}</div>
                                  </>
                                ) : (
                                  <span className="font-semibold">{subconcept}</span>
                                )}
                              </div>
                            </td>
                            {stats.weeklyBreakdown.weeks.map((week, index) => (
                              <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                                {weekData[`week${index + 1}`] ? formatCurrency(weekData[`week${index + 1}`]) : '-'}
                              </td>
                            ))}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-700 bg-red-100">
                              {formatCurrency(weekData.total || 0)}
                            </td>
                          </tr>
                          );
                        })}
                        <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {/* Vacío para totales */}
                          </td>
                          {stats.weeklyBreakdown.weeks.map((week, index) => {
                            const weekTotal = Object.values(stats.weeklyBreakdown.salidas || {}).reduce(
                              (sum, data) => sum + (data[`week${index + 1}`] || 0),
                              0
                            );
                            return (
                              <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                                {formatCurrency(weekTotal)}
                              </td>
                            );
                          })}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-800 bg-red-200">
                            {formatCurrency(stats.totalSalidas || 0)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay datos de desglose semanal disponibles.</p>
                    <p className="text-sm mt-2">El backend necesita proporcionar la estructura <code>weeklyBreakdown</code> con semanas y subconceptos.</p>
                  </div>
                )}
              </div>
            )}

            {/* Balance Breakdown */}
            {(stats.carryoverBalance !== 0 ||
              stats.carryoverIncome !== 0 ||
              stats.currentPeriodBalance !== 0) && (
                <div className="bg-background rounded-lg border border-border p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <ChartBarIcon className="h-5 w-5 mr-2" />
                      Desglose de Balance
                    </h3>
                    {/* Estado del arrastre automático */}
                    <div className="flex items-center space-x-2">
                      {filters.startDate && (
                        <Button
                          onClick={calculateCarryoverManually}
                          disabled={calculatingCarryover}
                          variant="outline"
                          size="sm"
                          className="inline-flex items-center border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          <ArrowPathIcon className={`h-4 w-4 mr-1 ${calculatingCarryover ? 'animate-spin' : ''}`} />
                          {calculatingCarryover ? 'Calculando...' : 'Calcular Arrastre'}
                        </Button>
                      )}
                      {carryoverStatus.calculated && (
                        <span className="text-xs text-green-600 flex items-center">
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Arrastre calculado automáticamente
                        </span>
                      )}
                      {!carryoverStatus.calculated && (
                        <span className="text-xs text-blue-600 flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          Se calculará automáticamente el 1° del mes
                        </span>
                      )}
                      <span className="text-xs text-gray-500 italic">
                        🤖 Cálculo automático cada 1° del mes a las 12:00 AM
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">


                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800">
                        Arrastre de Ingresos
                      </h4>
                      <p className="text-2xl font-bold text-green-600">
                        {(() => {
                          console.log(`🔍 Renderizando arrastre: stats.carryoverIncome=`, stats.carryoverIncome);
                          return formatCurrency(stats.carryoverIncome || 0);
                        })()}
                      </p>
                      <p className="text-sm text-green-600">
                        Del mes anterior
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800">
                        Balance del Período
                      </h4>
                      <p
                        className={`text-2xl font-bold ${stats.currentPeriodBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatCurrency(stats.currentPeriodBalance)}
                      </p>
                      <p className="text-sm text-blue-600">
                        Solo transacciones actuales
                      </p>
                    </div>


                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-800">Balance Total</h4>
                      <p
                        className={`text-2xl font-bold ${(() => {
                          // Calcular balance real sin gastos pendientes:
                          // Arrastre + Ingresos del período - Solo gastos PAGADOS del período
                          const gastosPagados = (stats.paymentStatusSalidas?.pagado?.amount || 0) + (stats.paymentStatusSalidas?.liquidado?.amount || 0);
                          const balanceSinPendientes = stats.carryoverIncome + stats.totalEntradas - gastosPagados;
                          console.log('🧮 Balance sin pendientes:', {
                            carryoverIncome: stats.carryoverIncome,
                            ingresosPeriodo: stats.totalEntradas,
                            gastosPagados,
                            balanceSinPendientes,
                            totalBalanceOriginal: stats.totalBalance
                          });
                          return balanceSinPendientes >= 0 ? "text-green-600" : "text-red-600";
                        })()}`}
                      >
                        {(() => {
                          // Calcular balance real sin gastos pendientes:
                          // Arrastre + Ingresos del período - Solo gastos PAGADOS del período
                          const gastosPagados = (stats.paymentStatusSalidas?.pagado?.amount || 0) + (stats.paymentStatusSalidas?.liquidado?.amount || 0);
                          const balanceSinPendientes = stats.carryoverIncome + stats.totalEntradas - gastosPagados;
                          return formatCurrency(balanceSinPendientes);
                        })()}
                      </p>
                      <p className="text-sm text-gray-600">Sin gastos pendientes</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Considerando pendientes: {formatCurrency(stats.totalBalance)}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-medium text-orange-800">
                        Gastos Pendientes
                      </h4>
                      <p
                        className={`text-2xl font-bold text-red-600`}
                      >
                        {(() => {
                          // Sumar gastos pendientes del período actual + meses anteriores
                          const pendientesActuales = stats.paymentStatusSalidas?.pendiente?.amount || 0;
                          const pendientesAnteriores = stats.paymentStatusSalidas?.pendienteAnterior?.carryover || 0;
                          const totalPendientes = pendientesActuales + pendientesAnteriores;
                          console.log('💰 Calculando gastos pendientes totales:', {
                            pendientesActuales,
                            pendientesAnteriores,
                            totalPendientes,
                            carryoverBalance: stats.carryoverBalance
                          });
                          return formatCurrency(-Math.abs(totalPendientes));
                        })()}
                      </p>
                      <p className="text-sm text-orange-600">
                        Todos los pendientes
                      </p>
                    </div>
                  </div>


                </div>
              )}
          </div>
        )}

        {/* Payment Status (for salidas) */}
        {stats && getFilteredTransactionType() === 'salida' && stats.salidasCount > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              Estado de Gastos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-green-800">Pagados totalmente</h4>
                </div>
                <p className="text-2xl font-bold text-green-600 mb-2">
                  {stats.paymentStatusSalidas.pagado.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusSalidas.pagado.count > 0 
                    ? `${stats.paymentStatusSalidas.pagado.count} transacciones cubiertas`
                    : 'Sin transacciones pagadas'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-700">Monto pagado:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(stats.paymentStatusSalidas.pagado.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-yellow-800">Parcialmente pagados</h4>
                </div>
                <p className="text-2xl font-bold text-yellow-600 mb-2">
                  {stats.paymentStatusSalidas.parcial.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusSalidas.parcial.count > 0 
                    ? `${stats.paymentStatusSalidas.parcial.count} transacciones parciales`
                    : 'Sin pagos parciales'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-yellow-700">Monto pagado:</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(stats.paymentStatusSalidas.parcial.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-yellow-700">Saldo por cubrir:</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(stats.paymentStatusSalidas.parcial.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-red-800">Pendientes por pagar</h4>
                </div>
                <p className="text-2xl font-bold text-red-600 mb-2">
                  {stats.paymentStatusSalidas.pendiente.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusSalidas.pendiente.count > 0 
                    ? `${stats.paymentStatusSalidas.pendiente.count} transacciones sin cubrir`
                    : 'Sin pendientes'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-700">Saldo por cubrir:</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(stats.paymentStatusSalidas.pendiente.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-purple-800">Pendientes anteriores</h4>
                </div>
                <p className="text-2xl font-bold text-purple-600 mb-2">
                  {stats.paymentStatusSalidas.pendienteAnterior.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusSalidas.pendienteAnterior.count > 0 
                    ? `${stats.paymentStatusSalidas.pendienteAnterior.count} transacciones no cubiertas`
                    : 'Sin pendientes'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-purple-700">Por pagar:</span>
                    <span className="font-semibold text-purple-600">
                      {formatCurrency(stats.paymentStatusSalidas.pendienteAnterior.carryover)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Status (for entradas) */}
        {stats && getFilteredTransactionType() === 'entrada' && stats.entradasCount > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              Estado de Ingresos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-green-800">Cubiertos totalmente</h4>
                </div>
                <p className="text-2xl font-bold text-green-600 mb-2">
                  {stats.paymentStatusEntradas.pagado.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusEntradas.pagado.count > 0 
                    ? `${stats.paymentStatusEntradas.pagado.count} transacciones cubiertas`
                    : 'Sin transacciones recibidas'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-700">Monto recibido:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(stats.paymentStatusEntradas.pagado.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-yellow-800">Parcialmente cubiertos</h4>
                </div>
                <p className="text-2xl font-bold text-yellow-600 mb-2">
                  {stats.paymentStatusEntradas.parcial.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusEntradas.parcial.count > 0 
                    ? `${stats.paymentStatusEntradas.parcial.count} transacciones parciales`
                    : 'Sin cobros parciales'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-yellow-700">Monto recibido:</span>
                    <span className="font-semibold text-blue-600">
                      {formatCurrency(stats.paymentStatusEntradas.parcial.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-yellow-700">Saldo por recibir:</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(stats.paymentStatusEntradas.parcial.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-red-800">Pendientes por cubrir</h4>
                </div>
                <p className="text-2xl font-bold text-red-600 mb-2">
                  {stats.paymentStatusEntradas.pendiente.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusEntradas.pendiente.count > 0 
                    ? `${stats.paymentStatusEntradas.pendiente.count} transacciones sin cubrir`
                    : 'Sin pendientes'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-red-700">Saldo por recibir:</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(stats.paymentStatusEntradas.pendiente.balance || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-purple-800">Pendientes anteriores</h4>
                </div>
                <p className="text-2xl font-bold text-purple-600 mb-2">
                  {stats.paymentStatusEntradas.pendienteAnterior.count}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {stats.paymentStatusEntradas.pendienteAnterior.count > 0 
                    ? `${stats.paymentStatusEntradas.pendienteAnterior.count} transacciones no cubiertas`
                    : 'Sin pendientes'}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-purple-700">Por cobrar:</span>
                    <span className="font-semibold text-purple-600">
                      {formatCurrency(stats.paymentStatusEntradas.pendienteAnterior.carryover)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leyenda para porcentajes cuando se incluyen ingresos */}
        {showIncomeInBreakdown && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800">
                  Interpretación de porcentajes
                </h4>
                <div className="mt-2 text-sm text-blue-700">
                  <p className="flex items-center">
                    • Los porcentajes en <span className="text-red-600 font-semibold mx-1">rojo</span>
                    con <ArrowDownIcon className="h-4 w-4 mx-1 text-red-600" /> representan el % del total de gastos
                  </p>
                  <p className="flex items-center mt-1">
                    • Los porcentajes en <span className="text-green-600 font-semibold mx-1">verde</span>
                    con <ArrowUpIcon className="h-4 w-4 mx-1 text-green-600" /> representan el % del total de ingresos
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Breakdown */}
        {stats && getFilteredTransactionType() && Object.keys(stats.generalBreakdown).length > 0 &&
          Object.entries(stats.generalBreakdown).some(([general, data]) => 
            getFilteredTransactionType() === 'entrada' ? data.entradas > 0 : data.salidas > 0
          ) && (
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Desglose por Categoría General
                </h3>
                <p className="text-sm text-muted-foreground italic">
                  Solo período: {currentMonthName}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{width: '200px', minWidth: '200px'}}>
                        Categoría General
                      </th>
                      {showIncomeInBreakdown && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Ingreso
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pagado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Por Pagar
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {getFilteredTransactionType() === 'entrada' ? "% de Ingresos" : "% de Gastos"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {Object.entries(stats.generalBreakdown)
                      .filter(([general, data]) => 
                        getFilteredTransactionType() === 'entrada' ? data.entradas > 0 : data.salidas > 0
                      )
                      .map(([general, data]) => (
                        <tr key={general}>
                          <td className="px-6 py-4 text-sm font-medium text-foreground" style={{width: '200px', minWidth: '200px'}}>
                            <div className="truncate">{general}</div>
                          </td>
                          {showIncomeInBreakdown && (
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${data.entradas === 0 ? 'text-foreground' : 'text-green-600'
                              }`}>
                              {formatCurrency(data.entradas)}
                            </td>
                          )}
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            getFilteredTransactionType() === 'entrada' 
                              ? (data.entradas === 0 ? 'text-foreground' : 'text-green-600')
                              : (data.salidas === 0 ? 'text-foreground' : 'text-red-600')
                            }`}>
                            {getFilteredTransactionType() === 'entrada' 
                              ? formatCurrency(data.entradas) 
                              : formatCurrency(data.salidas)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {formatCurrency(data.paid || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {formatCurrency(data.pending || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {data.count}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            getFilteredTransactionType() === 'entrada' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {getFilteredTransactionType() === 'entrada'
                              ? formatPercentage(data.entradas, stats.totalEntradas)
                              : formatPercentage(data.salidas, stats.totalSalidas)
                            }
                          </td>
                        </tr>
                      )
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        {/* Concept Breakdown */}
        {stats && getFilteredTransactionType() && Object.keys(stats.conceptBreakdown).length > 0 &&
          Object.entries(stats.conceptBreakdown).some(([concept, data]) => 
            getFilteredTransactionType() === 'entrada' ? data.entradas > 0 : data.salidas > 0
          ) && (
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Desglose por Concepto
                </h3>
                <p className="text-sm text-muted-foreground italic">
                  Solo período: {currentMonthName}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{width: '200px', minWidth: '200px'}}>
                        Concepto
                      </th>
                      {showIncomeInBreakdown && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Ingreso
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pagado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Por Pagar
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {getFilteredTransactionType() === 'entrada' ? "% de Ingresos" : "% de Gastos"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {Object.entries(stats.conceptBreakdown)
                      .filter(([concept, data]) => 
                        getFilteredTransactionType() === 'entrada' ? data.entradas > 0 : data.salidas > 0
                      )
                      .map(([concept, data]) => (
                        <tr key={concept}>
                          <td className="px-6 py-4 text-sm font-medium text-foreground" style={{width: '200px', minWidth: '200px'}}>
                            <div className="truncate">{concept}</div>
                          </td>
                          {showIncomeInBreakdown && (
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${data.entradas === 0 ? 'text-foreground' : 'text-green-600'
                              }`}>
                              {formatCurrency(data.entradas)}
                            </td>
                          )}
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            getFilteredTransactionType() === 'entrada' 
                              ? (data.entradas === 0 ? 'text-foreground' : 'text-green-600')
                              : (data.salidas === 0 ? 'text-foreground' : 'text-red-600')
                            }`}>
                            {getFilteredTransactionType() === 'entrada' 
                              ? formatCurrency(data.entradas) 
                              : formatCurrency(data.salidas)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {formatCurrency(data.paid || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {formatCurrency(data.pending || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {data.count}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            getFilteredTransactionType() === 'entrada' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {getFilteredTransactionType() === 'entrada'
                              ? formatPercentage(data.entradas, stats.totalEntradas)
                              : formatPercentage(data.salidas, stats.totalSalidas)
                            }
                          </td>
                        </tr>
                      )
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* Subconcept Breakdown */}
        {stats && getFilteredTransactionType() && Object.keys(stats.subconceptBreakdown).length > 0 &&
          Object.entries(stats.subconceptBreakdown).some(([subconcept, data]) => 
            getFilteredTransactionType() === 'entrada' ? data.entradas > 0 : data.salidas > 0
          ) && (
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Desglose por Subconcepto
                </h3>
                <p className="text-sm text-muted-foreground italic">
                  Solo período: {currentMonthName}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{width: '200px', minWidth: '200px'}}>
                        Subconcepto
                      </th>
                      {showIncomeInBreakdown && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Ingreso
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Monto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pagado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Por Pagar
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Cantidad
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {getFilteredTransactionType() === 'entrada' ? "% de Ingresos" : "% de Gastos"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-background divide-y divide-border">
                    {Object.entries(stats.subconceptBreakdown)
                      .filter(([subconcept, data]) => 
                        getFilteredTransactionType() === 'entrada' ? data.entradas > 0 : data.salidas > 0
                      )
                      .map(([subconcept, data]) => (
                        <tr key={subconcept}>
                          <td className="px-6 py-4 text-sm font-medium text-foreground" style={{width: '200px', minWidth: '200px'}}>
                            <div className="truncate">{subconcept}</div>
                          </td>
                          {showIncomeInBreakdown && (
                            <td className={`px-6 py-4 whitespace-nowrap text-sm ${data.entradas === 0 ? 'text-foreground' : 'text-green-600'
                              }`}>
                              {formatCurrency(data.entradas)}
                            </td>
                          )}
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            getFilteredTransactionType() === 'entrada' 
                              ? (data.entradas === 0 ? 'text-foreground' : 'text-green-600')
                              : (data.salidas === 0 ? 'text-foreground' : 'text-red-600')
                            }`}>
                            {getFilteredTransactionType() === 'entrada' 
                              ? formatCurrency(data.entradas) 
                              : formatCurrency(data.salidas)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                            {formatCurrency(data.paid || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {formatCurrency(data.pending || 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {data.count}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            getFilteredTransactionType() === 'entrada' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {getFilteredTransactionType() === 'entrada'
                              ? formatPercentage(data.entradas, stats.totalEntradas)
                              : formatPercentage(data.salidas, stats.totalSalidas)
                            }
                          </td>
                        </tr>
                      )
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* Provider Breakdown (for salidas) */}
        {stats && getFilteredTransactionType() === 'salida' && Object.keys(stats.providerBreakdown).length > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Desglose por Proveedor
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Solo período: {currentMonthName}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{width: '200px', minWidth: '200px'}}>
                      Proveedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pagado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Por Pagar
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Transacciones
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      % de Gastos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {Object.entries(stats.providerBreakdown).map(
                    ([provider, data]) => (
                      <tr key={provider}>
                        <td className="px-6 py-4 text-sm font-medium text-foreground" style={{width: '200px', minWidth: '200px'}}>
                          <div className="truncate">{provider}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {formatCurrency(data.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                          {formatCurrency(data.amount - (data.pendingAmount || 0))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                          {formatCurrency(data.pendingAmount || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {data.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          {formatPercentage(data.amount, stats.totalSalidas)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Division Breakdown (for salidas) - OCULTO POR AHORA */}
        {/* {stats && stats.divisionBreakdown && Object.keys(stats.divisionBreakdown).length > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Desglose por División (Gastos)
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Solo período: {currentMonthName}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      División
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Monto Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Saldo Pendiente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Transacciones
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      % de Gastos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {Object.entries(stats.divisionBreakdown).map(
                    ([division, data]) => (
                      <tr key={division}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          {division}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {formatCurrency(data.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {formatCurrency(data.pendingAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {data.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          {formatPercentage(data.amount, stats.totalSalidas)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )} */}

        {/* Loading State */}
        {loading && (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">
                Generando reporte...
              </span>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!loading && stats && (stats.entradasCount + stats.salidasCount) === 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="border-2 border-dashed border-border rounded-lg h-32 flex items-center justify-center">
              <div className="text-center">
                <DocumentTextIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  No se encontraron transacciones con los filtros seleccionados
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Carryover Transactions Side Panel */}
      {showCarryoverPanel && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowCarryoverPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-96 max-w-full bg-background shadow-xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    Gastos Pendientes
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCarryoverPanel(false)}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Todos los gastos con estado pendiente
                </p>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {carryoverTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay gastos pendientes en el sistema
                  </p>
                ) : (
                  <div className="space-y-4">
                    {carryoverTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="border border-border rounded-lg p-4 bg-red-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-foreground">
                            {transaction.conceptName}
                          </h4>
                          <span className="text-lg font-bold text-red-600">
                            {formatCurrency(transaction.amount)}
                          </span>
                        </div>

                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p><strong>Proveedor:</strong> {transaction.providerName}</p>
                          <p><strong>Categoría:</strong> {transaction.generalName}</p>
                          <p><strong>Fecha:</strong> {
                            transaction.date?.toDate ?
                              transaction.date.toDate().toLocaleDateString('es-ES') :
                              new Date(transaction.date).toLocaleDateString('es-ES')
                          }</p>
                          {transaction.description && (
                            <p><strong>Descripción:</strong> {transaction.description}</p>
                          )}
                          <p><strong>Saldo pendiente:</strong> {formatCurrency(transaction.balance || transaction.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {carryoverTransactions.length > 0 && (
                <div className="px-6 py-4 border-t border-border bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total de {carryoverTransactions.length} transacciones
                    </span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(
                        carryoverTransactions.reduce((sum, t) => sum + (t.balance || t.amount), 0)
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Reportes;
