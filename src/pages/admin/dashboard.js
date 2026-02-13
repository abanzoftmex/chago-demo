import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../components/ui/Toast";
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
import { reportService } from "../../lib/services/reportService";
import TreeComparisonSection from "../../components/reports/TreeComparisonSection";
import WeeklyBreakdownEntradas from "../../components/reports/WeeklyBreakdownEntradas";
import WeeklyBreakdownSalidas from "../../components/reports/WeeklyBreakdownSalidas";
import { formatCurrency, formatCurrencyWithBadge, calculateTreeComparison, getTreeBalanceByName, isAmboTree } from "../../lib/utils/reportUtils";

const Dashboard = () => {
  const { error, success } = useToast();
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
  const [currentMonthName, setCurrentMonthName] = useState("");

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

  useEffect(() => {
    loadDashboardData();
    updateMonthName();
  }, [currentDate]);

  // Separate useEffect for recurring transactions - only on component mount
  useEffect(() => {
    checkAndGenerateRecurringTransactions();
  }, []); // Empty dependency array means it only runs once on mount

  const updateMonthName = () => {
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    setCurrentMonthName(monthName.charAt(0).toUpperCase() + monthName.slice(1));
  };

  const checkAndGenerateRecurringTransactions = async () => {
    try {
      // First, run migration for existing expenses that don't have generatedMonths
      await recurringExpenseService.migrateExistingExpenses();
      
      // Then generate pending transactions for current month
      const generatedTransactions = await recurringExpenseService.generatePendingTransactions();
      
      if (generatedTransactions.length > 0) {
        const currentMonthName = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        success(`🎯 Sistema automático: Se generaron ${generatedTransactions.length} gastos recurrentes para ${currentMonthName}`);
        // Reload dashboard data to reflect the new transactions
        setTimeout(() => {
          loadDashboardData();
        }, 1000);
      }
    } catch (error) {
      console.error("Error auto-generating recurring transactions:", error);
      // Keep it silent for users - no error toast
    }
  };

  // Función para agrupar transacciones por día del mes
  const groupTransactionsByDay = (transactions, currentDate) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Inicializar todos los días del mes con valores en 0
    const dailyData = {};
    for (let day = 1; day <= daysInMonth; day++) {
      dailyData[`Día ${day}`] = {
        entradas: 0,
        salidas: 0,
        entradasCount: 0,
        salidasCount: 0,
      };
    }
    
    // Agrupar transacciones por día
    transactions.forEach(transaction => {
      const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
      const day = transactionDate.getDate();
      const dayKey = `Día ${day}`;
      
      if (dailyData[dayKey]) {
        if (transaction.type === 'entrada') {
          dailyData[dayKey].entradas += transaction.amount || 0;
          dailyData[dayKey].entradasCount++;
        } else if (transaction.type === 'salida') {
          dailyData[dayKey].salidas += transaction.amount || 0;
          dailyData[dayKey].salidasCount++;
        }
      }
    });
    
    return dailyData;
  };

  // Función para agrupar transacciones por categoría general
  const groupTransactionsByGeneral = async (transactions, concepts) => {
    try {
      // Obtener todas las categorías generales de tipo 'salida' (gastos)
      const generals = await generalService.getByType('salida');
      
      // Crear un mapa de conceptos a categorías generales
      const conceptToGeneralMap = {};
      concepts.forEach(concept => {
        // En la base de datos, el campo que relaciona un concepto con su categoría general es generalId
        conceptToGeneralMap[concept.id] = concept.generalId || 'sin-categoria';
      });
      
      // Crear un mapa de IDs de categorías generales a nombres
      const generalNamesMap = {};
      generals.forEach(general => {
        generalNamesMap[general.id] = general.name;
      });
      
      // Inicializar datos para todas las categorías generales, incluso las que no tienen transacciones
      const generalData = {};
      generals.forEach(general => {
        generalData[general.name] = {
          amount: 0,
          count: 0
        };
      });
      
      // Añadir categoría para conceptos sin categoría general asignada
      generalData['Sin Categoría'] = {
        amount: 0,
        count: 0
      };
      
      // Imprimir para depuración
      console.log('Conceptos:', concepts);
      console.log('Mapa de conceptos a generales:', conceptToGeneralMap);
      console.log('Mapa de nombres de generales:', generalNamesMap);
      
      // Agrupar transacciones por categoría general
      transactions.forEach(transaction => {
        if (transaction.type === 'salida') {
          const conceptId = transaction.conceptId;
          const generalId = conceptToGeneralMap[conceptId] || 'sin-categoria';
          const generalName = generalNamesMap[generalId] || 'Sin Categoría';
          console.log(`Transacción: ${transaction.id}, Concepto: ${conceptId}, General ID: ${generalId}, Nombre General: ${generalName}`);
          
          generalData[generalName].amount += transaction.amount;
          generalData[generalName].count++;
        }
      });
      
      // Filtrar categorías sin transacciones si se desea
      // const filteredGeneralData = Object.fromEntries(
      //   Object.entries(generalData).filter(([_, data]) => data.count > 0)
      // );
      
      return generalData;
    } catch (error) {
      console.error('Error agrupando transacciones por categoría general:', error);
      return {};
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Get first and last day of the selected month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      // Format dates for filters
      const formatDateLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateLocal(startOfMonth);
      const endDateStr = formatDateLocal(endOfMonth);

      // Update filters for report components
      setFilters({
        startDate: startDateStr,
        endDate: endDateStr
      });

      // Load all dashboard data in parallel for the selected month
      const [
        summaryData,
        trendsData, 
        allTransactions, 
        allConcepts,
        generalsData,
        subconceptsData
      ] = await Promise.all([
        dashboardService.getMonthSummary(startOfMonth, endOfMonth),
        dashboardService.getMonthlyTrends(),
        transactionService.getByDateRange(startOfMonth, endOfMonth),
        conceptService.getAll(),
        generalService.getAll(),
        subconceptService.getAll()
      ]);

      // Generate report stats for report components
      const filterData = {
        startDate: startOfMonth,
        endDate: endOfMonth,
        type: null,
        generalId: null,
        conceptId: null,
        subconceptId: null,
        division: null
      };

      const transactionsForReport = await reportService.getFilteredTransactions(filterData);
      const statsData = await reportService.generateReportStats(transactionsForReport, filterData);

      // Store data for report components
      setGenerals(generalsData);
      setConcepts(allConcepts);
      setSubconcepts(subconceptsData);
      setStats(statsData);
      setTransactionsReport(transactionsForReport);
      
      // Get all transactions without date filter for tree comparison
      const allTransactionsComplete = await transactionService.getAll({});
      setAllTransactionsReport(allTransactionsComplete);

      // Agrupar transacciones por día
      const dailyTransactions = groupTransactionsByDay(allTransactions, currentDate);

      setSummary(summaryData);
      setDailyData(dailyTransactions);
      setMonthlyTrends(trendsData);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      error("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  };

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
              calculateTreeComparison={() => calculateTreeComparison(allTransactionsReport, stats, filters, generals, concepts)}
              formatCurrency={formatCurrency}
              formatCurrencyWithBadge={formatCurrencyWithBadge}
              subconcepts={subconcepts}
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
              getTreeBalanceByName={(treeString) => getTreeBalanceByName(treeString, () => calculateTreeComparison(allTransactionsReport, stats, filters, generals, concepts))}
              isAmboTree={(treeString) => isAmboTree(treeString, generals)}
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
              getTreeBalanceByName={(treeString) => getTreeBalanceByName(treeString, () => calculateTreeComparison(allTransactionsReport, stats, filters, generals, concepts))}
              isAmboTree={(treeString) => isAmboTree(treeString, generals)}
            />
          </div>
        )}

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Movimientos Diarios - Entradas y Salidas */}
          {Object.keys(dailyData).length > 0 ? (
            <DailyTransactionsChart data={dailyData} monthName={currentMonthName} />
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
