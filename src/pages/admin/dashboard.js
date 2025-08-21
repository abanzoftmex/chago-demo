import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../components/ui/Toast";
import SummaryCards from "../../components/dashboard/SummaryCards";
import MonthlyTrendsChart from "../../components/charts/MonthlyTrendsChart";
import BarConceptChart from "../../components/charts/BarConceptChart";
import { dashboardService } from "../../lib/services/dashboardService";
import { generalService } from "../../lib/services/generalService";
import { transactionService } from "../../lib/services/transactionService";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

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
  const [conceptData, setConceptData] = useState({});
  const [generalData, setGeneralData] = useState({});
  const [subconceptData, setSubconceptData] = useState({});
  const [monthlyTrends, setMonthlyTrends] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const monthDropdownRef = useRef(null);

  useEffect(() => {
    loadDashboardData();
    updateMonthName();
  }, [currentDate]);
  
  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
        setShowMonthDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateMonthName = () => {
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    setCurrentMonthName(monthName.charAt(0).toUpperCase() + monthName.slice(1));
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

      // Load all dashboard data in parallel for the selected month
      const [summaryData, conceptsData, trendsData, allTransactions, allConcepts, allSubconcepts] = await Promise.all([
        dashboardService.getMonthSummary(startOfMonth, endOfMonth),
        dashboardService.getTransactionsByConceptForDateRange(startOfMonth, endOfMonth),
        dashboardService.getMonthlyTrends(),
        transactionService.getByDateRange(startOfMonth, endOfMonth),
        conceptService.getAll(),
        subconceptService.getAll(),
      ]);

      // Agrupar transacciones por General (misma estructura que otros charts)
      const allGenerals = await generalService.getAll();
      const generalMap = {};
      allGenerals
        .filter(g => g.type === 'salida')
        .forEach(g => { generalMap[g.id] = g.name; });
      const conceptToGeneralMap = {};
      allConcepts.forEach(c => { conceptToGeneralMap[c.id] = c.generalId; });
      const genData = {};
      allTransactions.forEach(tx => {
        if (tx.type === 'salida') {
          const genId = tx.generalId || conceptToGeneralMap[tx.conceptId] || 'sin';
          const name = generalMap[genId] || 'Sin Categoría';
          if (!genData[name]) {
            genData[name] = { entradas: 0, salidas: 0, total: 0, count: 0 };
          }
          genData[name].salidas += tx.amount;
          genData[name].total += tx.amount;
          genData[name].count += 1;
        }
      });

      // Agrupar transacciones por subconcepto (solo gastos)
      const subconceptMap = {};
      allSubconcepts.forEach(sc => {
        subconceptMap[sc.id] = sc.name;
      });
      const subData = {};
      allTransactions.forEach(tx => {
        if (tx.type === 'salida') {
          const name = tx.subconceptId ? (subconceptMap[tx.subconceptId] || 'Sin Subconcepto') : 'Sin Subconcepto';
          if (!subData[name]) {
            subData[name] = { entradas: 0, salidas: 0, total: 0, count: 0 };
          }
          subData[name].salidas += tx.amount;
          subData[name].total += tx.amount;
          subData[name].count += 1;
        }
      });

      setSummary(summaryData);
      setConceptData(conceptsData);
      setGeneralData(genData);
      setSubconceptData(subData);
      setMonthlyTrends(trendsData);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      error("Error al cargar los datos del dashboard");
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setShowMonthDropdown(false);
    success(`Mostrando datos de ${newDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`);
  };
  
  const selectMonth = (monthIndex) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);
    setShowMonthDropdown(false);
    success(`Mostrando datos de ${newDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`);
  };
  
  const getMonthsList = () => {
    const months = [];
    const currentYear = currentDate.getFullYear();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      months.push({
        index: i,
        name: date.toLocaleDateString('es-ES', { month: 'long' })
      });
    }
    
    return months;
  };

  if (loading) {
    return (
      <AdminLayout
        title="Dashboard"
        breadcrumbs={[{ name: "Inicio", href: "/admin/dashboard" }]}
      >
        <div className="space-y-6">
          {/* Loading skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        <div className="bg-background rounded-lg border border-border p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {currentMonthName}
              </h2>
              <p className="text-muted-foreground">
                Resumen de transacciones financieras
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                aria-label="Mes anterior"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <div className="relative" ref={monthDropdownRef}>
                <button
                  onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                  className="px-3 py-2 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors flex items-center space-x-1"
                >
                  <span>{currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear() ? "Mes Actual" : currentDate.toLocaleDateString('es-ES', { month: 'long' })}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                
                {showMonthDropdown && (
                  <div className="absolute z-10 mt-1 w-40 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <button
                      onClick={() => {
                        setCurrentDate(new Date());
                        setShowMonthDropdown(false);
                        success("Mostrando datos del mes actual");
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Mes Actual
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    {getMonthsList().map((month) => (
                      <button
                        key={month.index}
                        onClick={() => selectMonth(month.index)}
                        className={`block w-full text-left px-4 py-2 text-sm ${currentDate.getMonth() === month.index ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {month.name.charAt(0).toUpperCase() + month.name.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => navigateMonth(1)}
                className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                aria-label="Mes siguiente"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <SummaryCards summary={summary} />

        {/* Charts Section */}
        <div className="space-y-6">
          {/* Gastos por General */}
          <div className="w-full">
            <h2 className="text-xl font-bold text-foreground mb-4">Gastos por General</h2>
            {Object.keys(generalData).length > 0 ? (
              <BarConceptChart data={generalData} type="salidas" />
            ) : (
              <div className="bg-background rounded-lg border border-border p-6">
                <div className="border-2 border-dashed border-border rounded-lg h-64 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground">No hay gastos registrados este mes</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gastos por Concepto */}
          <div className="w-full">
            <h2 className="text-xl font-bold text-foreground mb-4">Gastos por Concepto</h2>
            {Object.keys(conceptData).length > 0 ? (
              <BarConceptChart data={conceptData} type="salidas" />
            ) : (
              <div className="bg-background rounded-lg border border-border p-6">
                <div className="border-2 border-dashed border-border rounded-lg h-64 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground">No hay gastos registrados este mes</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gastos por Subconcepto */}
          <div className="w-full">
            <h2 className="text-xl font-bold text-foreground mb-4">Gastos por Subconcepto</h2>
            {Object.keys(subconceptData).length > 0 ? (
              <BarConceptChart data={subconceptData} type="salidas" />
            ) : (
              <div className="bg-background rounded-lg border border-border p-6">
                <div className="border-2 border-dashed border-border rounded-lg h-64 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground">No hay gastos registrados este mes</p>
                  </div>
                </div>
              </div>
            )}
          </div>
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
