import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import AdvancedDateSelector from "../../components/dashboard/AdvancedDateSelector";
import SummaryCards from "../../components/dashboard/SummaryCards";
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
import TreeComparisonSection from "../../components/reports/TreeComparisonSection";
import WeeklyBreakdownEntradas from "../../components/reports/WeeklyBreakdownEntradas";
import WeeklyBreakdownSalidas from "../../components/reports/WeeklyBreakdownSalidas";
import { 
  formatCurrency as formatCurrencyUtil, 
  formatCurrencyWithBadge as formatCurrencyWithBadgeUtil, 
  calculateTreeComparison as calculateTreeComparisonUtil, 
  getTreeBalanceByName as getTreeBalanceByNameUtil, 
  isAmboTree as isAmboTreeUtil 
} from "../../lib/utils/reportUtils";
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ClockIcon,
  XMarkIcon,
  EyeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";

const Reportes = () => {
  const { success, error } = useToast();
  const { user } = useAuth();
  const { showIncomeInBreakdown, toggleShowIncomeInBreakdown } = useReportStore();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [calculatingCarryover, setCalculatingCarryover] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]); // Todas las transacciones sin filtro de fecha
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
  const [showPaymentStatusInfo, setShowPaymentStatusInfo] = useState(false);
  const [selectedTreeBalance, setSelectedTreeBalance] = useState(null);
  const [selectedTreeTransactions, setSelectedTreeTransactions] = useState(null);
  const [selectedWeekDetail, setSelectedWeekDetail] = useState(null);
  const [showPendingSalidasModal, setShowPendingSalidasModal] = useState(false);
  const [pendingSalidasTransactions, setPendingSalidasTransactions] = useState([]);

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
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    const initializePage = async () => {
      await loadReferenceData();
      // Set initial date range (report will generate only when user selects a type)
      handleDateChange(currentDate);
    };
    initializePage();
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

    // Format dates to YYYY-MM-DD without timezone conversion
    const formatDateLocal = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Update filters with proper time handling
    setFilters((prev) => ({
      ...prev,
      startDate: formatDateLocal(startOfMonth),
      endDate: formatDateLocal(endOfMonth),
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
    updateMonthName(currentDate);
  }, [currentDate]);

  const loadReferenceData = async () => {
    try {
      const [generalsData, conceptsData, subconceptsData, providersData] = await Promise.all([
        generalService.getAll(),
        conceptService.getAll(),
        subconceptService.getAll(),
        providerService.getAll(),
      ]);
      setGenerals(generalsData);
      setConcepts(conceptsData);
      setSubconcepts(subconceptsData);
      setProviders(providersData);
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

      // console.log(`Calculando arrastre manualmente para ${month}/${year}`);
      
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

  const generateReport = useCallback(async () => {
    try {
      setLoading(true);

      // Construir fechas correctamente para evitar problemas de zona horaria
      let startDate = null;
      let endDate = null;

      if (filters.startDate) {
        const startParts = filters.startDate.split('-');
        startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]), 0, 0, 0, 0);
      }

      if (filters.endDate) {
        const endParts = filters.endDate.split('-');
        // Set endDate to end of day (23:59:59.999) to include all transactions of that day
        endDate = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]), 23, 59, 59, 999);
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
          // console.log('Verificando cálculo de arrastre automático para el mes actual...');
          try {
            const carryoverResult = await reportService.checkAndCalculateCarryoverIfNeeded();
            if (carryoverResult.calculated) {
              // console.log('✅ Arrastre calculado automáticamente:', carryoverResult.message);
            } else if (carryoverResult.error) {
              console.warn('Error en verificación de arrastre:', carryoverResult.message);
            }
          } catch (error) {
            console.warn('Error verificando arrastre automático:', error.message);
          }
        }
      }

      // Cargar transacciones filtradas por período
      const transactionsData =
        await reportService.getFilteredTransactions(filterData);
      const statsData = await reportService.generateReportStats(
        transactionsData,
        filterData
      );

      // Cargar TODAS las transacciones (sin filtro de fecha) para calcular arrastre
      const allTransactionsData = await reportService.getFilteredTransactions({
        ...filterData,
        startDate: null,
        endDate: null
      });

      // Enriquecer allTransactions con nombre de proveedor
      const enrichedAllTransactions = allTransactionsData.map(transaction => {
        const provider = providers.find(p => p.id === transaction.providerId);
        return {
          ...transaction,
          providerName: provider?.name || null
        };
      });

      setTransactions(transactionsData);
      setAllTransactions(enrichedAllTransactions);
      setStats(statsData);

      success("Reporte generado exitosamente");
    } catch (err) {
      console.error("Error generating report:", err);
      error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.type, filters.generalId, filters.conceptId, filters.subconceptId, filters.division, providers]);

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

      // console.log('Frontend - Filtrado de gastos pendientes:', {
      //   reportMonth: `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`,
      //   totalPendingInSystem: allTransactions.length,
      //   pendingUntilReportMonth: pendingFromPrevious.length,
      //   filteredOut: allTransactions.length - pendingFromPrevious.length
      // });

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

  const loadPendingSalidasTransactions = async () => {
    try {
      // Get all transactions from the current period
      const allTransactions = await transactionService.getAll({
        type: 'salida'
      });

      // Filter by date range and status (pendiente or parcial)
      const startDate = new Date(filters.startDate);
      const endDate = new Date(filters.endDate);

      const pendingTransactions = allTransactions.filter(transaction => {
        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        const isInRange = transactionDate >= startDate && transactionDate <= endDate;
        const isPendingOrPartial = transaction.status === 'pendiente' || transaction.status === 'parcial';
        return isInRange && isPendingOrPartial;
      });

      // Get reference data for display
      const [conceptsData, subconceptsData, providersData, generalsData] = await Promise.all([
        conceptService.getAll(),
        subconceptService.getAll(),
        providerService.getAll(),
        generalService.getAll()
      ]);

      // Enrich transactions with reference data
      const enrichedTransactions = pendingTransactions.map(transaction => ({
        ...transaction,
        conceptName: conceptsData.find(c => c.id === transaction.conceptId)?.name || 'Sin concepto',
        subconceptName: subconceptsData.find(s => s.id === transaction.subconceptId)?.name || 'Sin subconcepto',
        providerName: providersData.find(p => p.id === transaction.providerId)?.name || 'Sin proveedor',
        generalName: generalsData.find(g => g.id === transaction.generalId)?.name || 'Sin categoría'
      }));

      setPendingSalidasTransactions(enrichedTransactions);
      setShowPendingSalidasModal(true);
    } catch (err) {
      console.error("Error loading pending salidas:", err);
      error("Error al cargar salidas pendientes");
    }
  };

  const loadCarryoverInfo = useCallback(async () => {
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

        // console.log(`checkCarryoverStatus: startDate=${startDateStr}, year=${year}, month=${month}`);

        const status = await reportService.getCarryoverStatus(year, month);
        // console.log(`checkCarryoverStatus: status recibido:`, status);

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
  }, [filters.startDate]);

  // useEffect para generar reporte cuando cambian los filtros
  // Debe estar después de las definiciones de generateReport y loadCarryoverInfo
  // Genera el reporte siempre que haya fechas (para mostrar estadísticas generales)
  // Las secciones de desglose solo se mostrarán si hay tipo seleccionado (validación en el render)
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      generateReport();
      loadCarryoverInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.startDate, filters.endDate, filters.type, filters.generalId, filters.conceptId, filters.subconceptId, filters.division]);

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

  // Filtrar generals por tipo seleccionado (incluir tipo 'ambos')
  const getFilteredGenerals = () => {
    if (!filters.type) {
      return [];
    }
    return generals.filter((general) => general.type === filters.type || general.type === 'ambos');
  };

  // Filtrar concepts por general seleccionado (incluir tipo 'ambos')
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
    return formatCurrencyUtil(amount);
  };

  // Formatea moneda con badge amarillo para números negativos (práctica contable)
  const formatCurrencyWithBadge = (amount) => {
    return formatCurrencyWithBadgeUtil(amount);
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

  // Función para calcular comparativos por árbol (General → Concepto → Subconcepto)
  // Solo para árboles de tipo 'ambos' que tienen transacciones de entrada y salida
  const calculateTreeComparison = () => {
    return calculateTreeComparisonUtil(allTransactions, stats, filters, generals, concepts);
  };

  // Función para obtener el balance de un árbol específico por su nombre completo
  const getTreeBalanceByName = (treeString) => {
    return getTreeBalanceByNameUtil(treeString, calculateTreeComparison);
  };

  // Función para verificar si un árbol es de tipo "ambos"
  const isAmboTree = (treeString) => {
    return isAmboTreeUtil(treeString, generals);
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
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
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
        {stats && (() => {
          // Preparar los datos para SummaryCards
          const filteredType = getFilteredTransactionType();
          const summary = {
            entradas: filteredType === 'salida' ? 0 : stats.totalEntradas,
            salidas: filteredType === 'entrada' ? 0 : stats.totalSalidas,
            balance: (filteredType === 'salida' ? 0 : stats.totalEntradas) - (filteredType === 'entrada' ? 0 : stats.totalSalidas),
            totalTransactions: filteredType === 'entrada' 
              ? stats.entradasCount 
              : filteredType === 'salida' 
                ? stats.salidasCount 
                : stats.entradasCount + stats.salidasCount,
            entradasCount: filteredType === 'salida' ? 0 : stats.entradasCount,
            salidasCount: filteredType === 'entrada' ? 0 : stats.salidasCount
          };
          
          return <SummaryCards summary={summary} currentMonthName={currentMonthName} />;
        })()}

        {stats && (
          <div className="space-y-6">

            {/* Tree Comparison Section - Comparativo por Árbol (Entrada vs Salida) */}
            <TreeComparisonSection
              stats={stats}
              currentMonthName={currentMonthName}
              calculateTreeComparison={calculateTreeComparison}
              formatCurrency={formatCurrency}
              formatCurrencyWithBadge={formatCurrencyWithBadge}
              subconcepts={subconcepts}
            />

            {/* Weekly Breakdown for Entradas - PRIMERO */}
            {(!getFilteredTransactionType() || getFilteredTransactionType() === 'entrada') && (
              <WeeklyBreakdownEntradas
                stats={stats}
                currentMonthName={currentMonthName}
                transactions={transactions}
                generals={generals}
                concepts={concepts}
                subconcepts={subconcepts}
                filters={filters}
                currentDate={currentDate}
                formatCurrency={formatCurrency}
                getTreeBalanceByName={getTreeBalanceByName}
                isAmboTree={isAmboTree}
              />
            )}

            {/* Weekly Breakdown for Salidas - SEGUNDO */}
            {(!getFilteredTransactionType() || getFilteredTransactionType() === 'salida') && (
              <WeeklyBreakdownSalidas
                stats={stats}
                currentMonthName={currentMonthName}
                transactions={transactions}
                generals={generals}
                concepts={concepts}
                subconcepts={subconcepts}
                filters={filters}
                currentDate={currentDate}
                formatCurrency={formatCurrency}
                getTreeBalanceByName={getTreeBalanceByName}
                isAmboTree={isAmboTree}
              />
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
                          Arrastre calculado automáticamente<br/>(cada 1° del mes a las 12:00 AM)
                        </span>
                      )}
                      {!carryoverStatus.calculated && (
                        <span className="text-xs text-blue-600 flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          Se calculará automáticamente el 1° del mes
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">


                    <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
                      <h4 className="font-medium text-lime-900">
                        Arrastre de Entradas
                      </h4>
                      <p className="text-2xl font-bold text-lime-600">
                        {(() => {
                          console.log(`🔍 Renderizando arrastre: stats.carryoverIncome=`, stats.carryoverIncome);
                          return formatCurrencyWithBadge(stats.carryoverIncome || 0);
                        })()}
                      </p>
                      <p className="text-sm text-lime-600">
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
                        {formatCurrencyWithBadge(stats.currentPeriodBalance)}
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
                          return formatCurrencyWithBadge(balanceSinPendientes);
                        })()}
                      </p>
                      <p className="text-sm text-gray-600">Sin salidas pendientes</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Considerando pendientes: {formatCurrencyWithBadge(stats.totalBalance)}
                      </p>
                    </div>
                    <button 
                      onClick={loadPendingSalidasTransactions}
                      className="bg-orange-50 border border-orange-200 rounded-lg p-4 hover:bg-orange-100 transition-colors cursor-pointer text-left w-full"
                    >
                      <h4 className="font-medium text-orange-800 flex items-center gap-2">
                        Salidas pendientes por cubrirse
                        <EyeIcon className="h-4 w-4" />
                      </h4>
                      <p
                        className={`text-2xl font-bold text-red-600`}
                      >
                        {(() => {
                          // Sumar gastos pendientes del período actual + meses anteriores
                          const pendientesActuales = stats.paymentStatusSalidas?.pendiente?.amount || 0;
                          const pendientesAnteriores = stats.paymentStatusSalidas?.pendienteAnterior?.carryover || 0;
                          const totalPendientes = pendientesActuales + pendientesAnteriores;
                          console.log('💰 Calculando salidas pendientes totales:', {
                            pendientesActuales,
                            pendientesAnteriores,
                            totalPendientes,
                            carryoverBalance: stats.carryoverBalance
                          });
                          return formatCurrencyWithBadge(-Math.abs(totalPendientes));
                        })()}
                      </p>
                      <p className="text-sm text-orange-600">
                        Todos los pendientes
                      </p>
                    </button>
                  </div>


                </div>
              )}
          </div>
        )}

        {/* Payment Status (for salidas) */}
        {stats && getFilteredTransactionType() === 'salida' && stats.salidasCount > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground flex items-center mb-4">
              <ClockIcon className="h-5 w-5 mr-2" />
              Estado de Salidas
              <button
                onClick={() => setShowPaymentStatusInfo(true)}
                className="ml-2 p-1 rounded-full hover:bg-blue-50 transition-colors"
                title="Información sobre el estado de pagos"
              >
                <QuestionMarkCircleIcon className="h-6 w-6 text-blue-500 hover:text-blue-600" />
              </button>
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
            <h3 className="text-lg font-semibold text-foreground flex items-center mb-4">
              <ClockIcon className="h-5 w-5 mr-2" />
              Estado de Entradas
              <button
                onClick={() => setShowPaymentStatusInfo(true)}
                className="ml-2 p-1 rounded-full hover:bg-blue-50 transition-colors"
                title="Información sobre el estado de pagos"
              >
                <QuestionMarkCircleIcon className="h-6 w-6 text-blue-500 hover:text-blue-600" />
              </button>
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
                    con <ArrowDownIcon className="h-4 w-4 mx-1 text-red-600" /> representan el % del total de salidas
                  </p>
                  <p className="flex items-center mt-1">
                    • Los porcentajes en <span className="text-green-600 font-semibold mx-1">verde</span>
                    con <ArrowUpIcon className="h-4 w-4 mx-1 text-green-600" /> representan el % del total de entradas
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
                        {getFilteredTransactionType() === 'entrada' ? "% de Entradas" : "% de Salidas"}
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
                            {getFilteredTransactionType() === 'entrada'
                              ? formatCurrency(data.paidEntradas || 0)
                              : formatCurrency(data.paidSalidas || 0)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {getFilteredTransactionType() === 'entrada'
                              ? formatCurrency(data.pendingEntradas || 0)
                              : formatCurrency(data.pendingSalidas || 0)
                            }
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
                        {getFilteredTransactionType() === 'entrada' ? "% de Entradas" : "% de Salidas"}
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
                            {getFilteredTransactionType() === 'entrada'
                              ? formatCurrency(data.paidEntradas || 0)
                              : formatCurrency(data.paidSalidas || 0)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {getFilteredTransactionType() === 'entrada'
                              ? formatCurrency(data.pendingEntradas || 0)
                              : formatCurrency(data.pendingSalidas || 0)
                            }
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
                        {getFilteredTransactionType() === 'entrada' ? "% de Entradas" : "% de Salidas"}
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
                            {getFilteredTransactionType() === 'entrada'
                              ? formatCurrency(data.paidEntradas || 0)
                              : formatCurrency(data.paidSalidas || 0)
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                            {getFilteredTransactionType() === 'entrada'
                              ? formatCurrency(data.pendingEntradas || 0)
                              : formatCurrency(data.pendingSalidas || 0)
                            }
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
                      % de Salidas
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
                Desglose por División (Salidas)
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
                      % de Salidas
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
      {/* Payment Status Info Modal */}
      {showPaymentStatusInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPaymentStatusInfo(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <QuestionMarkCircleIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      ¿Cómo interpretar el Estado de {getFilteredTransactionType() === 'entrada' ? 'Entradas' : 'Salidas'}?
                    </h3>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {currentMonthName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentStatusInfo(false)}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              <p className="text-gray-700 mb-6 leading-relaxed">
                A continuación se muestra el detalle de los movimientos del mes de <span className="font-semibold">{currentMonthName}</span>, donde podrás visualizar el estado de las transacciones según su nivel de cobertura:
              </p>

              <div className="space-y-4">
                {/* Tarjeta Verde */}
                <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircleIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-green-900 font-semibold text-lg mb-1">
                        Cubiertos totalmente
                      </h4>
                      <p className="text-green-800 text-sm leading-relaxed">
                        Transacciones que se han cubierto en su totalidad. Estos movimientos están completamente pagados y no requieren seguimiento adicional.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta Amarilla */}
                <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                        <ClockIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-yellow-900 font-semibold text-lg mb-1">
                        Parcialmente cubiertos
                      </h4>
                      <p className="text-yellow-800 text-sm leading-relaxed">
                        Transacciones que han recibido pagos parciales. Aún existe un saldo pendiente por cubrir. Es importante dar seguimiento a estos movimientos.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta Roja */}
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                        <XMarkIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-red-900 font-semibold text-lg mb-1">
                        Pendientes por cubrir
                      </h4>
                      <p className="text-red-800 text-sm leading-relaxed">
                        Transacciones del mes actual a las cuales no se ha realizado ningún pago. Requieren atención inmediata para su cobertura.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tarjeta Morada */}
                <div className="bg-purple-50 border-l-4 border-purple-500 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                        <ArrowPathIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-purple-900 font-semibold text-lg mb-1">
                        Pendientes anteriores
                      </h4>
                      <p className="text-purple-800 text-sm leading-relaxed">
                        Transacciones de meses anteriores que no se han cubierto en su totalidad. Esto incluye tanto pagos parciales como movimientos sin ningún pago. Estas deudas se arrastran al mes actual.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nota adicional */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <svg className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-blue-900 font-medium text-sm mb-1">Nota importante</h4>
                    <p className="text-blue-800 text-sm leading-relaxed">
                      Los montos mostrados reflejan el estado actual de las transacciones. Los saldos pendientes se actualizan automáticamente conforme se registran los pagos en el sistema.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transacciones de Árbol Mixto */}
      {selectedTreeTransactions && (() => {
        // Ordenar todas las transacciones cronológicamente usando createdAt (timestamp completo)
        const sortedTransactions = [...selectedTreeTransactions.transactions].sort((a, b) => {
          // Prioridad 1: Usar createdAt si está disponible (tiene timestamp completo)
          if (a.createdAt && b.createdAt) {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return timeA - timeB;
          }
          // Prioridad 2: Usar date si createdAt no está disponible
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          const dateDiff = dateA - dateB;
          
          // Si las fechas son iguales, ordenar por ID (orden de creación)
          if (dateDiff === 0) {
            return (a.id || '').localeCompare(b.id || '');
          }
          return dateDiff;
        });
        
        // Calcular saldo acumulado para cada transacción
        let runningBalance = 0;
        const transactionsWithBalance = sortedTransactions.map(transaction => {
          const amount = transaction.amount || 0;
          if (transaction.type === 'entrada') {
            runningBalance += amount;
          } else if (transaction.type === 'salida') {
            runningBalance -= amount;
          }
          return {
            ...transaction,
            runningBalance: runningBalance
          };
        });
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTreeTransactions(null)} />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Detalle de Movimientos - Semana {selectedTreeTransactions.weekNumber}
                    </h3>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {selectedTreeTransactions.weekInfo && (
                        <span className="mr-3">
                          📅 {selectedTreeTransactions.weekInfo.startDate} - {selectedTreeTransactions.weekInfo.endDate}
                        </span>
                      )}
                      {selectedTreeTransactions.generalName} / <strong>{selectedTreeTransactions.conceptName}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTreeTransactions(null)}
                    className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6 text-white" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700 font-medium mb-1">Total Entradas</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedTreeTransactions.entradas)}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-700 font-medium mb-1">Total Salidas</div>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(selectedTreeTransactions.salidas)}
                    </div>
                  </div>
                  <div className={`border-2 rounded-lg p-3 ${
                    selectedTreeTransactions.balance >= 0 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-orange-50 border-orange-300'
                  }`}>
                    <div className={`text-xs font-medium mb-1 ${
                      selectedTreeTransactions.balance >= 0 ? 'text-blue-700' : 'text-orange-700'
                    }`}>Saldo Final</div>
                    <div className={`text-lg font-bold ${
                      selectedTreeTransactions.balance >= 0 ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {formatCurrency(Math.abs(selectedTreeTransactions.balance))}
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-xs text-purple-700 font-medium mb-1">Movimientos</div>
                    <div className="text-lg font-bold text-purple-600">
                      {selectedTreeTransactions.transactions.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Fecha Transacción
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Subconcepto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Monto
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                            Saldo Acumulado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Descripción
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Proveedor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactionsWithBalance.map((transaction, index) => {
                          // Mostrar la fecha real de la transacción (date)
                          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                          // Obtener el timestamp de registro (createdAt) si está disponible
                          const createdDate = transaction.createdAt?.toDate 
                            ? transaction.createdAt.toDate() 
                            : null;
                          const subconcept = subconcepts.find(s => s.id === transaction.subconceptId);
                          
                          return (
                            <tr key={transaction.id || index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                <div className="font-medium">
                                  {transactionDate.toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </div>
                                {createdDate && (
                                  <div className="text-xs text-gray-500" title="Hora de registro en sistema">
                                    {createdDate.toLocaleTimeString('es-MX', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <span className="font-medium">{subconcept?.name || 'Sin subconcepto'}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.type === 'entrada'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.type === 'entrada' ? (
                                    <ArrowUpIcon className="h-3 w-3 mr-1" />
                                  ) : (
                                    <ArrowDownIcon className="h-3 w-3 mr-1" />
                                  )}
                                  {transaction.type === 'entrada' ? 'Entrada' : 'Salida'}
                                </span>
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                transaction.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'entrada' ? '+' : '-'}{formatCurrency(transaction.amount || 0)}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${
                                transaction.runningBalance >= 0 ? 'text-blue-600' : 'text-orange-600'
                              }`}>
                                <div className="flex items-center justify-end">
                                  {transaction.runningBalance >= 0 ? (
                                    <ArrowUpIcon className="h-4 w-4 mr-1" />
                                  ) : (
                                    <ArrowDownIcon className="h-4 w-4 mr-1" />
                                  )}
                                  {formatCurrency(Math.abs(transaction.runningBalance))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={transaction.description || 'Sin descripción'}>
                                {transaction.description || 'Sin descripción'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {transaction.providerName || 'Sin proveedor'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {transactionsWithBalance.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No hay transacciones en este concepto</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
                <div className="text-xs text-gray-600 text-center">
                  Mostrando <strong>{transactionsWithBalance.length}</strong> transacciones de la Semana {selectedTreeTransactions.weekNumber} • Ordenadas por fecha/hora de registro
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal de Balance de Árbol Mixto */}
      {selectedTreeBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTreeBalance(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Balance de Árbol Mixto
                  </h3>
                  <p className="text-purple-100 text-sm mt-0.5">
                    {currentMonthName}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTreeBalance(null)}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Árbol completo</div>
                <div className="font-medium text-gray-900">
                  {selectedTreeBalance.generalName} / {selectedTreeBalance.conceptName} / <strong>{selectedTreeBalance.subconceptName}</strong>
                </div>
              </div>

              <div className="space-y-3">
                {/* Primera fila: Arrastre y Saldo al día */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Arrastre */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-purple-700 font-medium mb-1">Arrastre</div>
                        <div className="text-xs text-purple-600 mb-1.5">(Mes anterior)</div>
                        <div className={`text-xl font-bold ${
                          selectedTreeBalance.carryover >= 0 ? 'text-purple-600' : 'text-purple-700'
                        }`}>
                          {formatCurrency(selectedTreeBalance.carryover || 0)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {selectedTreeBalance.carryover >= 0 ? (
                          <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Saldo al día */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-orange-700 font-medium mb-1">Saldo al día</div>
                        <div className="text-xs text-orange-600 mb-1.5">(Hasta hoy)</div>
                        <div className={`text-xl font-bold ${
                          selectedTreeBalance.todayBalance >= 0 ? 'text-orange-600' : 'text-orange-700'
                        }`}>
                          {formatCurrency(selectedTreeBalance.todayBalance || 0)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {selectedTreeBalance.todayBalance >= 0 ? (
                          <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segunda fila: Entradas, Salidas y Saldo */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Entradas */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-full">
                        <div className="text-xs text-green-700 font-medium mb-1">Entradas</div>
                        <div className="text-xs text-green-600 mb-1.5">(Mes consultado)</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedTreeBalance.entradas)}
                        </div>
                      </div>
                      <ArrowUpIcon className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" />
                    </div>
                  </div>

                  {/* Salidas */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-full">
                        <div className="text-xs text-red-700 font-medium mb-1">Salidas</div>
                        <div className="text-xs text-red-600 mb-1.5">(Mes consultado)</div>
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(selectedTreeBalance.salidas)}
                        </div>
                      </div>
                      <ArrowDownIcon className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
                    </div>
                  </div>

                  {/* Saldo del mes */}
                  <div className={`border-2 rounded-lg p-4 ${
                    selectedTreeBalance.balance >= 0 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="w-full">
                        <div className={`text-xs font-medium mb-1 ${
                          selectedTreeBalance.balance >= 0 ? 'text-blue-700' : 'text-red-700'
                        }`}>
                          Saldo
                        </div>
                        <div className={`text-xs mb-1.5 ${
                          selectedTreeBalance.balance >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          (Mes consultado)
                        </div>
                        <div className={`text-lg font-bold ${
                          selectedTreeBalance.balance >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(selectedTreeBalance.balance)}
                        </div>
                      </div>
                      <div className="flex items-center flex-shrink-0 ml-2">
                        {selectedTreeBalance.balance >= 0 ? (
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center">
                {selectedTreeBalance.transactionCount} transacciones en este período
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Semana */}
      {selectedWeekDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedWeekDetail(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className={`px-6 py-4 rounded-t-xl ${
              selectedWeekDetail.type === 'entrada' 
                ? 'bg-gradient-to-r from-green-500 to-green-600' 
                : 'bg-gradient-to-r from-red-500 to-red-600'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Detalle de Transacciones - Semana {selectedWeekDetail.weekNumber}
                  </h3>
                  <p className="text-white/90 text-sm mt-0.5">
                    {selectedWeekDetail.weekRange} • {selectedWeekDetail.type === 'entrada' ? 'Entradas' : 'Salidas'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWeekDetail(null)}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1">Subconcepto</div>
                <div className="font-medium text-gray-900">{selectedWeekDetail.subconcept}</div>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                selectedWeekDetail.type === 'entrada' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <span className={`text-xs font-medium ${
                  selectedWeekDetail.type === 'entrada' ? 'text-green-700' : 'text-red-700'
                }`}>
                  Total de la semana:
                </span>
                <span className={`text-lg font-bold ${
                  selectedWeekDetail.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(selectedWeekDetail.amount)}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
              <div className="px-6 py-4">
                {selectedWeekDetail.transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Monto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Descripción
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Proveedor
                          </th>
                          {/* <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            División
                          </th> */}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedWeekDetail.transactions
                          .sort((a, b) => {
                            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                            return dateB - dateA;
                          })
                          .map((transaction, index) => {
                            const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                            
                            const getPaymentStatusBadge = (status) => {
                              const statusConfig = {
                                pendiente: { 
                                  color: "bg-red-100 text-red-800", 
                                  text: "Pendiente",
                                  icon: <ClockIcon className="h-3 w-3 mr-1" />
                                },
                                parcial: { 
                                  color: "bg-yellow-100 text-yellow-800", 
                                  text: "Parcial",
                                  icon: <ClockIcon className="h-3 w-3 mr-1" />
                                },
                                pagado: { 
                                  color: "bg-green-100 text-green-800", 
                                  text: "Pagado",
                                  icon: <CheckCircleIcon className="h-3 w-3 mr-1" />
                                },
                              };
                              return statusConfig[status] || statusConfig.pendiente;
                            };

                            const paymentBadge = getPaymentStatusBadge(transaction.status);
                            
                            return (
                              <tr key={transaction.id || index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {transactionDate.toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </td>
                                <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                  selectedWeekDetail.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {formatCurrency(transaction.amount || 0)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={transaction.description || 'Sin descripción'}>
                                  {transaction.description || 'Sin descripción'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.providerName || 'Sin proveedor'}
                                </td>
                                {/* <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.division ? formatDivision(transaction.division) : '-'}
                                </td> */}
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge.color}`}>
                                    {paymentBadge.icon}
                                    {paymentBadge.text}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No hay transacciones en esta semana para este subconcepto</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <div className="text-xs text-gray-600 text-center">
                Mostrando <strong>{selectedWeekDetail.transactions.length}</strong> transacciones de la semana {selectedWeekDetail.weekNumber}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCarryoverPanel && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setShowCarryoverPanel(false)} />
          <div className="absolute right-0 top-0 h-full w-96 max-w-full bg-background shadow-xl">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">
                    Salidas pendientes por cubrirse
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
                  Todas las salidas con estado pendiente
                </p>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {carryoverTransactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No hay salidas pendientes en el sistema
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

      {/* Modal de Salidas Pendientes por Cubrirse */}
      {showPendingSalidasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPendingSalidasModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 rounded-t-xl bg-gradient-to-r from-orange-500 to-red-600">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Salidas Pendientes por Cubrirse
                  </h3>
                  <p className="text-white/90 text-sm mt-0.5">
                    Transacciones pendientes o parcialmente cubiertas en el período: {currentMonthName}
                  </p>
                </div>
                <button
                  onClick={() => setShowPendingSalidasModal(false)}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                    <span className="text-xs font-medium text-red-700">
                      Total por cubrir:
                    </span>
                    <span className="text-lg font-bold text-red-600">
                      {formatCurrency(pendingSalidasTransactions.reduce((sum, t) => sum + (t.balance || t.amount), 0))}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{pendingSalidasTransactions.length}</span> transacciones
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
              <div className="px-6 py-4">
                {pendingSalidasTransactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Categoría
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Concepto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Subconcepto
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Monto Total
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Por Cubrir
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Proveedor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Descripción
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingSalidasTransactions
                          .sort((a, b) => {
                            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                            return dateB - dateA;
                          })
                          .map((transaction, index) => {
                            const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                            
                            const getPaymentStatusBadge = (status) => {
                              const statusConfig = {
                                pendiente: { 
                                  color: "bg-red-100 text-red-800", 
                                  text: "Pendiente",
                                  icon: <ClockIcon className="h-3 w-3 mr-1" />
                                },
                                parcial: { 
                                  color: "bg-yellow-100 text-yellow-800", 
                                  text: "Parcial",
                                  icon: <ClockIcon className="h-3 w-3 mr-1" />
                                },
                              };
                              return statusConfig[status] || statusConfig.pendiente;
                            };

                            const paymentBadge = getPaymentStatusBadge(transaction.status);
                            
                            return (
                              <tr key={transaction.id || index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {transactionDate.toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.generalName}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.conceptName}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.subconceptName}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                                  {formatCurrency(transaction.amount || 0)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-red-600">
                                  {formatCurrency(transaction.balance || transaction.amount || 0)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.providerName}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={transaction.description || 'Sin descripción'}>
                                  {transaction.description || 'Sin descripción'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge.color}`}>
                                    {paymentBadge.icon}
                                    {paymentBadge.text}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No hay salidas pendientes por cubrirse en este período</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-600">
                  Mostrando <strong>{pendingSalidasTransactions.length}</strong> transacciones • Período: {currentMonthName}
                </div>
                <div className="text-sm font-bold text-red-600">
                  Total: {formatCurrency(pendingSalidasTransactions.reduce((sum, t) => sum + (t.balance || t.amount), 0))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default Reportes;
