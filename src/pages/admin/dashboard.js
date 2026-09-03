import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../context/AuthContextMultiTenant";
import SummaryCards from "../../components/dashboard/SummaryCards";
import MonthlyTrendsChart from "../../components/charts/MonthlyTrendsChart";
import DailyTransactionsChart from "../../components/charts/DailyTransactionsChart";
import AdvancedDateSelector from "../../components/dashboard/AdvancedDateSelector";
import { dashboardService } from "../../lib/services/dashboardService";
import { generalService } from "../../lib/services/generalService";
import { transactionService } from "../../lib/services/transactionService";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";
import { providerService } from "../../lib/services/providerService";
import { descriptionService } from "../../lib/services/descriptionService";
import { recurringExpenseService } from "../../lib/services/recurringExpenseService";
import {
  reportService,
  filterTransactionsByDateRange,
  expandPaymentsToSyntheticTx,
} from "../../lib/services/reportService";
import { paymentService } from "../../lib/services/paymentService";
import TreeComparisonSection from "../../components/reports/TreeComparisonSection";
import WeeklyBreakdownCombined from "../../components/reports/WeeklyBreakdownCombined";
import WeeklyBreakdownEntradas from "../../components/reports/WeeklyBreakdownEntradas";
import WeeklyBreakdownSalidas from "../../components/reports/WeeklyBreakdownSalidas";
import { formatCurrency, formatCurrencyWithBadge, calculateTreeComparison } from "../../lib/utils/reportUtils";

// Red de seguridad: si una consulta a Firestore se cuelga (típico en Safari con
// WebChannel), esto garantiza que la promesa se resuelva/rechace y el spinner no
// quede infinito. Rechaza a los `ms` milisegundos si `promise` no terminó antes.
function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function groupTransactionsByDay(transactions, currentDate, soloPagados = false) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyData = {};
  for (let day = 1; day <= daysInMonth; day++) {
    dailyData[`Día ${day}`] = {
      entradas: 0,
      salidas: 0,
      entradasCount: 0,
      salidasCount: 0,
    };
  }

  transactions.forEach((transaction) => {
    const transactionDate = transaction.date?.toDate
      ? transaction.date.toDate()
      : new Date(transaction.date);
    const day = transactionDate.getDate();
    const dayKey = `Día ${day}`;
    // En modo "pagos reales" se usa lo efectivamente pagado (totalPaid).
    const value = soloPagados
      ? transaction.totalPaid || 0
      : transaction.amount || 0;

    if (dailyData[dayKey]) {
      if (transaction.type === "entrada") {
        dailyData[dayKey].entradas += value;
        dailyData[dayKey].entradasCount++;
      } else if (transaction.type === "salida") {
        dailyData[dayKey].salidas += value;
        dailyData[dayKey].salidasCount++;
      }
    }
  });

  return dailyData;
}

const Dashboard = () => {
  const { error, success } = useToast();
  const { tenantInfo, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    entradas: 0,
    salidas: 0,
    balance: 0,
    totalTransactions: 0,
    entradasCount: 0,
    salidasCount: 0,
  });
  const [dailyData, setDailyData] = useState({});

  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  // Modo de montos: false = todos (registrados), true = solo pagos reales realizados
  const [soloPagados, setSoloPagados] = useState(false);

  // Recordar la preferencia del switch por máquina/navegador (localStorage).
  // Se lee en un efecto (cliente) para no romper la hidratación de Next.
  useEffect(() => {
    try {
      if (localStorage.getItem("dashboardSoloPagados") === "true") {
        setSoloPagados(true);
      }
    } catch {
      /* localStorage no disponible: se usa el valor por defecto */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dashboardSoloPagados", soloPagados ? "true" : "false");
    } catch {
      /* ignorar si localStorage no está disponible */
    }
  }, [soloPagados]);

  const currentMonthName = useMemo(() => {
    const monthName = currentDate.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  }, [currentDate]);

  // States for report sections
  const [stats, setStats] = useState(null);
  const [allTransactionsReport, setAllTransactionsReport] = useState([]);
  const [transactionsReport, setTransactionsReport] = useState([]);
  // Dataset "por fecha de pago" (modo Pagos reales)
  const [statsPagados, setStatsPagados] = useState(null);
  const [paymentsInRange, setPaymentsInRange] = useState([]);
  const [paymentsAllSynthetic, setPaymentsAllSynthetic] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
  });

  const loadDashboardDataRef = useRef(async () => {});

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const startOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      );
      const endOfMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59
      );

      const formatDateLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateLocal(startOfMonth);
      const endDateStr = formatDateLocal(endOfMonth);

      setFilters({
        startDate: startDateStr,
        endDate: endDateStr,
      });

      const tenantId = tenantInfo?.id;
      if (!tenantId) {
        throw new Error("No tenant ID available");
      }

      const filterData = {
        startDate: startOfMonth,
        endDate: endOfMonth,
        type: null,
        generalId: null,
        conceptId: null,
        subconceptId: null,
        division: null,
      };

      // Todo el trabajo de red se calcula desde UN solo getAll de transacciones.
      // El resumen del mes y las tendencias (últimos 6 meses) se derivan en memoria
      // en lugar de disparar 1 + 6 consultas adicionales a Firestore.
      const fetchDashboard = async () => {
        const [
          allTransactionsComplete,
          allConcepts,
          generalsData,
          subconceptsData,
          providersData,
          descriptionsData,
        ] = await Promise.all([
          transactionService.getAll({}, tenantId),
          conceptService.getAll(tenantId),
          generalService.getAll(tenantId),
          subconceptService.getAll(tenantId),
          providerService.getAll(tenantId),
          descriptionService.getAll(tenantId),
        ]);

        const summaryData = dashboardService.buildMonthSummary(
          allTransactionsComplete,
          startOfMonth,
          endOfMonth
        );
        const trendsData = dashboardService.buildMonthlyTrends(
          allTransactionsComplete,
          new Date()
        );

        const transactionsForReport =
          await reportService.getFilteredTransactions(filterData, tenantId, {
            allTransactionsCache: allTransactionsComplete,
          });

        const statsData = await reportService.generateReportStats(
          transactionsForReport,
          filterData,
          tenantId,
          {
            referenceData: {
              concepts: allConcepts,
              providers: providersData,
              descriptions: descriptionsData,
              generals: generalsData,
              subconcepts: subconceptsData,
            },
          }
        );

        const monthTxForChart = filterTransactionsByDateRange(
          allTransactionsComplete,
          startOfMonth,
          endOfMonth,
          {}
        );
        const dailyTransactions = groupTransactionsByDay(
          monthTxForChart,
          currentDate
        );

        return {
          allTransactionsComplete,
          allConcepts,
          generalsData,
          subconceptsData,
          providersData,
          summaryData,
          trendsData,
          transactionsForReport,
          statsData,
          dailyTransactions,
        };
      };

      const result = await withTimeout(
        fetchDashboard(),
        20000,
        "La carga del dashboard tardó demasiado. Verifica tu conexión e intenta de nuevo."
      );

      setGenerals(result.generalsData);
      setConcepts(result.allConcepts);
      setSubconcepts(result.subconceptsData);
      setProviders(result.providersData || []);
      setStats(result.statsData);
      setTransactionsReport(result.transactionsForReport);
      setAllTransactionsReport(result.allTransactionsComplete);
      setSummary(result.summaryData);
      setDailyData(result.dailyTransactions);
      setMonthlyTrends(result.trendsData);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      error("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  }, [currentDate, tenantInfo?.id, error]);

  loadDashboardDataRef.current = loadDashboardData;

  const checkAndGenerateRecurringTransactions = useCallback(async () => {
    try {
      if (!tenantInfo?.id) {
        return;
      }

      await recurringExpenseService.migrateExistingExpenses(tenantInfo.id);

      const generatedTransactions =
        await recurringExpenseService.generatePendingTransactions(
          tenantInfo.id,
          user
        );

      if (generatedTransactions.length > 0) {
        const name = new Date().toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        });
        success(
          `🎯 Sistema automático: Se generaron ${generatedTransactions.length} gastos recurrentes para ${name}`
        );
        setTimeout(() => {
          loadDashboardDataRef.current();
        }, 1000);
      }
    } catch (e) {
      console.error("Error auto-generating recurring transactions:", e);
    }
  }, [tenantInfo?.id, user, success]);

  useEffect(() => {
    if (tenantInfo?.id) {
      loadDashboardData();
    }
  }, [tenantInfo?.id, loadDashboardData]);

  useEffect(() => {
    if (tenantInfo?.id) {
      checkAndGenerateRecurringTransactions();
    }
  }, [tenantInfo?.id, checkAndGenerateRecurringTransactions]);

  // Dataset "por fecha de pago" SOLO cuando el modo Pagos reales está activo.
  // Se calcula de forma perezosa y aislada del load principal (así el modo "Todos"
  // no paga el costo de leer pagos ni recalcular stats). Guardado y cancelable.
  useEffect(() => {
    if (!soloPagados) return;
    const tid = tenantInfo?.id;
    if (!tid || !allTransactionsReport.length) return;
    let cancelled = false;
    (async () => {
      try {
        const paymentsRaw = await paymentService.getAll(tid);
        if (cancelled) return;
        const txById = new Map(allTransactionsReport.map((t) => [t.id, t]));
        const syntheticAll = expandPaymentsToSyntheticTx(paymentsRaw, txById);
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        );
        const syntheticInRange = filterTransactionsByDateRange(
          syntheticAll,
          startOfMonth,
          endOfMonth,
          {}
        );
        const filterData = {
          startDate: startOfMonth,
          endDate: endOfMonth,
          type: null,
          generalId: null,
          conceptId: null,
          subconceptId: null,
          division: null,
        };
        const statsPagadosData = await reportService.generateReportStats(
          syntheticInRange,
          filterData,
          tid,
          {
            referenceData: {
              concepts,
              providers,
              descriptions: [],
              generals,
              subconcepts,
            },
          }
        );
        if (cancelled) return;
        setPaymentsAllSynthetic(syntheticAll);
        setPaymentsInRange(syntheticInRange);
        setStatsPagados(statsPagadosData);
      } catch (e) {
        console.error("Error building payments dataset:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloPagados, tenantInfo?.id, allTransactionsReport, currentDate]);

  // Modo Pagos reales: se usa el dataset "por fecha de pago" (statsPagados / pagos
  // sintéticos) en todas las secciones de montos; el dataset ya codifica el modo.
  const activeStats = soloPagados ? statsPagados : stats;
  const activeTx = soloPagados ? paymentsInRange : transactionsReport;
  const activeAllTx = soloPagados ? paymentsAllSynthetic : allTransactionsReport;

  const treeComparisonData = useMemo(() => {
    if (!activeStats) return [];
    return calculateTreeComparison(
      activeAllTx,
      activeStats,
      filters,
      generals,
      concepts,
      false
    );
  }, [activeAllTx, activeStats, filters, generals, concepts]);

  // Resumen mostrado según el modo:
  // - Todos: montos registrados del mes (summary).
  // - Pagos reales: montos por fecha de pago (statsPagados).
  const displaySummary = useMemo(() => {
    if (!soloPagados) return summary;
    const s = statsPagados;
    if (!s) return summary;

    // "Por pagar" = saldo pendiente de las transacciones del mes (dato transaccional).
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    let pendEntradas = 0;
    let pendSalidas = 0;
    (transactionsReport || []).forEach((t) => {
      const d = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      if (isNaN(d.getTime()) || d < start || d > end) return;
      const amount = t.amount || 0;
      const paid = t.totalPaid || 0;
      const balance =
        t.balance !== undefined && t.balance !== null ? t.balance : amount - paid;
      const restante = Math.max(0, balance);
      if (t.type === "entrada") pendEntradas += restante;
      else if (t.type === "salida") pendSalidas += restante;
    });

    return {
      entradas: s.totalEntradas,
      salidas: s.totalSalidas,
      balance: s.totalEntradas - s.totalSalidas,
      totalTransactions: s.entradasCount + s.salidasCount,
      entradasCount: s.entradasCount,
      salidasCount: s.salidasCount,
      entradasPorPagar: pendEntradas,
      salidasPorPagar: pendSalidas,
    };
  }, [soloPagados, summary, statsPagados, transactionsReport, currentDate]);

  // Gráfica de movimientos diarios según el modo:
  // - Todos: transacciones del mes por su fecha (dailyData registrado).
  // - Pagos reales: pagos del mes por su fecha de pago.
  const dailyChartData = useMemo(() => {
    if (!soloPagados) return dailyData;
    return groupTransactionsByDay(paymentsInRange, currentDate, false);
  }, [soloPagados, dailyData, paymentsInRange, currentDate]);

  // Tendencias mensuales (últimos 6 meses) según el modo.
  // En pagos reales se agrupan los pagos por su fecha de pago.
  const monthlyTrendsDisplay = useMemo(() => {
    if (!soloPagados) return monthlyTrends;
    return dashboardService.buildMonthlyTrends(paymentsAllSynthetic, new Date(), false);
  }, [soloPagados, monthlyTrends, paymentsAllSynthetic]);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <AdminLayout
        title="Dashboard"
        breadcrumbs={[{ name: "Inicio", href: "/admin/dashboard" }]}
      >
        <div className="p-12 text-center">
          <div className="max-w-sm mx-auto">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-red-600 mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-red-600 rounded-full opacity-20"></div>
              </div>
            </div>
            <p className="text-gray-600 mt-4 font-medium">Cargando datos...</p>
            <p className="text-gray-500 text-sm mt-1">
              Por favor espera un momento
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Dashboard"
      breadcrumbs={[{ name: "Inicio", href: "/admin/dashboard" }]}
    >
      <div className="space-y-6">
        {/* Month navigation section */}
        <div className="bg-red-100 rounded-lg border border-border p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {currentMonthName}
              </h2>
              <p className="text-muted-foreground">
                Resumen de transacciones financieras
              </p>
            </div>
            <AdvancedDateSelector
              currentDate={currentDate}
              onDateChange={handleDateChange}
              onSuccess={success}
              onError={error}
            />
          </div>
        </div>

        {/* Switch de Montos: Todos / Solo pagos reales realizados */}
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm font-medium text-muted-foreground">Montos:</span>
          <div className="inline-flex items-center rounded-lg border border-border bg-background p-1 text-sm">
            <button
              type="button"
              onClick={() => setSoloPagados(false)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                !soloPagados
                  ? "bg-[#38425b] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setSoloPagados(true)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                soloPagados
                  ? "bg-[#38425b] text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pagos reales realizados
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards
          summary={displaySummary}
          currentMonthName={currentMonthName}
          montosPagados={soloPagados}
        />

        {/* Report Sections */}
        {activeStats && (
          <div className="space-y-6">
            {/* Tree Comparison Section */}
            <TreeComparisonSection
              stats={activeStats}
              currentMonthName={currentMonthName}
              calculateTreeComparison={() => treeComparisonData}
              formatCurrency={formatCurrency}
              formatCurrencyWithBadge={formatCurrencyWithBadge}
              subconcepts={subconcepts}
              generals={generals}
              providers={providers}
              soloPagados={false}
            />

            {/* Weekly Breakdown Combined (Entradas + Salidas) */}
            <WeeklyBreakdownCombined
              stats={activeStats}
              currentMonthName={currentMonthName}
              transactions={activeTx}
              generals={generals}
              concepts={concepts}
              subconcepts={subconcepts}
              providers={providers}
              filters={filters}
              currentDate={currentDate}
              formatCurrency={formatCurrency}
              soloPagados={false}
              montosPagados={soloPagados}
            />

            {/* Weekly Breakdown for Entradas */}
            <WeeklyBreakdownEntradas
              stats={activeStats}
              currentMonthName={currentMonthName}
              transactions={activeTx}
              generals={generals}
              concepts={concepts}
              subconcepts={subconcepts}
              providers={providers}
              filters={filters}
              currentDate={currentDate}
              formatCurrency={formatCurrency}
              soloPagados={false}
              montosPagados={soloPagados}
            />

            {/* Weekly Breakdown for Salidas */}
            <WeeklyBreakdownSalidas
              stats={activeStats}
              currentMonthName={currentMonthName}
              transactions={activeTx}
              generals={generals}
              concepts={concepts}
              subconcepts={subconcepts}
              providers={providers}
              filters={filters}
              currentDate={currentDate}
              formatCurrency={formatCurrency}
              soloPagados={false}
              montosPagados={soloPagados}
            />
          </div>
        )}

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Movimientos Diarios - Entradas y Salidas */}
          {Object.keys(dailyChartData).length > 0 ? (
            <DailyTransactionsChart data={dailyChartData} monthName={currentMonthName} currentDate={currentDate} />
          ) : (
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="border-2 border-dashed border-border rounded-lg h-64 flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Movimientos Diarios
                  </h3>
                  <p className="text-muted-foreground">No hay transacciones registradas este mes</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Trends Chart */}
        {monthlyTrendsDisplay.length > 0 ? (
          <MonthlyTrendsChart data={monthlyTrendsDisplay} />
        ) : (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="border-2 border-dashed border-border rounded-lg h-64 flex items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Tendencias Mensuales
                </h3>
                <p className="text-muted-foreground">
                  No hay suficientes datos para mostrar tendencias
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Refresh Button */}
        <div className="flex justify-end">
          <button
            onClick={loadDashboardData}
            className="btn-secondary"
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar Dashboard"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
