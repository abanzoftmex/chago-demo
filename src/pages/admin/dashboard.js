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
import { recurringExpenseService } from "../../lib/services/recurringExpenseService";
import {
  reportService,
  filterTransactionsByDateRange,
} from "../../lib/services/reportService";
import TreeComparisonSection from "../../components/reports/TreeComparisonSection";
import WeeklyBreakdownCombined from "../../components/reports/WeeklyBreakdownCombined";
import WeeklyBreakdownEntradas from "../../components/reports/WeeklyBreakdownEntradas";
import WeeklyBreakdownSalidas from "../../components/reports/WeeklyBreakdownSalidas";
import { formatCurrency, formatCurrencyWithBadge, calculateTreeComparison } from "../../lib/utils/reportUtils";

function groupTransactionsByDay(transactions, currentDate) {
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

    if (dailyData[dayKey]) {
      if (transaction.type === "entrada") {
        dailyData[dayKey].entradas += transaction.amount || 0;
        dailyData[dayKey].entradasCount++;
      } else if (transaction.type === "salida") {
        dailyData[dayKey].salidas += transaction.amount || 0;
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
  const [generals, setGenerals] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
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

      const [
        summaryData,
        trendsData,
        allTransactionsComplete,
        allConcepts,
        generalsData,
        subconceptsData,
      ] = await Promise.all([
        dashboardService.getMonthSummary(startOfMonth, endOfMonth, tenantId),
        dashboardService.getMonthlyTrends(tenantId),
        transactionService.getAll({}, tenantId),
        conceptService.getAll(tenantId),
        generalService.getAll(tenantId),
        subconceptService.getAll(tenantId),
      ]);

      const transactionsForReport = await reportService.getFilteredTransactions(
        filterData,
        tenantId,
        { allTransactionsCache: allTransactionsComplete }
      );

      const statsData = await reportService.generateReportStats(
        transactionsForReport,
        filterData,
        tenantId
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

      setGenerals(generalsData);
      setConcepts(allConcepts);
      setSubconcepts(subconceptsData);
      setStats(statsData);
      setTransactionsReport(transactionsForReport);
      setAllTransactionsReport(allTransactionsComplete);
      setSummary(summaryData);
      setDailyData(dailyTransactions);
      setMonthlyTrends(trendsData);
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

  const treeComparisonData = useMemo(() => {
    if (!stats) return [];
    return calculateTreeComparison(
      allTransactionsReport,
      stats,
      filters,
      generals,
      concepts
    );
  }, [allTransactionsReport, stats, filters, generals, concepts]);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <AdminLayout
        title="Dashboard"
        breadcrumbs={[{ name: "Inicio", href: "/admin/dashboard" }]}
      >
        <div className="space-y-6">
          {/* Loading skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-background rounded-lg border border-border p-6"
              >
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="animate-pulse h-64 bg-muted rounded"></div>
            </div>
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="animate-pulse h-64 bg-muted rounded"></div>
            </div>
          </div>

          <div className="bg-background rounded-lg border border-border p-6">
            <div className="animate-pulse h-64 bg-muted rounded"></div>
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

      

        {/* Summary Cards */}
        <SummaryCards summary={summary} currentMonthName={currentMonthName} />

        {/* Report Sections */}
        {stats && (
          <div className="space-y-6">
            {/* Tree Comparison Section */}
            <TreeComparisonSection
              stats={stats}
              currentMonthName={currentMonthName}
              calculateTreeComparison={() => treeComparisonData}
              formatCurrency={formatCurrency}
              formatCurrencyWithBadge={formatCurrencyWithBadge}
              subconcepts={subconcepts}
              generals={generals}
            />

            {/* Weekly Breakdown Combined (Entradas + Salidas) */}
            <WeeklyBreakdownCombined
              stats={stats}
              currentMonthName={currentMonthName}
              transactions={transactionsReport}
              generals={generals}
              concepts={concepts}
              subconcepts={subconcepts}
              filters={filters}
              currentDate={currentDate}
              formatCurrency={formatCurrency}
            />

            {/* Weekly Breakdown for Entradas */}
            <WeeklyBreakdownEntradas
              stats={stats}
              currentMonthName={currentMonthName}
              transactions={transactionsReport}
              generals={generals}
              concepts={concepts}
              subconcepts={subconcepts}
              filters={filters}
              currentDate={currentDate}
              formatCurrency={formatCurrency}
            />

            {/* Weekly Breakdown for Salidas */}
            <WeeklyBreakdownSalidas
              stats={stats}
              currentMonthName={currentMonthName}
              transactions={transactionsReport}
              generals={generals}
              concepts={concepts}
              subconcepts={subconcepts}
              filters={filters}
              currentDate={currentDate}
              formatCurrency={formatCurrency}
            />
          </div>
        )}

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Movimientos Diarios - Entradas y Salidas */}
          {Object.keys(dailyData).length > 0 ? (
            <DailyTransactionsChart data={dailyData} monthName={currentMonthName} currentDate={currentDate} />
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
        {monthlyTrends.length > 0 ? (
          <MonthlyTrendsChart data={monthlyTrends} />
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
